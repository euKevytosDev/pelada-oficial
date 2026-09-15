package br.com.peladaoficial.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.google.auth.oauth2.GoogleCredentials;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.List;
import java.util.Locale;

/**
 * Valida purchaseToken de assinatura com a Google Play Developer API (subscriptionsv2).
 */
@Service
public class GooglePlayBillingClient {

    public static final String PACKAGE_PADRAO = "com.rkds.reidapelada";
    public static final String PRODUCT_ID = "reidapelada_pro";

    private final ObjectMapper objectMapper;
    private final HttpClient http = HttpClient.newHttpClient();
    private final String credentialsJson;
    private final String credentialsPath;
    private final String packageName;

    public GooglePlayBillingClient(ObjectMapper objectMapper,
                                   @Value("${app.play.credentials-json:}") String credentialsJson,
                                   @Value("${app.play.credentials-path:}") String credentialsPath,
                                   @Value("${app.play.package-name:com.rkds.reidapelada}") String packageName) {
        this.objectMapper = objectMapper;
        this.credentialsJson = credentialsJson;
        this.credentialsPath = credentialsPath;
        this.packageName = packageName == null || packageName.isBlank() ? PACKAGE_PADRAO : packageName;
    }

    public boolean configurado() {
        return (credentialsJson != null && !credentialsJson.isBlank())
                || (credentialsPath != null && !credentialsPath.isBlank() && Files.isRegularFile(Path.of(credentialsPath)));
    }

    public String packageName() {
        return packageName;
    }

    public AssinaturaPlay verificarAssinatura(String purchaseToken) {
        if (!configurado()) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                    "Play Billing no servidor ainda não está configurado (credenciais Google)");
        }
        if (purchaseToken == null || purchaseToken.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Token da compra ausente");
        }
        try {
            String token = accessToken();
            String enc = URLEncoder.encode(purchaseToken.trim(), StandardCharsets.UTF_8);
            String url = "https://androidpublisher.googleapis.com/androidpublisher/v3/applications/"
                    + packageName
                    + "/purchases/subscriptionsv2/tokens/"
                    + enc;
            HttpRequest req = HttpRequest.newBuilder(URI.create(url))
                    .header("Authorization", "Bearer " + token)
                    .GET()
                    .build();
            HttpResponse<String> res = http.send(req, HttpResponse.BodyHandlers.ofString());
            if (res.statusCode() >= 400) {
                throw new ResponseStatusException(HttpStatus.BAD_GATEWAY,
                        "Google Play recusou a validação (" + res.statusCode() + ")");
            }
            JsonNode root = objectMapper.readTree(res.body());
            String state = text(root, "subscriptionState");
            boolean ativa = state != null && (
                    state.contains("ACTIVE")
                            || state.contains("IN_GRACE_PERIOD")
                            || state.contains("IN_ACCOUNT_HOLD")
            );
            if (!ativa) {
                throw new ResponseStatusException(HttpStatus.PAYMENT_REQUIRED,
                        "Assinatura Play não está ativa (" + state + ")");
            }

            String productId = PRODUCT_ID;
            String basePlanId = null;
            LocalDateTime expira = null;
            JsonNode lines = root.get("lineItems");
            if (lines != null && lines.isArray() && !lines.isEmpty()) {
                JsonNode first = lines.get(0);
                productId = text(first, "productId");
                if (productId == null || productId.isBlank()) productId = PRODUCT_ID;
                JsonNode offer = first.get("offerDetails");
                if (offer != null) {
                    basePlanId = text(offer, "basePlanId");
                }
                String expiry = text(first, "expiryTime");
                if (expiry != null && !expiry.isBlank()) {
                    expira = LocalDateTime.ofInstant(Instant.parse(expiry), ZoneId.systemDefault());
                }
            }
            if (expira == null) {
                expira = LocalDateTime.now().plusDays(35);
            }
            return new AssinaturaPlay(productId, basePlanId, expira, state, true);
        } catch (ResponseStatusException e) {
            throw e;
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY,
                    "Falha ao validar compra na Google Play: " + e.getMessage());
        }
    }

    private String accessToken() throws IOException {
        GoogleCredentials credentials;
        if (credentialsJson != null && !credentialsJson.isBlank()) {
            try (InputStream in = new ByteArrayInputStream(credentialsJson.getBytes(StandardCharsets.UTF_8))) {
                credentials = GoogleCredentials.fromStream(in)
                        .createScoped(List.of("https://www.googleapis.com/auth/androidpublisher"));
            }
        } else {
            try (InputStream in = Files.newInputStream(Path.of(credentialsPath))) {
                credentials = GoogleCredentials.fromStream(in)
                        .createScoped(List.of("https://www.googleapis.com/auth/androidpublisher"));
            }
        }
        credentials.refreshIfExpired();
        if (credentials.getAccessToken() == null) {
            credentials.refresh();
        }
        return credentials.getAccessToken().getTokenValue();
    }

    private static String text(JsonNode node, String field) {
        if (node == null || field == null) return null;
        JsonNode v = node.get(field);
        return v == null || v.isNull() ? null : v.asText();
    }

    public record AssinaturaPlay(
            String productId,
            String basePlanId,
            LocalDateTime expiraEm,
            String estado,
            boolean ativa
    ) {
        public boolean produtoOk() {
            return productId != null && productId.toLowerCase(Locale.ROOT).contains("reidapelada");
        }
    }
}

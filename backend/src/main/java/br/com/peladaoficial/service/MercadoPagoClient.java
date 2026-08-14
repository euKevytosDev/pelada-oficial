package br.com.peladaoficial.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Component
public class MercadoPagoClient {

    private final RestClient http;
    private final String accessToken;

    public MercadoPagoClient(@Value("${app.mercadopago.access-token:}") String accessToken) {
        this.accessToken = accessToken == null ? "" : accessToken.trim();
        this.http = RestClient.builder().baseUrl("https://api.mercadopago.com").build();
    }

    public boolean configurado() {
        return !accessToken.isBlank();
    }

    @SuppressWarnings("unchecked")
    public Map<String, Object> criarPreferencia(String titulo,
                                                BigDecimal valor,
                                                String externalRef,
                                                String notificationUrl,
                                                String successUrl,
                                                String failUrl) {
        if (!configurado()) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                    "Pagamento na web ainda não está ligado. Peça o token do Mercado Pago.");
        }

        Map<String, Object> item = new LinkedHashMap<>();
        item.put("title", titulo);
        item.put("quantity", 1);
        item.put("currency_id", "BRL");
        item.put("unit_price", valor);

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("items", List.of(item));
        body.put("external_reference", externalRef);
        body.put("notification_url", notificationUrl);
        body.put("auto_return", "approved");
        body.put("back_urls", Map.of(
                "success", successUrl,
                "failure", failUrl,
                "pending", failUrl
        ));

        Map<String, Object> resp = http.post()
                .uri("/checkout/preferences")
                .contentType(MediaType.APPLICATION_JSON)
                .header("Authorization", "Bearer " + accessToken)
                .body(body)
                .retrieve()
                .body(Map.class);
        if (resp == null || resp.get("init_point") == null) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Mercado Pago não devolveu o checkout");
        }
        return resp;
    }

    @SuppressWarnings("unchecked")
    public Map<String, Object> buscarPagamento(String paymentId) {
        if (!configurado()) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Mercado Pago não configurado");
        }
        return http.get()
                .uri("/v1/payments/{id}", paymentId)
                .header("Authorization", "Bearer " + accessToken)
                .retrieve()
                .body(Map.class);
    }
}

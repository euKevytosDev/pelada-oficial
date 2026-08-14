package br.com.peladaoficial.service;

import br.com.peladaoficial.model.Usuario;
import br.com.peladaoficial.repository.UsuarioRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@Service
public class AssinaturaService {

    public static final String PLANO_GRATIS = "GRATIS";
    public static final String PLANO_PRO = "PRO";
    public static final String PRO_MENSAL = "pro_mensal";
    public static final String PRO_ANUAL = "pro_anual";

    private static final DateTimeFormatter FMT = DateTimeFormatter.ofPattern("dd/MM/yyyy");

    public static final String ORIGEM_CORTESIA = "CORTESIA";

    private final UsuarioRepository usuarioRepository;
    private final MercadoPagoClient mercadoPagoClient;
    private final int trialDias;
    private final String frontUrl;
    private final String webhookUrl;
    private final Set<String> emailsCortesia;

    public AssinaturaService(UsuarioRepository usuarioRepository,
                             MercadoPagoClient mercadoPagoClient,
                             @Value("${app.assinatura.trial-dias:7}") int trialDias,
                             @Value("${app.assinatura.front-url:https://eukevytosdev.github.io/pelada-oficial/}") String frontUrl,
                             @Value("${app.assinatura.webhook-url:}") String webhookUrl,
                             @Value("${app.assinatura.pro-cortesia:raiankevinsouza@gmail.com}") String proCortesia) {
        this.usuarioRepository = usuarioRepository;
        this.mercadoPagoClient = mercadoPagoClient;
        this.trialDias = trialDias > 0 ? trialDias : 7;
        this.frontUrl = frontUrl.endsWith("/") ? frontUrl : frontUrl + "/";
        this.webhookUrl = webhookUrl;
        this.emailsCortesia = Arrays.stream(nvl(proCortesia, "").split(","))
                .map(s -> s.trim().toLowerCase(Locale.ROOT))
                .filter(s -> !s.isBlank())
                .collect(Collectors.toUnmodifiableSet());
    }

    public List<Map<String, Object>> catalogo() {
        return List.of(
                planoPublico(PRO_MENSAL, "Mensal", "R$ 14,90", "14.90", "Cobra todo mês. Cancela quando quiser."),
                planoPublico(PRO_ANUAL, "Anual", "R$ 99", "99.00", "2 meses de desconto. Melhor custo.")
        );
    }

    @Transactional
    public Map<String, Object> garantirTrialEMap(Usuario usuario) {
        if (usuarioPersistido(usuario)) {
            boolean mudou = aplicarCortesia(usuario);
            if (!mudou && usuario.getTrialInicio() == null && !proAtivo(usuario)) {
                LocalDateTime agora = LocalDateTime.now();
                usuario.setTrialInicio(agora);
                usuario.setPlano(PLANO_PRO);
                usuario.setPlanoExpiraEm(agora.plusDays(trialDias));
                usuario.setPagamentoOrigem("TRIAL");
                mudou = true;
            }
            if (mudou) {
                usuarioRepository.save(usuario);
            }
        }
        return toMap(usuario);
    }

    public boolean proAtivo(Usuario usuario) {
        if (usuario == null) return false;
        if (emailCortesia(usuario)) return true;
        if (!PLANO_PRO.equalsIgnoreCase(nvl(usuario.getPlano(), PLANO_GRATIS))) return false;
        LocalDateTime expira = usuario.getPlanoExpiraEm();
        return expira != null && expira.isAfter(LocalDateTime.now());
    }

    @Transactional
    public Map<String, Object> criarCheckout(Usuario usuario, String planoId) {
        garantirTrialEMap(usuario);
        CatalogoPlano plano = resolverPlano(planoId);
        if (!usuarioPersistido(usuario)) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Faça login de novo para assinar");
        }
        if (emailCortesia(usuario)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Sua conta já é Pro");
        }
        if (!mercadoPagoClient.configurado()) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                    "Pagamento na web ainda está sendo ligado. Seu teste Pro já vale por " + trialDias + " dias.");
        }

        String externalRef = usuario.getId() + ":" + plano.id();
        String success = frontUrl + "?pago=ok";
        String fail = frontUrl + "?pago=falhou";
        Map<String, Object> pref = mercadoPagoClient.criarPreferencia(
                plano.tituloMp(),
                plano.valor(),
                externalRef,
                webhookUrl,
                success,
                fail
        );
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("initPoint", pref.get("init_point"));
        out.put("preferenceId", pref.get("id"));
        return out;
    }

    @Transactional
    public void processarNotificacao(String paymentId) {
        if (paymentId == null || paymentId.isBlank()) return;
        Map<String, Object> pag = mercadoPagoClient.buscarPagamento(paymentId.trim());
        if (pag == null) return;
        String status = String.valueOf(pag.getOrDefault("status", ""));
        if (!"approved".equalsIgnoreCase(status)) return;

        String ext = String.valueOf(pag.getOrDefault("external_reference", ""));
        int sep = ext.indexOf(':');
        if (sep <= 0) return;
        long userId;
        try {
            userId = Long.parseLong(ext.substring(0, sep));
        } catch (NumberFormatException e) {
            return;
        }
        String planoId = ext.substring(sep + 1);
        CatalogoPlano plano = resolverPlano(planoId);

        Usuario usuario = usuarioRepository.findById(userId).orElse(null);
        if (usuario == null) return;
        if (emailCortesia(usuario)) return;

        String ja = usuario.getUltimoPagamentoMp();
        if (paymentId.equals(ja)) return;

        LocalDateTime agora = LocalDateTime.now();
        LocalDateTime base = usuario.getPlanoExpiraEm();
        if (base == null || base.isBefore(agora)) base = agora;
        usuario.setPlano(PLANO_PRO);
        usuario.setPlanoExpiraEm(base.plusDays(plano.dias()));
        usuario.setPagamentoOrigem("WEB_MP");
        usuario.setUltimoPagamentoMp(paymentId);
        usuarioRepository.save(usuario);
    }

    public Map<String, Object> toMap(Usuario usuario) {
        boolean cortesia = emailCortesia(usuario);
        boolean ativo = proAtivo(usuario);
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("proAtivo", ativo);
        map.put("plano", ativo ? PLANO_PRO : PLANO_GRATIS);
        map.put("trial", !cortesia && "TRIAL".equalsIgnoreCase(nvl(usuario.getPagamentoOrigem(), "")));
        map.put("origem", cortesia ? ORIGEM_CORTESIA : nvl(usuario.getPagamentoOrigem(), ""));
        map.put("cortesia", cortesia);
        map.put("checkoutWeb", mercadoPagoClient.configurado());
        LocalDateTime expira = cortesia ? null : (usuario != null ? usuario.getPlanoExpiraEm() : null);
        map.put("expiraEm", expira != null ? expira.toString() : "");
        map.put("expiraEmTexto", expira != null ? FMT.format(expira) : "");
        map.put("trialDias", trialDias);
        return map;
    }

    private boolean aplicarCortesia(Usuario usuario) {
        if (!emailCortesia(usuario)) return false;
        boolean mudou = false;
        if (!PLANO_PRO.equalsIgnoreCase(nvl(usuario.getPlano(), ""))) {
            usuario.setPlano(PLANO_PRO);
            mudou = true;
        }
        if (!ORIGEM_CORTESIA.equalsIgnoreCase(nvl(usuario.getPagamentoOrigem(), ""))) {
            usuario.setPagamentoOrigem(ORIGEM_CORTESIA);
            mudou = true;
        }
        if (usuario.getPlanoExpiraEm() != null) {
            usuario.setPlanoExpiraEm(null);
            mudou = true;
        }
        return mudou;
    }

    private boolean emailCortesia(Usuario usuario) {
        if (usuario == null || usuario.getEmail() == null) return false;
        return emailsCortesia.contains(usuario.getEmail().trim().toLowerCase(Locale.ROOT));
    }

    private boolean usuarioPersistido(Usuario usuario) {
        if (usuario == null || usuario.getId() == null) return false;
        String hash = usuario.getSenhaHash();
        if (hash != null && hash.startsWith("$2")) return true;
        return usuario.getGoogleId() != null && !usuario.getGoogleId().isBlank();
    }

    private CatalogoPlano resolverPlano(String planoId) {
        if (PRO_ANUAL.equals(planoId)) {
            return new CatalogoPlano(PRO_ANUAL, "Pelada Pro anual", new BigDecimal("99.00"), 365);
        }
        if (PRO_MENSAL.equals(planoId) || planoId == null || planoId.isBlank()) {
            return new CatalogoPlano(PRO_MENSAL, "Pelada Pro mensal", new BigDecimal("14.90"), 30);
        }
        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Plano inválido");
    }

    private Map<String, Object> planoPublico(String id, String nome, String preco, String valor, String dica) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", id);
        m.put("nome", nome);
        m.put("preco", preco);
        m.put("valor", valor);
        m.put("dica", dica);
        return m;
    }

    private static String nvl(String v, String d) {
        return v == null || v.isBlank() ? d : v;
    }

    private record CatalogoPlano(String id, String tituloMp, BigDecimal valor, int dias) {}
}

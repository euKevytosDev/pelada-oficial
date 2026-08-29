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
    public static final String PRO_MENSAL_RECORRENTE = "pro_mensal_recorrente";
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
                             @Value("${app.assinatura.pro-cortesia:raiankevin18@gmail.com}") String proCortesia) {
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
                planoPublico(PRO_ANUAL, "Anual", "R$ 349,90", "349.90", "~R$ 29,15/mês. Pix ou cartão avulso."),
                planoPublico(PRO_MENSAL, "Mensal Pix", "R$ 49,90", "49.90", "Paga uma vez no Pix (30 dias de Pro)."),
                planoPublico(PRO_MENSAL_RECORRENTE, "Mensal cartão", "R$ 49,90", "49.90",
                        "Renova automaticamente todo mês no cartão.")
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

        Map<String, Object> out = new LinkedHashMap<>();
        if (PRO_MENSAL_RECORRENTE.equals(plano.id())) {
            Map<String, Object> sub = mercadoPagoClient.criarAssinaturaRecorrente(
                    plano.tituloMp(),
                    plano.valor(),
                    externalRef,
                    usuario.getEmail(),
                    success,
                    webhookUrl
            );
            out.put("initPoint", sub.get("init_point"));
            out.put("preapprovalId", sub.get("id"));
            out.put("tipo", "recorrente");
            return out;
        }

        Map<String, Object> pref = mercadoPagoClient.criarPreferencia(
                plano.tituloMp(),
                plano.valor(),
                externalRef,
                webhookUrl,
                success,
                fail
        );
        out.put("initPoint", pref.get("init_point"));
        out.put("preferenceId", pref.get("id"));
        out.put("tipo", "avulso");
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
        String planoId = extrairPlanoId(ext);
        if (planoId == null) {
            Object preId = pag.get("preapproval_id");
            if (preId != null) {
                processarAssinatura(String.valueOf(preId));
            }
            return;
        }
        CatalogoPlano plano = resolverPlano(planoId);
        ativarProPorPagamento(ext, plano, paymentId.trim(), "WEB_MP");
    }

    @Transactional
    public void processarAssinatura(String preapprovalId) {
        if (preapprovalId == null || preapprovalId.isBlank()) return;
        Map<String, Object> sub = mercadoPagoClient.buscarPreapproval(preapprovalId.trim());
        if (sub == null) return;

        String status = String.valueOf(sub.getOrDefault("status", ""));
        if (!"authorized".equalsIgnoreCase(status) && !"active".equalsIgnoreCase(status)) {
            return;
        }

        String ext = String.valueOf(sub.getOrDefault("external_reference", ""));
        String planoId = extrairPlanoId(ext);
        if (planoId == null || !PRO_MENSAL_RECORRENTE.equals(planoId)) return;

        int sep = ext.indexOf(':');
        long userId;
        try {
            userId = Long.parseLong(ext.substring(0, sep));
        } catch (NumberFormatException e) {
            return;
        }

        Usuario usuario = usuarioRepository.findById(userId).orElse(null);
        if (usuario == null || emailCortesia(usuario)) return;

        LocalDateTime agora = LocalDateTime.now();
        LocalDateTime base = usuario.getPlanoExpiraEm();
        if (base == null || base.isBefore(agora)) base = agora;

        usuario.setPlano(PLANO_PRO);
        usuario.setPlanoExpiraEm(base.plusDays(35));
        usuario.setPagamentoOrigem("WEB_MP_RECORRENTE");
        usuario.setMpPreapprovalId(preapprovalId.trim());
        usuarioRepository.save(usuario);
    }

    private void ativarProPorPagamento(String ext, CatalogoPlano plano, String paymentId, String origem) {
        int sep = ext.indexOf(':');
        if (sep <= 0) return;
        long userId;
        try {
            userId = Long.parseLong(ext.substring(0, sep));
        } catch (NumberFormatException e) {
            return;
        }

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
        usuario.setPagamentoOrigem(origem);
        usuario.setUltimoPagamentoMp(paymentId);
        usuarioRepository.save(usuario);
    }

    private String extrairPlanoId(String ext) {
        int sep = ext.indexOf(':');
        if (sep <= 0 || sep >= ext.length() - 1) return null;
        return ext.substring(sep + 1);
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
            return new CatalogoPlano(PRO_ANUAL, "Rei da Pelada Pro anual", new BigDecimal("349.90"), 365);
        }
        if (PRO_MENSAL_RECORRENTE.equals(planoId)) {
            return new CatalogoPlano(PRO_MENSAL_RECORRENTE, "Rei da Pelada Pro mensal (cartão)", new BigDecimal("49.90"), 30);
        }
        if (PRO_MENSAL.equals(planoId) || planoId == null || planoId.isBlank()) {
            return new CatalogoPlano(PRO_MENSAL, "Rei da Pelada Pro mensal (Pix)", new BigDecimal("49.90"), 30);
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

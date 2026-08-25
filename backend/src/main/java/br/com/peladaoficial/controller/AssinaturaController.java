package br.com.peladaoficial.controller;

import br.com.peladaoficial.dto.CheckoutRequest;
import br.com.peladaoficial.model.Usuario;
import br.com.peladaoficial.security.AuthSupport;
import br.com.peladaoficial.service.AssinaturaService;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api")
public class AssinaturaController {

    private final AssinaturaService assinaturaService;
    private final AuthSupport authSupport;

    public AssinaturaController(AssinaturaService assinaturaService, AuthSupport authSupport) {
        this.assinaturaService = assinaturaService;
        this.authSupport = authSupport;
    }

    @GetMapping("/planos")
    public List<Map<String, Object>> planos() {
        return assinaturaService.catalogo();
    }

    @PostMapping("/assinatura/checkout")
    public Map<String, Object> checkout(@RequestBody(required = false) CheckoutRequest request) {
        Usuario u = authSupport.usuarioAtual();
        String planoId = request != null ? request.getPlanoId() : null;
        return assinaturaService.criarCheckout(u, planoId);
    }

    @RequestMapping(value = "/assinatura/webhook", method = {RequestMethod.GET, RequestMethod.POST})
    public Map<String, String> webhook(@RequestParam(value = "data.id", required = false) String dataId,
                                       @RequestParam(value = "id", required = false) String id,
                                       @RequestBody(required = false) Map<String, Object> body) {
        String paymentId = dataId != null ? dataId : id;
        if (paymentId == null && body != null) {
            Object data = body.get("data");
            if (data instanceof Map<?, ?> mapa && mapa.get("id") != null) {
                paymentId = String.valueOf(mapa.get("id"));
            }
        }
        if (paymentId != null) {
            try {
                String type = body != null ? String.valueOf(body.getOrDefault("type", "")) : "";
                String action = body != null ? String.valueOf(body.getOrDefault("action", "")) : "";
                if (type.contains("subscription") || type.contains("preapproval")
                        || action.contains("subscription") || action.contains("preapproval")) {
                    assinaturaService.processarAssinatura(paymentId);
                } else {
                    assinaturaService.processarNotificacao(paymentId);
                }
            } catch (Exception ignored) {
                /* MP reenvia se falhar; não devolve 500 para payload estranho */
            }
        }
        return Map.of("ok", "true");
    }
}

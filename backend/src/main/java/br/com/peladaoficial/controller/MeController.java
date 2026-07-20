package br.com.peladaoficial.controller;

import br.com.peladaoficial.model.Usuario;
import br.com.peladaoficial.security.AuthSupport;
import br.com.peladaoficial.security.JwtService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpHeaders;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashMap;
import java.util.Map;

@RestController
@RequestMapping("/api")
public class MeController {

    private final AuthSupport authSupport;
    private final JwtService jwtService;

    public MeController(AuthSupport authSupport, JwtService jwtService) {
        this.authSupport = authSupport;
        this.jwtService = jwtService;
    }

    @GetMapping("/me")
    public Map<String, Object> me() {
        Usuario u = authSupport.usuarioAtual();
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("id", u.getId());
        map.put("nome", u.getNome());
        map.put("email", u.getEmail());
        return map;
    }

    /** Diagnóstico: o que o servidor vê no token (sem exigir login). */
    @GetMapping("/debug-auth")
    public Map<String, Object> debugAuth(HttpServletRequest request) {
        Map<String, Object> map = new LinkedHashMap<>();
        String header = request.getHeader(HttpHeaders.AUTHORIZATION);
        map.put("hasAuthorizationHeader", header != null);
        map.put("authorizationPrefix", header != null && header.length() > 12 ? header.substring(0, 12) : header);

        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        map.put("securityAuth", auth != null ? auth.getClass().getSimpleName() : null);
        map.put("principalType", auth != null && auth.getPrincipal() != null
                ? auth.getPrincipal().getClass().getSimpleName() : null);

        if (header != null && header.startsWith("Bearer ")) {
            String token = header.substring(7);
            map.put("tokenLength", token.length());
            map.put("jwtValido", jwtService.valido(token));
            try {
                map.put("usuarioId", jwtService.extrairUsuarioId(token));
            } catch (Exception e) {
                map.put("jwtErro", e.getClass().getSimpleName() + ": " + e.getMessage());
            }
        }
        return map;
    }
}

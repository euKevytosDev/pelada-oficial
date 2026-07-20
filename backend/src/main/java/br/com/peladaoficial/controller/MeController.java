package br.com.peladaoficial.controller;

import br.com.peladaoficial.model.Usuario;
import br.com.peladaoficial.security.AuthSupport;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashMap;
import java.util.Map;

@RestController
@RequestMapping("/api")
public class MeController {

    private final AuthSupport authSupport;

    public MeController(AuthSupport authSupport) {
        this.authSupport = authSupport;
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
}

package br.com.peladaoficial.security;

import br.com.peladaoficial.model.Usuario;
import br.com.peladaoficial.repository.UsuarioRepository;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

/**
 * Helper para pegar o usuário logado nos services.
 * O filtro JWT só valida o token; o banco é consultado aqui (com retry leve).
 */
@Component
public class AuthSupport {

    private final UsuarioRepository usuarioRepository;

    public AuthSupport(UsuarioRepository usuarioRepository) {
        this.usuarioRepository = usuarioRepository;
    }

    public Usuario usuarioAtual() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || auth.getPrincipal() == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Faça login para continuar");
        }

        Long usuarioId = extrairId(auth.getPrincipal());
        if (usuarioId == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Faça login para continuar");
        }

        Exception ultimo = null;
        for (int i = 0; i < 3; i++) {
            try {
                return usuarioRepository.findById(usuarioId)
                        .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Faça login para continuar"));
            } catch (ResponseStatusException e) {
                throw e;
            } catch (Exception e) {
                ultimo = e;
                try {
                    Thread.sleep(200L * (i + 1));
                } catch (InterruptedException ie) {
                    Thread.currentThread().interrupt();
                    break;
                }
            }
        }
        throw new ResponseStatusException(
                HttpStatus.SERVICE_UNAVAILABLE,
                "Banco oscilou. Toque de novo em Continuar.",
                ultimo
        );
    }

    private Long extrairId(Object principal) {
        if (principal instanceof UsuarioPrincipal up) {
            return up.id();
        }
        if (principal instanceof Usuario u) {
            return u.getId();
        }
        return null;
    }
}

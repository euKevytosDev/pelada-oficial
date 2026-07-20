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
 * O id vem do JWT. Consulta ao banco é opcional (não pode derrubar gol/cartão no meio do jogo).
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

        // Preferência: carregar do banco; se Neon oscilar, segue só com o id do token
        for (int i = 0; i < 2; i++) {
            try {
                return usuarioRepository.findById(usuarioId)
                        .orElseGet(() -> stub(usuarioId, auth.getPrincipal()));
            } catch (Exception ignored) {
                try {
                    Thread.sleep(120L * (i + 1));
                } catch (InterruptedException ie) {
                    Thread.currentThread().interrupt();
                    break;
                }
            }
        }
        return stub(usuarioId, auth.getPrincipal());
    }

    private Usuario stub(Long id, Object principal) {
        String email = principal instanceof UsuarioPrincipal up ? up.email() : null;
        Usuario u = new Usuario();
        u.setId(id);
        u.setEmail(email != null ? email : "usuario@" + id + ".local");
        u.setNome("Usuario");
        u.setSenhaHash("!");
        return u;
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

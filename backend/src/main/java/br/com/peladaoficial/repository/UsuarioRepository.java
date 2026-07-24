package br.com.peladaoficial.repository;

import br.com.peladaoficial.model.Usuario;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface UsuarioRepository extends JpaRepository<Usuario, Long> {
    Optional<Usuario> findByEmailIgnoreCase(String email);
    Optional<Usuario> findByGoogleId(String googleId);
    boolean existsByEmailIgnoreCase(String email);
}

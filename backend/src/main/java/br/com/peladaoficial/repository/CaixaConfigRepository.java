package br.com.peladaoficial.repository;

import br.com.peladaoficial.model.CaixaConfig;
import br.com.peladaoficial.model.Usuario;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface CaixaConfigRepository extends JpaRepository<CaixaConfig, Long> {
    Optional<CaixaConfig> findByUsuario(Usuario usuario);
}

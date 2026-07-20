package br.com.peladaoficial.repository;

import br.com.peladaoficial.model.Pelada;
import br.com.peladaoficial.model.StatusPelada;
import br.com.peladaoficial.model.Usuario;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface PeladaRepository extends JpaRepository<Pelada, Long> {
    List<Pelada> findByUsuarioOrderByCriadaEmDesc(Usuario usuario);

    Optional<Pelada> findFirstByUsuarioAndStatusInOrderByCriadaEmDesc(
            Usuario usuario, List<StatusPelada> status);

    Optional<Pelada> findByIdAndUsuario(Long id, Usuario usuario);
}

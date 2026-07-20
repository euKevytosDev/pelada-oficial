package br.com.peladaoficial.repository;

import br.com.peladaoficial.model.Pelada;
import br.com.peladaoficial.model.StatusPelada;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface PeladaRepository extends JpaRepository<Pelada, Long> {
    List<Pelada> findByStatusOrderByCriadaEmDesc(StatusPelada status);
    Optional<Pelada> findFirstByStatusOrderByCriadaEmDesc(StatusPelada status);
}

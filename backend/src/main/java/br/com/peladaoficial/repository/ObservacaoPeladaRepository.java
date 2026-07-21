package br.com.peladaoficial.repository;

import br.com.peladaoficial.model.ObservacaoPelada;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ObservacaoPeladaRepository extends JpaRepository<ObservacaoPelada, Long> {
    List<ObservacaoPelada> findByPeladaIdOrderByCriadaEmAsc(Long peladaId);

    Optional<ObservacaoPelada> findByIdAndPeladaId(Long id, Long peladaId);

    void deleteByPeladaId(Long peladaId);
}

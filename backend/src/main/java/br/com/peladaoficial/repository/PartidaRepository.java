package br.com.peladaoficial.repository;

import br.com.peladaoficial.model.Partida;
import br.com.peladaoficial.model.StatusPartida;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface PartidaRepository extends JpaRepository<Partida, Long> {
    List<Partida> findByPeladaIdOrderByNumeroRodadaDesc(Long peladaId);
    Optional<Partida> findFirstByPeladaIdAndStatusOrderByNumeroRodadaDesc(Long peladaId, StatusPartida status);
    long countByPeladaId(Long peladaId);
}

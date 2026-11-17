package br.com.peladaoficial.repository;

import br.com.peladaoficial.model.Partida;
import br.com.peladaoficial.model.StatusPartida;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface PartidaRepository extends JpaRepository<Partida, Long> {
    List<Partida> findByPeladaIdOrderByNumeroRodadaDesc(Long peladaId);
    Optional<Partida> findFirstByPeladaIdAndStatusOrderByNumeroRodadaDesc(Long peladaId, StatusPartida status);
    long countByPeladaId(Long peladaId);

    @Modifying(clearAutomatically = true)
    @Query("DELETE FROM Partida p WHERE p.pelada.id = :peladaId")
    int deleteByPeladaId(@Param("peladaId") Long peladaId);
}

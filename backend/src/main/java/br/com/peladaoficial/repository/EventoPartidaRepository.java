package br.com.peladaoficial.repository;

import br.com.peladaoficial.model.EventoPartida;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface EventoPartidaRepository extends JpaRepository<EventoPartida, Long> {
    List<EventoPartida> findByPartidaIdOrderByOcorridoEmAsc(Long partidaId);

    java.util.Optional<EventoPartida> findByPartidaIdAndClientLanceId(Long partidaId, String clientLanceId);

    @Modifying(clearAutomatically = true)
    @Query("DELETE FROM EventoPartida e WHERE e.partida.pelada.id = :peladaId")
    int deleteByPeladaId(@Param("peladaId") Long peladaId);
}

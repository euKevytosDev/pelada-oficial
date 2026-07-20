package br.com.peladaoficial.repository;

import br.com.peladaoficial.model.EventoPartida;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface EventoPartidaRepository extends JpaRepository<EventoPartida, Long> {
    List<EventoPartida> findByPartidaIdOrderByOcorridoEmAsc(Long partidaId);
}

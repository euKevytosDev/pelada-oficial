package br.com.peladaoficial.repository;

import br.com.peladaoficial.model.Time;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface TimeRepository extends JpaRepository<Time, Long> {
    /** Classificação: mais pontos primeiro; empate → ordem de criação (Time A, B, C...). */
    List<Time> findByPeladaIdOrderByPontosDescIdAsc(Long peladaId);
}

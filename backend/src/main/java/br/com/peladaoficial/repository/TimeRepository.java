package br.com.peladaoficial.repository;

import br.com.peladaoficial.model.Time;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface TimeRepository extends JpaRepository<Time, Long> {
    /** Classificação: mais pontos primeiro; empate → ordem de criação (Time A, B, C...). */
    List<Time> findByPeladaIdOrderByPontosDescIdAsc(Long peladaId);

    long countByPeladaId(Long peladaId);

    @Modifying(clearAutomatically = true)
    @Query("DELETE FROM Time t WHERE t.pelada.id = :peladaId")
    int deleteByPeladaId(@Param("peladaId") Long peladaId);
}

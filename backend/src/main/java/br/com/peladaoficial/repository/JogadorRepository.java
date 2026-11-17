package br.com.peladaoficial.repository;

import br.com.peladaoficial.model.Jogador;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface JogadorRepository extends JpaRepository<Jogador, Long> {
    List<Jogador> findByPeladaIdOrderByNomeAsc(Long peladaId);

    long countByPeladaId(Long peladaId);

    @Modifying(clearAutomatically = true)
    @Query("UPDATE Jogador j SET j.time = null WHERE j.pelada.id = :peladaId")
    int clearTimeByPeladaId(@Param("peladaId") Long peladaId);

    @Modifying(clearAutomatically = true)
    @Query("DELETE FROM Jogador j WHERE j.pelada.id = :peladaId")
    int deleteByPeladaId(@Param("peladaId") Long peladaId);
}

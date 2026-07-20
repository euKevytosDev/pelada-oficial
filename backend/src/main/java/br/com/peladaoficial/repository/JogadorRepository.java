package br.com.peladaoficial.repository;

import br.com.peladaoficial.model.Jogador;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface JogadorRepository extends JpaRepository<Jogador, Long> {
    List<Jogador> findByPeladaIdOrderByNomeAsc(Long peladaId);
}

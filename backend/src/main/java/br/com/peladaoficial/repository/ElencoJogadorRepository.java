package br.com.peladaoficial.repository;

import br.com.peladaoficial.model.ElencoJogador;
import br.com.peladaoficial.model.Usuario;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ElencoJogadorRepository extends JpaRepository<ElencoJogador, Long> {
    List<ElencoJogador> findByUsuarioOrderByGoleiroAscNomeAsc(Usuario usuario);
    void deleteByUsuario(Usuario usuario);
}

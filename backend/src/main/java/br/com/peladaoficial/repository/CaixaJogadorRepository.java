package br.com.peladaoficial.repository;

import br.com.peladaoficial.model.CaixaJogador;
import br.com.peladaoficial.model.Usuario;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface CaixaJogadorRepository extends JpaRepository<CaixaJogador, Long> {
    Optional<CaixaJogador> findByUsuarioAndChave(Usuario usuario, String chave);
    Optional<CaixaJogador> findByIdAndUsuario(Long id, Usuario usuario);
    List<CaixaJogador> findByUsuarioOrderByNomeAsc(Usuario usuario);
}

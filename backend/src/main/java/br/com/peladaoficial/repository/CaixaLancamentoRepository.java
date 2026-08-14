package br.com.peladaoficial.repository;

import br.com.peladaoficial.model.CaixaJogador;
import br.com.peladaoficial.model.CaixaLancamento;
import br.com.peladaoficial.model.Usuario;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface CaixaLancamentoRepository extends JpaRepository<CaixaLancamento, Long> {
    List<CaixaLancamento> findByUsuarioAndCompetencia(Usuario usuario, String competencia);
    List<CaixaLancamento> findByUsuarioAndJogadorAndCompetencia(Usuario usuario, CaixaJogador jogador, String competencia);
    Optional<CaixaLancamento> findFirstByUsuarioAndJogadorAndCompetenciaAndTipoOrderByCriadoEmDesc(
            Usuario usuario, CaixaJogador jogador, String competencia, String tipo);
}

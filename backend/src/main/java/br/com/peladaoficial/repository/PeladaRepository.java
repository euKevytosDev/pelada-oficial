package br.com.peladaoficial.repository;

import br.com.peladaoficial.model.Pelada;
import br.com.peladaoficial.model.StatusPelada;
import br.com.peladaoficial.model.Usuario;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface PeladaRepository extends JpaRepository<Pelada, Long> {
    List<Pelada> findByUsuarioOrderByCriadaEmDesc(Usuario usuario);

    /** Só peladas do período (usa encerradaEm, senão criadaEm) — evita carregar o histórico inteiro na caixa. */
    @Query("""
            select p from Pelada p
            where p.usuario = :usuario
              and coalesce(p.encerradaEm, p.criadaEm) >= :inicio
              and coalesce(p.encerradaEm, p.criadaEm) < :fim
            order by coalesce(p.encerradaEm, p.criadaEm) desc
            """)
    List<Pelada> findByUsuarioNoPeriodo(@Param("usuario") Usuario usuario,
                                        @Param("inicio") LocalDateTime inicio,
                                        @Param("fim") LocalDateTime fim);

    Optional<Pelada> findFirstByUsuarioAndStatusInOrderByCriadaEmDesc(
            Usuario usuario, List<StatusPelada> status);

    List<Pelada> findByUsuarioAndStatusInOrderByCriadaEmDesc(
            Usuario usuario, List<StatusPelada> status);

    Optional<Pelada> findByIdAndUsuario(Long id, Usuario usuario);
}

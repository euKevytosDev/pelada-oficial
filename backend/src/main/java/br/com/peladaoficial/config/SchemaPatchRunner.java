package br.com.peladaoficial.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * Garante colunas novas em produção (Neon) quando ddl-auto=update não aplicou a tempo.
 */
@Component
public class SchemaPatchRunner implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(SchemaPatchRunner.class);

    private final JdbcTemplate jdbc;

    public SchemaPatchRunner(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    public void run(ApplicationArguments args) {
        try {
            jdbc.execute("""
                ALTER TABLE jogadores
                ADD COLUMN IF NOT EXISTS apto boolean NOT NULL DEFAULT true
                """);
            log.info("Schema OK: coluna jogadores.apto verificada");

            jdbc.execute("""
                ALTER TABLE eventos_partida
                ADD COLUMN IF NOT EXISTS client_lance_id varchar(80)
                """);
            try {
                jdbc.execute("""
                    CREATE UNIQUE INDEX IF NOT EXISTS uk_evento_partida_client_lance
                    ON eventos_partida (partida_id, client_lance_id)
                    WHERE client_lance_id IS NOT NULL
                    """);
            } catch (Exception ignored) {
                // H2 pode não aceitar índice parcial
            }
            log.info("Schema OK: coluna eventos_partida.client_lance_id verificada");

            jdbc.execute("""
                ALTER TABLE eventos_partida
                ADD COLUMN IF NOT EXISTS assistencia_id bigint
                """);
            log.info("Schema OK: coluna eventos_partida.assistencia_id verificada");
        } catch (Exception e) {
            // H2 em alguns modos pode não aceitar IF NOT EXISTS da mesma forma — não derruba o app
            log.warn("Não foi possível garantir colunas de schema: {}", e.getMessage());
        }
    }
}

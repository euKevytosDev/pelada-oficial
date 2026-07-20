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
        } catch (Exception e) {
            // H2 em alguns modos pode não aceitar IF NOT EXISTS da mesma forma — não derruba o app
            log.warn("Não foi possível garantir coluna apto: {}", e.getMessage());
        }
    }
}

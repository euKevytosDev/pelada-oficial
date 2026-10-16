package br.com.peladaoficial.controller;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Health público para UptimeRobot (sem login).
 * Faz SELECT 1 no Postgres para o Free do Supabase não pausar por inatividade.
 */
@RestController
public class HealthController {

    private final JdbcTemplate jdbc;

    public HealthController(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @GetMapping({"/api/health", "/health"})
    public Map<String, String> health() {
        Map<String, String> body = new LinkedHashMap<>();
        body.put("app", "pelada-oficial");
        try {
            Integer one = jdbc.queryForObject("SELECT 1", Integer.class);
            body.put("status", one != null && one == 1 ? "UP" : "DEGRADED");
            body.put("db", "UP");
        } catch (Exception e) {
            body.put("status", "DEGRADED");
            body.put("db", "DOWN");
        }
        return body;
    }
}

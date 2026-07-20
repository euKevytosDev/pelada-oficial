package br.com.peladaoficial.controller;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * Health público para UptimeRobot / Render (sem login).
 */
@RestController
public class HealthController {

    @GetMapping({"/api/health", "/health"})
    public Map<String, String> health() {
        return Map.of("status", "UP", "app", "pelada-oficial");
    }
}

package br.com.peladaoficial.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;

/**
 * Gera e valida o token JWT do login.
 */
@Component
public class JwtService {

    private final SecretKey key;
    private final long expiracaoMs;

    public JwtService(
            @Value("${app.jwt.secret:pelada-oficial-segredo-dev-mude-em-producao-123456}") String secret,
            @Value("${app.jwt.expiration-ms:604800000}") long expiracaoMs) {
        // precisa ter tamanho suficiente para HS256
        this.key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
        this.expiracaoMs = expiracaoMs;
    }

    public String gerarToken(Long usuarioId, String email) {
        Date agora = new Date();
        Date expira = new Date(agora.getTime() + expiracaoMs);
        return Jwts.builder()
                .subject(String.valueOf(usuarioId))
                .claim("email", email)
                .issuedAt(agora)
                .expiration(expira)
                .signWith(key)
                .compact();
    }

    public Long extrairUsuarioId(String token) {
        return Long.valueOf(parse(token).getSubject());
    }

    public String extrairEmail(String token) {
        Object email = parse(token).get("email");
        return email != null ? String.valueOf(email) : null;
    }

    public boolean valido(String token) {
        try {
            parse(token);
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    private Claims parse(String token) {
        return Jwts.parser()
                .verifyWith(key)
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }
}

package br.com.peladaoficial.security;

/**
 * Identidade autenticada só pelo JWT (sem consulta ao banco no filtro).
 */
public record UsuarioPrincipal(Long id, String email) {
}

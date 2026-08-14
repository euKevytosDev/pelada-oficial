package br.com.peladaoficial.service;

import br.com.peladaoficial.dto.CadastroRequest;
import br.com.peladaoficial.dto.GoogleLoginRequest;
import br.com.peladaoficial.dto.LoginRequest;
import br.com.peladaoficial.model.Usuario;
import br.com.peladaoficial.repository.UsuarioRepository;
import br.com.peladaoficial.security.JwtService;
import com.google.api.client.googleapis.auth.oauth2.GoogleIdToken;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.Map;

@Service
public class AuthService {

    private final UsuarioRepository usuarioRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final GoogleTokenVerifier googleTokenVerifier;
    private final AssinaturaService assinaturaService;

    public AuthService(UsuarioRepository usuarioRepository,
                       PasswordEncoder passwordEncoder,
                       JwtService jwtService,
                       GoogleTokenVerifier googleTokenVerifier,
                       AssinaturaService assinaturaService) {
        this.usuarioRepository = usuarioRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
        this.googleTokenVerifier = googleTokenVerifier;
        this.assinaturaService = assinaturaService;
    }

    @Transactional
    public Map<String, Object> cadastrar(CadastroRequest request) {
        String email = request.getEmail().trim().toLowerCase();
        if (usuarioRepository.existsByEmailIgnoreCase(email)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "E-mail já cadastrado");
        }

        Usuario usuario = new Usuario(
                email,
                request.getNome().trim(),
                passwordEncoder.encode(request.getSenha())
        );
        usuarioRepository.save(usuario);
        return respostaAuth(usuario);
    }

    @Transactional(readOnly = true)
    public Map<String, Object> login(LoginRequest request) {
        String email = request.getEmail().trim().toLowerCase();
        Usuario usuario = usuarioRepository.findByEmailIgnoreCase(email)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "E-mail ou senha inválidos"));

        if (usuario.getSenhaHash() == null || usuario.getSenhaHash().isBlank()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Esta conta usa login com Google");
        }

        if (!passwordEncoder.matches(request.getSenha(), usuario.getSenhaHash())) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "E-mail ou senha inválidos");
        }
        return respostaAuth(usuario);
    }

    @Transactional
    public Map<String, Object> loginGoogle(GoogleLoginRequest request) {
        GoogleIdToken.Payload payload = googleTokenVerifier.verificar(request.getIdToken());
        String googleId = payload.getSubject();
        String email = payload.getEmail().trim().toLowerCase();
        String nome = nomeDoPayload(payload);

        Usuario usuario = usuarioRepository.findByGoogleId(googleId).orElse(null);
        if (usuario == null) {
            usuario = usuarioRepository.findByEmailIgnoreCase(email).orElse(null);
            if (usuario != null) {
                usuario.setGoogleId(googleId);
                if (usuario.getNome() == null || usuario.getNome().isBlank()) {
                    usuario.setNome(nome);
                }
            } else {
                usuario = new Usuario(email, nome, null);
                usuario.setGoogleId(googleId);
            }
            usuarioRepository.save(usuario);
        }

        return respostaAuth(usuario);
    }

    private static String nomeDoPayload(GoogleIdToken.Payload payload) {
        Object name = payload.get("name");
        if (name != null && !String.valueOf(name).isBlank()) {
            String n = String.valueOf(name).trim();
            return n.length() > 80 ? n.substring(0, 80) : n;
        }
        String email = payload.getEmail();
        int at = email.indexOf('@');
        String base = at > 0 ? email.substring(0, at) : email;
        return base.length() > 80 ? base.substring(0, 80) : base;
    }

    private Map<String, Object> respostaAuth(Usuario usuario) {
        Map<String, Object> user = new LinkedHashMap<>();
        user.put("id", usuario.getId());
        user.put("nome", usuario.getNome());
        user.put("email", usuario.getEmail());
        user.put("assinatura", assinaturaService.garantirTrialEMap(usuario));

        Map<String, Object> body = new HashMap<>();
        body.put("token", jwtService.gerarToken(usuario.getId(), usuario.getEmail()));
        body.put("usuario", user);
        return body;
    }
}

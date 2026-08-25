package br.com.peladaoficial.model;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

/**
 * Conta do organizador da pelada (SaaS / login).
 * Pode ter senha (e-mail) e/ou googleId (login Google).
 */
@Entity
@Table(name = "usuarios")
@Getter
@Setter
@NoArgsConstructor
public class Usuario {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 80)
    private String email;

    @Column(nullable = false, length = 80)
    private String nome;

    /** Null quando a conta entrou só pelo Google. */
    @Column(length = 200)
    private String senhaHash;

    @Column(unique = true, length = 64)
    private String googleId;

    @Column(nullable = false)
    private LocalDateTime criadoEm = LocalDateTime.now();

    @Column(length = 20)
    private String plano = "GRATIS";

    private LocalDateTime planoExpiraEm;

    private LocalDateTime trialInicio;

    @Column(length = 20)
    private String pagamentoOrigem;

    @Column(length = 80)
    private String ultimoPagamentoMp;

    /** ID da assinatura recorrente no Mercado Pago (preapproval). */
    @Column(length = 80)
    private String mpPreapprovalId;

    public Usuario(String email, String nome, String senhaHash) {
        this.email = email;
        this.nome = nome;
        this.senhaHash = senhaHash;
    }
}

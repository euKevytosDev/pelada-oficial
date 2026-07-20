package br.com.peladaoficial.model;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Jogador cadastrado na pelada.
 * "estrelas" = nível de 1 a 5 (usado no sorteio equilibrado).
 */
@Entity
@Table(name = "jogadores")
@Getter
@Setter
@NoArgsConstructor
public class Jogador {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 80)
    private String nome;

    /** Nível do jogador: 1 (mais fraco) até 5 (mais forte). */
    @Column(nullable = false)
    private Integer estrelas = 3;

    /** Pontos acumulados na pelada (vitória 3, empate 1, derrota 0). */
    @Column(nullable = false)
    private Integer pontos = 0;

    @Column(nullable = false)
    private Integer gols = 0;

    @Column(nullable = false)
    private Integer assistencias = 0;

    @Column(nullable = false)
    private Integer cartoesAmarelos = 0;

    @Column(nullable = false)
    private Integer cartoesVermelhos = 0;

    @Column(nullable = false)
    private Integer golsSofridos = 0;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "pelada_id")
    private Pelada pelada;

    /** Time atual do jogador (preenchido depois do sorteio). */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "time_id")
    private Time time;

    public Jogador(String nome, Integer estrelas, Pelada pelada) {
        this.nome = nome;
        this.estrelas = estrelas;
        this.pelada = pelada;
    }
}

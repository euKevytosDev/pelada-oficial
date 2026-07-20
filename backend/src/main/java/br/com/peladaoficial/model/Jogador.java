package br.com.peladaoficial.model;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Jogador ou goleiro cadastrado na pelada.
 * Estrelas = nível de 1 a 10 (goleiros usam 0).
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

    /** Nível do jogador de linha: 1 a 10. Goleiro fica 0. */
    @Column(nullable = false)
    private Integer estrelas = 3;

    /** Se true, é goleiro fixo (não entra no sorteio de linha). */
    @Column(nullable = false)
    private Boolean goleiro = false;

    @Column(nullable = false)
    private Integer pontos = 0;

    @Column(nullable = false)
    private Integer gols = 0;

    /** Gols contra (próprios). */
    @Column(nullable = false)
    private Integer golsContra = 0;

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

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "time_id")
    private Time time;

    public Jogador(String nome, Integer estrelas, boolean goleiro, Pelada pelada) {
        this.nome = nome;
        this.estrelas = goleiro ? 0 : estrelas;
        this.goleiro = goleiro;
        this.pelada = pelada;
    }
}

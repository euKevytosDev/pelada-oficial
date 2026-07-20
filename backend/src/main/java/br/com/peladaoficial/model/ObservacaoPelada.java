package br.com.peladaoficial.model;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

/**
 * Observação da súmula (ex.: atraso de jogador com horário).
 */
@Entity
@Table(name = "observacoes_pelada")
@Getter
@Setter
@NoArgsConstructor
public class ObservacaoPelada {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "pelada_id")
    private Pelada pelada;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "jogador_id")
    private Jogador jogador;

    @Column(nullable = false, length = 30)
    private String tipo = "ATRASO";

    /** Horário informado (ex.: 19:15). */
    @Column(length = 10)
    private String horario;

    @Column(length = 200)
    private String texto;

    @Column(nullable = false)
    private LocalDateTime criadaEm = LocalDateTime.now();

    public ObservacaoPelada(Pelada pelada, Jogador jogador, String tipo, String horario, String texto) {
        this.pelada = pelada;
        this.jogador = jogador;
        this.tipo = tipo != null ? tipo : "ATRASO";
        this.horario = horario;
        this.texto = texto;
    }
}

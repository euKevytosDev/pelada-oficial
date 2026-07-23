package br.com.peladaoficial.model;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

/**
 * Evento ao vivo: gol, cartão amarelo ou vermelho.
 */
@Entity
@Table(name = "eventos_partida")
@Getter
@Setter
@NoArgsConstructor
public class EventoPartida {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private TipoEvento tipo;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "partida_id")
    private Partida partida;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "time_id")
    private Time time;

    /** Quem fez o gol / tomou o cartão. */
    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "jogador_id")
    private Jogador jogador;

    /** Goleiro que sofreu o gol (só quando tipo = GOL). */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "goleiro_id")
    private Jogador goleiro;

    /** Quem deu a assistência (opcional, só em GOL). */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "assistencia_id")
    private Jogador assistencia;

    @Column(nullable = false)
    private LocalDateTime ocorridoEm = LocalDateTime.now();

    /**
     * Id gerado no celular para não duplicar gol quando o sync tenta de novo.
     */
    @Column(length = 80)
    private String clientLanceId;

    public EventoPartida(TipoEvento tipo, Partida partida, Time time, Jogador jogador, Jogador goleiro) {
        this.tipo = tipo;
        this.partida = partida;
        this.time = time;
        this.jogador = jogador;
        this.goleiro = goleiro;
    }

    public EventoPartida(TipoEvento tipo, Partida partida, Time time, Jogador jogador, Jogador goleiro, Jogador assistencia) {
        this(tipo, partida, time, jogador, goleiro);
        this.assistencia = assistencia;
    }
}

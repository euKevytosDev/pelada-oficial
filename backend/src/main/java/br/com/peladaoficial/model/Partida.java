package br.com.peladaoficial.model;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * Uma partida (rodada) entre dois times.
 * Vitória = 3 pontos, empate = 1 para cada, derrota = 0.
 */
@Entity
@Table(name = "partidas")
@Getter
@Setter
@NoArgsConstructor
public class Partida {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Número da rodada (1, 2, 3...). */
    @Column(nullable = false)
    private Integer numeroRodada;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "pelada_id")
    private Pelada pelada;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "time_a_id")
    private Time timeA;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "time_b_id")
    private Time timeB;

    @Column(nullable = false)
    private Integer golsTimeA = 0;

    @Column(nullable = false)
    private Integer golsTimeB = 0;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private StatusPartida status = StatusPartida.EM_ANDAMENTO;

    @Column(nullable = false)
    private LocalDateTime iniciadaEm = LocalDateTime.now();

    private LocalDateTime finalizadaEm;

    @OneToMany(mappedBy = "partida", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<EventoPartida> eventos = new ArrayList<>();
}

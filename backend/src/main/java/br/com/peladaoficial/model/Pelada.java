package br.com.peladaoficial.model;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * Uma sessão de pelada (do cadastro até "Encerrar pelada").
 */
@Entity
@Table(name = "peladas")
@Getter
@Setter
@NoArgsConstructor
public class Pelada {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 100)
    private String nome = "Pelada Oficial";

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private StatusPelada status = StatusPelada.AGUARDANDO;

    /** Quantos times serão formados no sorteio. */
    @Column(nullable = false)
    private Integer quantidadeTimes = 2;

    @Column(nullable = false)
    private LocalDateTime criadaEm = LocalDateTime.now();

    private LocalDateTime encerradaEm;

    @OneToMany(mappedBy = "pelada", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<Jogador> jogadores = new ArrayList<>();

    @OneToMany(mappedBy = "pelada", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<Time> times = new ArrayList<>();

    @OneToMany(mappedBy = "pelada", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<Partida> partidas = new ArrayList<>();
}

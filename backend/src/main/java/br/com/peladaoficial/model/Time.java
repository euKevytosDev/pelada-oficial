package br.com.peladaoficial.model;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;

/**
 * Time formado no sorteio.
 * Se o nome não for definido manualmente, usa o jogador de linha com mais estrelas.
 */
@Entity
@Table(name = "times")
@Getter
@Setter
@NoArgsConstructor
public class Time {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 40)
    private String nome;

    /** true = usuário escolheu o nome; false = nome automático pelo jogador mais estrelado. */
    @Column(nullable = false)
    private Boolean nomeManual = false;

    @Column(nullable = false, length = 20)
    private String cor = "#1B5E20";

    @Column(nullable = false)
    private Integer pontos = 0;

    @Column(nullable = false)
    private Integer vitorias = 0;

    @Column(nullable = false)
    private Integer empates = 0;

    @Column(nullable = false)
    private Integer derrotas = 0;

    @Column(nullable = false)
    private Integer golsPro = 0;

    @Column(nullable = false)
    private Integer golsContra = 0;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "pelada_id")
    private Pelada pelada;

    @OneToMany(mappedBy = "time")
    private List<Jogador> jogadores = new ArrayList<>();

    public Time(String nome, String cor, Pelada pelada) {
        this.nome = nome;
        this.cor = cor;
        this.pelada = pelada;
    }

    public int getTotalEstrelas() {
        return jogadores.stream()
                .filter(j -> !Boolean.TRUE.equals(j.getGoleiro()))
                .mapToInt(Jogador::getEstrelas)
                .sum();
    }

    public Optional<Jogador> getJogadorMaisEstrelado() {
        return jogadores.stream()
                .filter(j -> !Boolean.TRUE.equals(j.getGoleiro()))
                .max(Comparator.comparingInt(Jogador::getEstrelas)
                        .thenComparing(Jogador::getNome));
    }

    public Optional<Jogador> getGoleiroDoTime() {
        return jogadores.stream()
                .filter(j -> Boolean.TRUE.equals(j.getGoleiro()))
                .findFirst();
    }

    /** Atualiza o nome automático se o usuário não definiu manualmente. */
    public void atualizarNomeAutomaticoSePreciso() {
        if (Boolean.TRUE.equals(nomeManual)) {
            return;
        }
        getJogadorMaisEstrelado().ifPresent(j -> this.nome = j.getNome());
    }
}

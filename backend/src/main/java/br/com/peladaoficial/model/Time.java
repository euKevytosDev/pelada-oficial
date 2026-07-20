package br.com.peladaoficial.model;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.ArrayList;
import java.util.List;

/**
 * Time formado no sorteio (ex.: Time A, Time B).
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

    /** Cor para mostrar no celular (ex.: #1B5E20). */
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

    /** Soma das estrelas dos jogadores (útil para ver se o sorteio ficou equilibrado). */
    public int getTotalEstrelas() {
        return jogadores.stream().mapToInt(Jogador::getEstrelas).sum();
    }
}

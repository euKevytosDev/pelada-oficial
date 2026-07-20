package br.com.peladaoficial.model;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Jogador/goleiro salvo na conta do usuário (elenco permanente).
 * Depois de encerrar a pelada, o elenco fica pronto para a próxima.
 */
@Entity
@Table(name = "elenco_jogadores")
@Getter
@Setter
@NoArgsConstructor
public class ElencoJogador {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "usuario_id")
    private Usuario usuario;

    @Column(nullable = false, length = 80)
    private String nome;

    @Column(nullable = false)
    private Integer estrelas = 5;

    @Column(nullable = false)
    private Boolean goleiro = false;

    public ElencoJogador(Usuario usuario, String nome, Integer estrelas, boolean goleiro) {
        this.usuario = usuario;
        this.nome = nome;
        this.estrelas = goleiro ? 0 : estrelas;
        this.goleiro = goleiro;
    }
}

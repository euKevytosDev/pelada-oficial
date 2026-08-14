package br.com.peladaoficial.model;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Jogador na caixa do organizador (mensalista, avulso ou isento).
 * A chave sobrevive à troca de IDs do elenco (mesmo nome + goleiro).
 */
@Entity
@Table(
        name = "caixa_jogadores",
        uniqueConstraints = @UniqueConstraint(name = "uk_caixa_jogador_chave", columnNames = {"usuario_id", "chave"})
)
@Getter
@Setter
@NoArgsConstructor
public class CaixaJogador {

    public static final String MENSAL = "MENSAL";
    public static final String AVULSO = "AVULSO";
    public static final String ISENTO = "ISENTO";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "usuario_id")
    private Usuario usuario;

    @Column(nullable = false, length = 90)
    private String chave;

    @Column(nullable = false, length = 80)
    private String nome;

    @Column(nullable = false)
    private Boolean goleiro = false;

    @Column(nullable = false, length = 12)
    private String modalidade = AVULSO;

    public static String chaveDe(String nome, boolean goleiro) {
        String n = nome == null ? "" : nome.trim().toLowerCase();
        return n + "|" + (goleiro ? "1" : "0");
    }
}

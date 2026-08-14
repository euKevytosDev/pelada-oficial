package br.com.peladaoficial.model;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "caixa_lancamentos")
@Getter
@Setter
@NoArgsConstructor
public class CaixaLancamento {

    public static final String COBRANCA = "COBRANCA";
    public static final String PAGAMENTO = "PAGAMENTO";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "usuario_id")
    private Usuario usuario;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "jogador_id")
    private CaixaJogador jogador;

    /** yyyy-MM */
    @Column(nullable = false, length = 7)
    private String competencia;

    @Column(nullable = false, length = 12)
    private String tipo;

    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal valor = BigDecimal.ZERO;

    @Column(nullable = false)
    private LocalDateTime criadoEm = LocalDateTime.now();

    @Column(length = 80)
    private String nota;
}

package br.com.peladaoficial.model;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;

/**
 * Valores padrão da caixa — só o dono da pelada vê.
 */
@Entity
@Table(name = "caixa_config")
@Getter
@Setter
@NoArgsConstructor
public class CaixaConfig {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "usuario_id", unique = true)
    private Usuario usuario;

    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal valorMensal = BigDecimal.ZERO;

    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal valorAvulso = BigDecimal.ZERO;

    public CaixaConfig(Usuario usuario) {
        this.usuario = usuario;
    }
}

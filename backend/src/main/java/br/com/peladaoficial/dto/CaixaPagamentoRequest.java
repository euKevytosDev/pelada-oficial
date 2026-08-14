package br.com.peladaoficial.dto;

import java.math.BigDecimal;

public class CaixaPagamentoRequest {
    private BigDecimal valor;

    public BigDecimal getValor() {
        return valor;
    }

    public void setValor(BigDecimal valor) {
        this.valor = valor;
    }
}

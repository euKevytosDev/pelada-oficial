package br.com.peladaoficial.dto;

import java.math.BigDecimal;

public class CaixaValoresRequest {
    private BigDecimal valorMensal;
    private BigDecimal valorAvulso;

    public BigDecimal getValorMensal() {
        return valorMensal;
    }

    public void setValorMensal(BigDecimal valorMensal) {
        this.valorMensal = valorMensal;
    }

    public BigDecimal getValorAvulso() {
        return valorAvulso;
    }

    public void setValorAvulso(BigDecimal valorAvulso) {
        this.valorAvulso = valorAvulso;
    }
}

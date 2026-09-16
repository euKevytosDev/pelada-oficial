package br.com.peladaoficial.dto;

import jakarta.validation.constraints.Size;

public class ObservacaoRequest {

    private Long jogadorId;

    /** OBSERVACAO (padrão) ou ATRASO (legado). */
    @Size(max = 30)
    private String tipo = "OBSERVACAO";

    /** Legado — não usado na UI atual. */
    @Size(max = 10)
    private String horario;

    @Size(max = 200)
    private String texto;

    public Long getJogadorId() {
        return jogadorId;
    }

    public void setJogadorId(Long jogadorId) {
        this.jogadorId = jogadorId;
    }

    public String getTipo() {
        return tipo;
    }

    public void setTipo(String tipo) {
        this.tipo = tipo;
    }

    public String getHorario() {
        return horario;
    }

    public void setHorario(String horario) {
        this.horario = horario;
    }

    public String getTexto() {
        return texto;
    }

    public void setTexto(String texto) {
        this.texto = texto;
    }
}

package br.com.peladaoficial.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public class ObservacaoRequest {

    @NotNull
    private Long jogadorId;

    /** ATRASO (padrão) ou OUTRO. */
    @Size(max = 30)
    private String tipo = "ATRASO";

    /** Ex.: 19:15 */
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

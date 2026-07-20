package br.com.peladaoficial.dto;

import br.com.peladaoficial.model.TipoEvento;
import jakarta.validation.constraints.NotNull;

public class RegistrarEventoRequest {

    @NotNull
    private TipoEvento tipo;

    @NotNull
    private Long timeId;

    @NotNull
    private Long jogadorId;

    /** Obrigatório quando tipo = GOL (goleiro que sofreu). */
    private Long goleiroId;

    public TipoEvento getTipo() {
        return tipo;
    }

    public void setTipo(TipoEvento tipo) {
        this.tipo = tipo;
    }

    public Long getTimeId() {
        return timeId;
    }

    public void setTimeId(Long timeId) {
        this.timeId = timeId;
    }

    public Long getJogadorId() {
        return jogadorId;
    }

    public void setJogadorId(Long jogadorId) {
        this.jogadorId = jogadorId;
    }

    public Long getGoleiroId() {
        return goleiroId;
    }

    public void setGoleiroId(Long goleiroId) {
        this.goleiroId = goleiroId;
    }
}

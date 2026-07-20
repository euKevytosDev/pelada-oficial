package br.com.peladaoficial.dto;

import jakarta.validation.constraints.NotNull;

/**
 * Move um jogador de linha para outro time (ajuste manual após o sorteio).
 */
public class MoverJogadorRequest {

    @NotNull
    private Long timeDestinoId;

    public Long getTimeDestinoId() {
        return timeDestinoId;
    }

    public void setTimeDestinoId(Long timeDestinoId) {
        this.timeDestinoId = timeDestinoId;
    }
}

package br.com.peladaoficial.dto;

import jakarta.validation.constraints.NotNull;

public class IniciarPartidaRequest {

    @NotNull
    private Long timeAId;

    @NotNull
    private Long timeBId;

    public Long getTimeAId() {
        return timeAId;
    }

    public void setTimeAId(Long timeAId) {
        this.timeAId = timeAId;
    }

    public Long getTimeBId() {
        return timeBId;
    }

    public void setTimeBId(Long timeBId) {
        this.timeBId = timeBId;
    }
}

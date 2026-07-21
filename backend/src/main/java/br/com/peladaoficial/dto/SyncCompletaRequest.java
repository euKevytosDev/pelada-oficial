package br.com.peladaoficial.dto;

import br.com.peladaoficial.model.StatusPartida;
import br.com.peladaoficial.model.TipoEvento;
import lombok.Getter;
import lombok.Setter;

import java.util.List;

/**
 * Snapshot completo produzido pelo cliente offline para reconstruir uma pelada.
 */
@Getter
@Setter
public class SyncCompletaRequest {

    private Boolean encerrar;
    private List<JogadorSync> jogadores;
    private List<TimeSync> times;
    private List<PartidaSync> partidas;
    private List<ObservacaoSync> observacoes;

    @Getter
    @Setter
    public static class JogadorSync {
        private String clientId;
        private String nome;
        private Integer estrelas;
        private Boolean goleiro;
        private Boolean apto;
    }

    @Getter
    @Setter
    public static class TimeSync {
        private String clientId;
        private String nome;
        private String cor;
        private Boolean nomeManual;
        private List<String> jogadorClientIds;
        private Integer pontos;
        private Integer vitorias;
        private Integer empates;
        private Integer derrotas;
        private Integer golsPro;
        private Integer golsContra;
    }

    @Getter
    @Setter
    public static class PartidaSync {
        private String clientId;
        private Integer numeroRodada;
        private String timeAClientId;
        private String timeBClientId;
        private Integer golsTimeA;
        private Integer golsTimeB;
        private StatusPartida status;
        private List<EventoSync> eventos;
    }

    @Getter
    @Setter
    public static class EventoSync {
        private String clientLanceId;
        private TipoEvento tipo;
        private String timeClientId;
        private String jogadorClientId;
        private String goleiroClientId;
    }

    @Getter
    @Setter
    public static class ObservacaoSync {
        private String jogadorClientId;
        private String tipo;
        private String horario;
        private String texto;
    }
}

package br.com.peladaoficial.dto;

import java.util.ArrayList;
import java.util.List;

public class CaixaPresencaRequest {
    private Long peladaId;
    private List<Item> jogadores = new ArrayList<>();

    public Long getPeladaId() {
        return peladaId;
    }

    public void setPeladaId(Long peladaId) {
        this.peladaId = peladaId;
    }

    public List<Item> getJogadores() {
        return jogadores;
    }

    public void setJogadores(List<Item> jogadores) {
        this.jogadores = jogadores;
    }

    public static class Item {
        private String nome;
        private Boolean goleiro;
        /** false = inapto; não entra na cobrança automática do jogo. */
        private Boolean apto;

        public String getNome() {
            return nome;
        }

        public void setNome(String nome) {
            this.nome = nome;
        }

        public Boolean getGoleiro() {
            return goleiro;
        }

        public void setGoleiro(Boolean goleiro) {
            this.goleiro = goleiro;
        }

        public Boolean getApto() {
            return apto;
        }

        public void setApto(Boolean apto) {
            this.apto = apto;
        }
    }
}

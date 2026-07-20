package br.com.peladaoficial.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public class AdicionarJogadorRequest {

    @NotBlank
    @Size(max = 80)
    private String nome;

    /** Obrigatório para jogador de linha (1-10). Ignorado se goleiro = true. */
    @Min(1)
    @Max(10)
    private Integer estrelas = 5;

    /** true = cadastrar como goleiro fixo. */
    @NotNull
    private Boolean goleiro = false;

    public String getNome() {
        return nome;
    }

    public void setNome(String nome) {
        this.nome = nome;
    }

    public Integer getEstrelas() {
        return estrelas;
    }

    public void setEstrelas(Integer estrelas) {
        this.estrelas = estrelas;
    }

    public Boolean getGoleiro() {
        return goleiro;
    }

    public void setGoleiro(Boolean goleiro) {
        this.goleiro = goleiro;
    }
}

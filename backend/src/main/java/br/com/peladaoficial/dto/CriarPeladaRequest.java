package br.com.peladaoficial.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public class CriarPeladaRequest {

    @NotBlank
    @Size(max = 100)
    private String nome = "Pelada Oficial";

    @NotNull
    @Min(2)
    @Max(6)
    private Integer quantidadeTimes = 2;

    /** Se true (padrão), traz nomes/estrelas salvos da última pelada. */
    private Boolean importarElenco = true;

    public String getNome() {
        return nome;
    }

    public void setNome(String nome) {
        this.nome = nome;
    }

    public Integer getQuantidadeTimes() {
        return quantidadeTimes;
    }

    public void setQuantidadeTimes(Integer quantidadeTimes) {
        this.quantidadeTimes = quantidadeTimes;
    }

    public Boolean getImportarElenco() {
        return importarElenco;
    }

    public void setImportarElenco(Boolean importarElenco) {
        this.importarElenco = importarElenco;
    }
}

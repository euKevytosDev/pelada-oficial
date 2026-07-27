package br.com.peladaoficial.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class ElencoItemRequest {

    @NotBlank
    private String nome;

    private Integer estrelas;

    private Boolean goleiro;
}

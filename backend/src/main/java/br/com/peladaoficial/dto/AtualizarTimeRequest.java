package br.com.peladaoficial.dto;

import jakarta.validation.constraints.Size;

/**
 * Atualiza nome do time e/ou goleiro do time.
 * nome vazio ou null + limparNome=true → volta o nome automático.
 */
public class AtualizarTimeRequest {

    @Size(max = 40)
    private String nome;

    /** Se true, remove o nome manual e usa o jogador com mais estrelas. */
    private Boolean usarNomeAutomatico;

    /** ID do goleiro da pelada para vincular a este time (pode ser de outro time). */
    private Long goleiroId;

    /** Se true, remove o goleiro deste time. */
    private Boolean removerGoleiro;

    public String getNome() {
        return nome;
    }

    public void setNome(String nome) {
        this.nome = nome;
    }

    public Boolean getUsarNomeAutomatico() {
        return usarNomeAutomatico;
    }

    public void setUsarNomeAutomatico(Boolean usarNomeAutomatico) {
        this.usarNomeAutomatico = usarNomeAutomatico;
    }

    public Long getGoleiroId() {
        return goleiroId;
    }

    public void setGoleiroId(Long goleiroId) {
        this.goleiroId = goleiroId;
    }

    public Boolean getRemoverGoleiro() {
        return removerGoleiro;
    }

    public void setRemoverGoleiro(Boolean removerGoleiro) {
        this.removerGoleiro = removerGoleiro;
    }
}

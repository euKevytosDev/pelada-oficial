package br.com.peladaoficial.model;

/**
 * Situação atual da pelada.
 */
public enum StatusPelada {
    AGUARDANDO,   // cadastrando jogadores / ainda não sorteou
    EM_ANDAMENTO, // partidas rolando
    ENCERRADA     // usuário clicou em "Encerrar pelada"
}

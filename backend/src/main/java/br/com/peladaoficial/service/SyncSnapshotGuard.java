package br.com.peladaoficial.service;

/**
 * Decide se um snapshot novo é mais pobre que o já persistido
 * e, portanto, não pode substituir a súmula (evita wipe por sync incompleto).
 */
public final class SyncSnapshotGuard {

    private SyncSnapshotGuard() {
    }

    public static boolean maisPobreQueSalvo(
            int partidasAtuais,
            int timesAtuais,
            int jogadoresAtuais,
            int novasPartidas,
            int novosTimes,
            int novosJogadores) {
        if (partidasAtuais > 0 && novasPartidas < partidasAtuais) {
            return true;
        }
        if (partidasAtuais > 0 && novasPartidas == 0) {
            return true;
        }
        // Times já salvos (ex.: "Salvar times") não podem sumir com sync vazio/parcial
        if (timesAtuais > 0 && novasPartidas == 0 && novosTimes < timesAtuais) {
            return true;
        }
        if (timesAtuais > 0 && novosTimes == 0 && novasPartidas == 0) {
            return true;
        }
        return jogadoresAtuais > 0 && novosJogadores == 0 && novasPartidas == 0;
    }
}

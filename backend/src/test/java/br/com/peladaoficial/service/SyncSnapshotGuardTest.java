package br.com.peladaoficial.service;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class SyncSnapshotGuardTest {

    @Test
    void rejeitaSyncVazioQuandoJaHaPartidas() {
        assertTrue(SyncSnapshotGuard.maisPobreQueSalvo(5, 4, 20, 0, 0, 0));
    }

    @Test
    void rejeitaSyncComMenosPartidas() {
        assertTrue(SyncSnapshotGuard.maisPobreQueSalvo(5, 4, 20, 2, 4, 20));
    }

    @Test
    void rejeitaSyncSemTimesNemPartidasQuandoJaHaTimes() {
        assertTrue(SyncSnapshotGuard.maisPobreQueSalvo(0, 4, 20, 0, 0, 20));
    }

    @Test
    void rejeitaSyncSemJogadoresNemPartidasQuandoJaHaJogadores() {
        assertTrue(SyncSnapshotGuard.maisPobreQueSalvo(0, 0, 15, 0, 0, 0));
    }

    @Test
    void aceitaPrimeiroSnapshotCompleto() {
        assertFalse(SyncSnapshotGuard.maisPobreQueSalvo(0, 0, 0, 3, 4, 16));
    }

    @Test
    void aceitaSnapshotIgualOuMaisRico() {
        assertFalse(SyncSnapshotGuard.maisPobreQueSalvo(3, 4, 16, 3, 4, 16));
        assertFalse(SyncSnapshotGuard.maisPobreQueSalvo(3, 4, 16, 4, 4, 16));
    }

    @Test
    void aceitaAtualizarElencoSemPartidasQuandoNaoHaPartidasSalvas() {
        assertFalse(SyncSnapshotGuard.maisPobreQueSalvo(0, 0, 10, 0, 0, 12));
    }
}

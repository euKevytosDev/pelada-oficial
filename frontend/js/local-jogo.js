/**
 * Jogo no celular primeiro — sync com o servidor depois.
 * Os lances ficam no localStorage deste navegador.
 */
const LocalJogo = (() => {
  const STORE_KEY = "pelada_jogo_local_v1";

  function ler() {
    try {
      return JSON.parse(localStorage.getItem(STORE_KEY) || "null");
    } catch (_) {
      return null;
    }
  }

  function gravar(dados) {
    if (!dados) {
      localStorage.removeItem(STORE_KEY);
      return;
    }
    localStorage.setItem(STORE_KEY, JSON.stringify(dados));
  }

  function limpar() {
    gravar(null);
  }

  function obter() {
    return ler();
  }

  function salvarPartida(peladaId, partida, times) {
    const atual = ler() || { lancesPendentes: [], finalizarPendente: false };
    gravar({
      peladaId,
      partida,
      times: times || atual.times || [],
      lancesPendentes: atual.lancesPendentes || [],
      finalizarPendente: !!atual.finalizarPendente,
      atualizadoEm: Date.now(),
    });
  }

  function atualizarPartida(partida) {
    const atual = ler();
    if (!atual) return;
    atual.partida = partida;
    atual.atualizadoEm = Date.now();
    gravar(atual);
  }

  function salvarTimes(times) {
    const atual = ler();
    if (!atual) return;
    atual.times = times;
    atual.atualizadoEm = Date.now();
    gravar(atual);
  }

  function enfileirarLance(partidaId, payload, meta) {
    const atual = ler() || {
      peladaId: null,
      partida: null,
      times: [],
      lancesPendentes: [],
      finalizarPendente: false,
    };
    atual.lancesPendentes = atual.lancesPendentes || [];
    atual.lancesPendentes.push({
      id: `pend-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      partidaId,
      payload,
      meta: meta || null,
      tentativas: 0,
      criadoEm: Date.now(),
    });
    gravar(atual);
  }

  function listarLancesPendentes() {
    return (ler()?.lancesPendentes || []).slice();
  }

  function removerLancePendente(id) {
    const atual = ler();
    if (!atual) return;
    atual.lancesPendentes = (atual.lancesPendentes || []).filter((l) => l.id !== id);
    gravar(atual);
  }

  function marcarFinalizarPendente(sim) {
    const atual = ler();
    if (!atual) return;
    atual.finalizarPendente = !!sim;
    gravar(atual);
  }

  function temFinalizarPendente() {
    return !!(ler()?.finalizarPendente);
  }

  function qtdPendentes() {
    const a = ler();
    if (!a) return 0;
    return (a.lancesPendentes || []).length + (a.finalizarPendente ? 1 : 0);
  }

  return {
    obter,
    salvarPartida,
    atualizarPartida,
    salvarTimes,
    limpar,
    enfileirarLance,
    listarLancesPendentes,
    removerLancePendente,
    marcarFinalizarPendente,
    temFinalizarPendente,
    qtdPendentes,
  };
})();

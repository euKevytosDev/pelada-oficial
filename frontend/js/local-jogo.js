/**
 * Jogo no celular primeiro — sync suave depois.
 * Classificação e placar valem neste navegador até a 13ª rodada,
 * mesmo se o servidor oscilar.
 */
const LocalJogo = (() => {
  const STORE_KEY = "pelada_jogo_local_v3";
  const LEGACY_KEYS = ["pelada_jogo_local_v2", "pelada_jogo_local_v1", "pelada_fila_lances", "pelada_fila_finalizar"];

  function ler() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) return JSON.parse(raw);

      // migra legado (mantém times/partida; descarta fila velha que podia duplicar)
      for (const key of ["pelada_jogo_local_v2", "pelada_jogo_local_v1"]) {
        const oldRaw = localStorage.getItem(key);
        if (!oldRaw) continue;
        localStorage.removeItem(key);
        const old = JSON.parse(oldRaw);
        return {
          peladaId: old.peladaId,
          partida: old.partida || null,
          times: old.times || [],
          lancesPendentes: [],
          finalizarPendente: false,
          syncPausadoAte: 0,
          atualizadoEm: Date.now(),
        };
      }
      return null;
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
    LEGACY_KEYS.forEach((k) => localStorage.removeItem(k));
  }

  /** Limpa só a partida aberta; mantém classificação local. */
  function limparPartidaAberta() {
    const atual = ler();
    if (!atual) return;
    atual.partida = null;
    atual.lancesPendentes = [];
    atual.finalizarPendente = false;
    atual.atualizadoEm = Date.now();
    gravar(atual);
  }

  function obter() {
    return ler();
  }

  function salvarPartida(peladaId, partida, times) {
    const atual = ler() || {
      lancesPendentes: [],
      finalizarPendente: false,
      syncPausadoAte: 0,
    };
    gravar({
      peladaId,
      partida,
      times: times && times.length ? times : atual.times || [],
      lancesPendentes: atual.lancesPendentes || [],
      finalizarPendente: !!atual.finalizarPendente,
      syncPausadoAte: atual.syncPausadoAte || 0,
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
    const atual = ler() || {
      peladaId: null,
      partida: null,
      lancesPendentes: [],
      finalizarPendente: false,
      syncPausadoAte: 0,
    };
    atual.times = times || [];
    atual.atualizadoEm = Date.now();
    gravar(atual);
  }

  function novoClientLanceId() {
    return `cl-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }

  function enfileirarLance(partidaId, payload, meta) {
    const atual = ler() || {
      peladaId: null,
      partida: null,
      times: [],
      lancesPendentes: [],
      finalizarPendente: false,
      syncPausadoAte: 0,
    };
    atual.lancesPendentes = atual.lancesPendentes || [];
    const clientLanceId = payload.clientLanceId || novoClientLanceId();
    if (atual.lancesPendentes.some((l) => l.id === clientLanceId || l.payload?.clientLanceId === clientLanceId)) {
      gravar(atual);
      return clientLanceId;
    }
    const body = { ...payload, clientLanceId };
    atual.lancesPendentes.push({
      id: clientLanceId,
      partidaId,
      payload: body,
      meta: meta || null,
      tentativas: 0,
      criadoEm: Date.now(),
    });
    gravar(atual);
    return clientLanceId;
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

  function registrarTentativa(id) {
    const atual = ler();
    if (!atual) return 0;
    let tentativas = 0;
    atual.lancesPendentes = (atual.lancesPendentes || []).map((l) => {
      if (l.id !== id) return l;
      tentativas = (l.tentativas || 0) + 1;
      return { ...l, tentativas };
    });
    gravar(atual);
    return tentativas;
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

  function pausarSync(ms) {
    const atual = ler();
    if (!atual) return;
    atual.syncPausadoAte = Date.now() + ms;
    gravar(atual);
  }

  function syncPausado() {
    const ate = ler()?.syncPausadoAte || 0;
    return Date.now() < ate;
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
    limparPartidaAberta,
    novoClientLanceId,
    enfileirarLance,
    listarLancesPendentes,
    removerLancePendente,
    registrarTentativa,
    marcarFinalizarPendente,
    temFinalizarPendente,
    pausarSync,
    syncPausado,
    qtdPendentes,
  };
})();

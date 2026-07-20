/**
 * Jogo no celular primeiro — sync com o servidor depois.
 * Cada lance tem um id único (clientLanceId) para nunca duplicar no sync.
 */
const LocalJogo = (() => {
  const STORE_KEY = "pelada_jogo_local_v2";
  const STORE_KEY_OLD = "pelada_jogo_local_v1";

  function ler() {
    try {
      const v2 = localStorage.getItem(STORE_KEY);
      if (v2) return JSON.parse(v2);
      // migra v1 → limpa fila antiga (podia duplicar gols)
      const v1 = localStorage.getItem(STORE_KEY_OLD);
      if (v1) {
        localStorage.removeItem(STORE_KEY_OLD);
        const old = JSON.parse(v1);
        return {
          peladaId: old.peladaId,
          partida: old.partida,
          times: old.times || [],
          lancesPendentes: [],
          finalizarPendente: !!old.finalizarPendente,
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
    localStorage.removeItem(STORE_KEY_OLD);
    localStorage.removeItem("pelada_fila_lances");
    localStorage.removeItem("pelada_fila_finalizar");
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
    };
    atual.lancesPendentes = atual.lancesPendentes || [];
    const clientLanceId = payload.clientLanceId || novoClientLanceId();
    // Não enfileira o mesmo id duas vezes
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
    novoClientLanceId,
    enfileirarLance,
    listarLancesPendentes,
    removerLancePendente,
    registrarTentativa,
    marcarFinalizarPendente,
    temFinalizarPendente,
    qtdPendentes,
  };
})();

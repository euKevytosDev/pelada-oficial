/**
 * Pelada offline-first no celular.
 * Elenco + times + rodadas ficam locais; sync só ao encerrar.
 */
const LocalJogo = (() => {
  const STORE_KEY = "pelada_jogo_local_v4";
  const LEGACY_KEYS = [
    "pelada_jogo_local_v3",
    "pelada_jogo_local_v2",
    "pelada_jogo_local_v1",
    "pelada_fila_lances",
    "pelada_fila_finalizar",
  ];

  const CORES = ["#1B5E20", "#0D47A1", "#B71C1C", "#E65100", "#4A148C", "#006064"];

  function snapshotVazio(extra = {}) {
    return {
      versao: 4,
      modoOffline: true,
      peladaId: null,
      nome: "Pelada Oficial",
      quantidadeTimes: 2,
      status: "AGUARDANDO",
      jogadores: [],
      times: [],
      partida: null,
      rodadasFinalizadas: [],
      observacoes: [],
      seqJogador: 0,
      seqTime: 0,
      seqPartida: 0,
      lancesPendentes: [],
      finalizarPendente: false,
      syncPausadoAte: 0,
      atualizadoEm: Date.now(),
      ...extra,
    };
  }

  function ler() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) {
        const dados = JSON.parse(raw);
        return { ...snapshotVazio(), ...dados, versao: 4, modoOffline: true };
      }

      // migra v3 (partida/times) → v4
      const v3 = localStorage.getItem("pelada_jogo_local_v3");
      if (v3) {
        localStorage.removeItem("pelada_jogo_local_v3");
        const old = JSON.parse(v3);
        return snapshotVazio({
          peladaId: old.peladaId || null,
          times: old.times || [],
          partida: old.partida || null,
          lancesPendentes: [],
          finalizarPendente: false,
          status: old.partida || (old.times || []).length ? "EM_ANDAMENTO" : "AGUARDANDO",
        });
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
    dados.atualizadoEm = Date.now();
    dados.versao = 4;
    dados.modoOffline = true;
    localStorage.setItem(STORE_KEY, JSON.stringify(dados));
  }

  function limpar() {
    gravar(null);
    LEGACY_KEYS.forEach((k) => localStorage.removeItem(k));
  }

  function obter() {
    return ler();
  }

  function iniciarPeladaLocal({ peladaId, nome, quantidadeTimes, jogadores }) {
    const snap = snapshotVazio({
      peladaId: peladaId || null,
      nome: nome || "Pelada Oficial",
      quantidadeTimes: quantidadeTimes || 2,
      status: "AGUARDANDO",
      jogadores: (jogadores || []).map((j, i) => ({
        id: j.id || `lj-${i + 1}`,
        nome: j.nome,
        estrelas: j.goleiro ? 0 : Number(j.estrelas) || 3,
        goleiro: !!j.goleiro,
        apto: j.apto !== false,
        gols: 0,
        golsContra: 0,
        cartoesAmarelos: 0,
        cartoesVermelhos: 0,
        golsSofridos: 0,
        timeId: null,
      })),
      seqJogador: (jogadores || []).length,
    });
    gravar(snap);
    return snap;
  }

  function mutar(fn) {
    const atual = ler() || snapshotVazio();
    const next = fn(atual) || atual;
    gravar(next);
    return next;
  }

  function listarJogadores() {
    return (ler()?.jogadores || []).slice();
  }

  function adicionarJogador({ nome, estrelas, goleiro }) {
    return mutar((s) => {
      s.seqJogador = (s.seqJogador || 0) + 1;
      const id = `lj-${s.seqJogador}`;
      s.jogadores.push({
        id,
        nome: String(nome || "").trim(),
        estrelas: goleiro ? 0 : Number(estrelas) || 3,
        goleiro: !!goleiro,
        apto: true,
        gols: 0,
        golsContra: 0,
        cartoesAmarelos: 0,
        cartoesVermelhos: 0,
        golsSofridos: 0,
        timeId: null,
      });
      return s;
    });
  }

  function atualizarJogador(jogadorId, patch) {
    return mutar((s) => {
      s.jogadores = (s.jogadores || []).map((j) => {
        if (String(j.id) !== String(jogadorId)) return j;
        const next = { ...j, ...patch };
        if (next.goleiro) next.estrelas = 0;
        return next;
      });
      return s;
    });
  }

  function removerJogador(jogadorId) {
    return mutar((s) => {
      s.jogadores = (s.jogadores || []).filter((j) => String(j.id) !== String(jogadorId));
      return s;
    });
  }

  function indiceTimeMaisFraco(somaEstrelas, qtdJogadores) {
    let melhor = 0;
    for (let i = 1; i < somaEstrelas.length; i++) {
      const menos = somaEstrelas[i] < somaEstrelas[melhor];
      const empate = somaEstrelas[i] === somaEstrelas[melhor] && qtdJogadores[i] < qtdJogadores[melhor];
      if (menos || empate) melhor = i;
    }
    return melhor;
  }

  function nomeAutomaticoTime(jogadoresDoTime) {
    const linha = (jogadoresDoTime || []).filter((j) => !j.goleiro);
    if (!linha.length) return null;
    linha.sort((a, b) => (b.estrelas || 0) - (a.estrelas || 0) || a.nome.localeCompare(b.nome, "pt-BR"));
    return linha[0].nome;
  }

  function sortearTimesLocal() {
    const s = ler();
    if (!s) throw new Error("Nenhuma pelada local");
    const qtd = Number(s.quantidadeTimes) || 2;
    const linha = (s.jogadores || []).filter((j) => !j.goleiro && j.apto !== false);
    const goleiros = (s.jogadores || []).filter((j) => j.goleiro && j.apto !== false);
    if (linha.length < qtd) {
      throw new Error(`Cadastre pelo menos ${qtd} jogadores aptos de linha`);
    }

    s.seqTime = 0;
    const times = [];
    for (let i = 0; i < qtd; i++) {
      s.seqTime += 1;
      times.push({
        id: `lt-${s.seqTime}`,
        nome: `Time ${String.fromCharCode(65 + i)}`,
        cor: CORES[i % CORES.length],
        nomeManual: false,
        pontos: 0,
        vitorias: 0,
        empates: 0,
        derrotas: 0,
        golsPro: 0,
        golsContra: 0,
        jogadores: [],
        goleiro: null,
      });
    }

    const embaralhados = [...linha].sort(() => Math.random() - 0.5);
    embaralhados.sort((a, b) => (b.estrelas || 0) - (a.estrelas || 0));
    const soma = times.map(() => 0);
    const qtds = times.map(() => 0);

    const porId = new Map((s.jogadores || []).map((j) => [String(j.id), j]));
    (s.jogadores || []).forEach((j) => {
      j.timeId = null;
    });

    for (const j of embaralhados) {
      const idx = indiceTimeMaisFraco(soma, qtds);
      const time = times[idx];
      const jog = porId.get(String(j.id));
      if (!jog) continue;
      jog.timeId = time.id;
      time.jogadores.push({ ...jog });
      soma[idx] += jog.estrelas || 0;
      qtds[idx] += 1;
    }

    const gkMix = [...goleiros].sort(() => Math.random() - 0.5);
    const nGk = Math.min(gkMix.length, times.length);
    for (let i = 0; i < nGk; i++) {
      const gk = porId.get(String(gkMix[i].id));
      if (!gk) continue;
      gk.timeId = times[i].id;
      times[i].jogadores.push({ ...gk });
      times[i].goleiro = { id: gk.id, nome: gk.nome, golsSofridos: 0 };
    }

    times.forEach((t) => {
      if (!t.nomeManual) {
        const auto = nomeAutomaticoTime(t.jogadores);
        if (auto) t.nome = auto;
      }
    });

    s.times = times;
    s.jogadores = [...porId.values()];
    s.status = "EM_ANDAMENTO";
    s.partida = null;
    s.rodadasFinalizadas = s.rodadasFinalizadas || [];
    gravar(s);
    return times.map(enriquecerTime);
  }

  function enriquecerTime(t) {
    const jogadores = (t.jogadores || []).slice();
    const linha = jogadores.filter((j) => !j.goleiro);
    const gk = jogadores.find((j) => j.goleiro) || t.goleiro || null;
    return {
      ...t,
      jogadores: linha,
      goleiro: gk ? { id: gk.id, nome: gk.nome, golsSofridos: gk.golsSofridos || 0 } : null,
      totalEstrelas: linha.reduce((acc, j) => acc + (j.estrelas || 0), 0),
    };
  }

  function listarTimes() {
    return (ler()?.times || []).map(enriquecerTime);
  }

  function listarGoleiros() {
    return (ler()?.jogadores || [])
      .filter((j) => j.goleiro)
      .map((g) => ({
        id: g.id,
        nome: g.nome,
        timeId: g.timeId || null,
        golsSofridos: g.golsSofridos || 0,
      }));
  }

  function atualizarTimeLocal(timeId, patch) {
    return mutar((s) => {
      s.times = (s.times || []).map((t) => {
        if (String(t.id) !== String(timeId)) return t;
        const next = { ...t };
        if (patch.nome !== undefined) {
          const nome = String(patch.nome || "").trim();
          if (!nome || patch.usarNomeAutomatico) {
            next.nomeManual = false;
            next.nome = nomeAutomaticoTime(next.jogadores) || next.nome;
          } else {
            next.nome = nome;
            next.nomeManual = true;
          }
        }
        if (patch.goleiroId) {
          const gk = (s.jogadores || []).find((j) => String(j.id) === String(patch.goleiroId));
          if (gk) {
            // remove gk antigo deste time
            next.jogadores = (next.jogadores || []).filter((j) => !j.goleiro);
            // tira gk de outros times
            s.times.forEach((ot) => {
              if (String(ot.id) === String(timeId)) return;
              ot.jogadores = (ot.jogadores || []).filter((j) => String(j.id) !== String(gk.id));
              if (ot.goleiro && String(ot.goleiro.id) === String(gk.id)) ot.goleiro = null;
            });
            (s.jogadores || []).forEach((j) => {
              if (String(j.id) === String(gk.id)) j.timeId = timeId;
            });
            const gkCopy = { ...gk, timeId };
            next.jogadores.push(gkCopy);
            next.goleiro = { id: gk.id, nome: gk.nome, golsSofridos: gk.golsSofridos || 0 };
          }
        }
        if (patch.removerGoleiro) {
          next.jogadores = (next.jogadores || []).filter((j) => !j.goleiro);
          next.goleiro = null;
        }
        return next;
      });
      return s;
    });
  }

  function moverJogadorLocal(jogadorId, timeDestinoId) {
    return mutar((s) => {
      const jog = (s.jogadores || []).find((j) => String(j.id) === String(jogadorId));
      if (!jog || jog.goleiro) return s;
      s.times = (s.times || []).map((t) => ({
        ...t,
        jogadores: (t.jogadores || []).filter((j) => String(j.id) !== String(jogadorId)),
      }));
      const dest = (s.times || []).find((t) => String(t.id) === String(timeDestinoId));
      if (dest) {
        jog.timeId = dest.id;
        dest.jogadores = [...(dest.jogadores || []), { ...jog }];
        if (!dest.nomeManual) {
          dest.nome = nomeAutomaticoTime(dest.jogadores) || dest.nome;
        }
      }
      return s;
    });
  }

  function iniciarPartidaLocal(timeAId, timeBId) {
    const s = ler();
    if (!s) throw new Error("Nenhuma pelada local");
    if (s.partida && s.partida.status === "EM_ANDAMENTO") {
      throw new Error("Já existe uma partida em andamento");
    }
    const times = listarTimes();
    const timeA = times.find((t) => String(t.id) === String(timeAId));
    const timeB = times.find((t) => String(t.id) === String(timeBId));
    if (!timeA || !timeB) throw new Error("Times inválidos");

    s.seqPartida = (s.seqPartida || 0) + 1;
    const numero = (s.rodadasFinalizadas || []).length + 1;
    const partida = {
      id: `lp-${s.seqPartida}`,
      numeroRodada: numero,
      status: "EM_ANDAMENTO",
      golsTimeA: 0,
      golsTimeB: 0,
      timeA: {
        id: timeA.id,
        nome: timeA.nome,
        cor: timeA.cor,
        jogadores: (timeA.jogadores || []).map((j) => ({ ...j })),
      },
      timeB: {
        id: timeB.id,
        nome: timeB.nome,
        cor: timeB.cor,
        jogadores: (timeB.jogadores || []).map((j) => ({ ...j })),
      },
      eventos: [],
      goleirosPelada: listarGoleiros(),
      _local: true,
    };
    s.partida = partida;
    s.lancesPendentes = [];
    s.finalizarPendente = false;
    gravar(s);
    return partida;
  }

  function salvarPartida(peladaId, partida, times) {
    mutar((s) => {
      if (peladaId) s.peladaId = peladaId;
      s.partida = partida;
      if (times && times.length) s.times = times;
      return s;
    });
  }

  function atualizarPartida(partida) {
    mutar((s) => {
      s.partida = partida;
      return s;
    });
  }

  function salvarTimes(times) {
    mutar((s) => {
      s.times = times || [];
      return s;
    });
  }

  function limparPartidaAberta() {
    mutar((s) => {
      s.partida = null;
      s.lancesPendentes = [];
      s.finalizarPendente = false;
      return s;
    });
  }

  function finalizarPartidaLocal(partidaAtualizada, timesAtualizados) {
    return mutar((s) => {
      const p = { ...partidaAtualizada, status: "FINALIZADA" };
      s.rodadasFinalizadas = [...(s.rodadasFinalizadas || []), p];
      if (timesAtualizados) {
        s.times = (s.times || []).map((time) => {
          const atualizado = timesAtualizados.find((t) => String(t.id) === String(time.id));
          return atualizado ? { ...time, ...atualizado, jogadores: time.jogadores } : time;
        });
      }
      s.partida = null;
      s.lancesPendentes = [];
      s.finalizarPendente = false;
      // aplica stats de jogadores a partir dos eventos
      (p.eventos || []).forEach((ev) => {
        const j = (s.jogadores || []).find((x) => String(x.id) === String(ev.jogador?.id || ev.jogadorId));
        const gk = (s.jogadores || []).find((x) => String(x.id) === String(ev.goleiro?.id || ev.goleiroId));
        if (!j) return;
        if (ev.tipo === "GOL") {
          j.gols = (j.gols || 0) + 1;
          if (gk) gk.golsSofridos = (gk.golsSofridos || 0) + 1;
        } else if (ev.tipo === "GOL_CONTRA") {
          j.golsContra = (j.golsContra || 0) + 1;
        } else if (ev.tipo === "CARTAO_AMARELO") {
          j.cartoesAmarelos = (j.cartoesAmarelos || 0) + 1;
        } else if (ev.tipo === "CARTAO_VERMELHO") {
          j.cartoesVermelhos = (j.cartoesVermelhos || 0) + 1;
        }
      });
      return s;
    });
  }

  function cancelarPartidaLocal(partidaId) {
    return mutar((s) => {
      if (s.partida && String(s.partida.id) === String(partidaId)) {
        s.partida = null;
        s.lancesPendentes = [];
        s.finalizarPendente = false;
        return s;
      }
      // remove rodada finalizada e reverte pontos dos times (simplificado: recalcula do zero)
      s.rodadasFinalizadas = (s.rodadasFinalizadas || []).filter((p) => String(p.id) !== String(partidaId));
      recalcularTimesDasRodadas(s);
      return s;
    });
  }

  function recalcularTimesDasRodadas(s) {
    (s.times || []).forEach((t) => {
      t.pontos = 0;
      t.vitorias = 0;
      t.empates = 0;
      t.derrotas = 0;
      t.golsPro = 0;
      t.golsContra = 0;
    });
    (s.jogadores || []).forEach((j) => {
      j.gols = 0;
      j.golsContra = 0;
      j.cartoesAmarelos = 0;
      j.cartoesVermelhos = 0;
      j.golsSofridos = 0;
    });
    (s.rodadasFinalizadas || []).forEach((p) => {
      aplicarResultadoNosTimes(s.times, p);
      (p.eventos || []).forEach((ev) => {
        const j = (s.jogadores || []).find((x) => String(x.id) === String(ev.jogador?.id || ev.jogadorId));
        const gk = (s.jogadores || []).find((x) => String(x.id) === String(ev.goleiro?.id || ev.goleiroId));
        if (!j) return;
        if (ev.tipo === "GOL") {
          j.gols += 1;
          if (gk) gk.golsSofridos += 1;
        } else if (ev.tipo === "GOL_CONTRA") j.golsContra += 1;
        else if (ev.tipo === "CARTAO_AMARELO") j.cartoesAmarelos += 1;
        else if (ev.tipo === "CARTAO_VERMELHO") j.cartoesVermelhos += 1;
      });
    });
  }

  function aplicarResultadoNosTimes(times, partida) {
    const golsA = Number(partida.golsTimeA) || 0;
    const golsB = Number(partida.golsTimeB) || 0;
    const idA = partida.timeA?.id;
    const idB = partida.timeB?.id;
    (times || []).forEach((t) => {
      if (String(t.id) === String(idA)) {
        t.golsPro = (t.golsPro || 0) + golsA;
        t.golsContra = (t.golsContra || 0) + golsB;
        if (golsA > golsB) {
          t.pontos = (t.pontos || 0) + 3;
          t.vitorias = (t.vitorias || 0) + 1;
        } else if (golsA === golsB) {
          t.pontos = (t.pontos || 0) + 1;
          t.empates = (t.empates || 0) + 1;
        } else t.derrotas = (t.derrotas || 0) + 1;
      } else if (String(t.id) === String(idB)) {
        t.golsPro = (t.golsPro || 0) + golsB;
        t.golsContra = (t.golsContra || 0) + golsA;
        if (golsB > golsA) {
          t.pontos = (t.pontos || 0) + 3;
          t.vitorias = (t.vitorias || 0) + 1;
        } else if (golsA === golsB) {
          t.pontos = (t.pontos || 0) + 1;
          t.empates = (t.empates || 0) + 1;
        } else t.derrotas = (t.derrotas || 0) + 1;
      }
    });
  }

  function adicionarObservacaoLocal(obs) {
    return mutar((s) => {
      s.observacoes = s.observacoes || [];
      s.observacoes.push({
        id: `lo-${Date.now()}`,
        ...obs,
      });
      return s;
    });
  }

  function listarObservacoes() {
    return (ler()?.observacoes || []).slice();
  }

  function removerObservacaoLocal(id) {
    return mutar((s) => {
      s.observacoes = (s.observacoes || []).filter((o) => String(o.id) !== String(id));
      return s;
    });
  }

  function montarPayloadSync() {
    const s = ler();
    if (!s) throw new Error("Nada para sincronizar");
    const partidas = [...(s.rodadasFinalizadas || [])];
    if (s.partida && s.partida.status === "EM_ANDAMENTO") {
      // não inclui partida aberta sem finalizar
    }
    return {
      encerrar: true,
      jogadores: (s.jogadores || []).map((j) => ({
        clientId: String(j.id),
        nome: j.nome,
        estrelas: j.goleiro ? 0 : Number(j.estrelas) || 3,
        goleiro: !!j.goleiro,
        apto: j.apto !== false,
      })),
      times: (s.times || []).map((t) => ({
        clientId: String(t.id),
        nome: t.nome,
        cor: t.cor,
        nomeManual: !!t.nomeManual,
        jogadorClientIds: (t.jogadores || []).map((j) => String(j.id)),
        pontos: t.pontos || 0,
        vitorias: t.vitorias || 0,
        empates: t.empates || 0,
        derrotas: t.derrotas || 0,
        golsPro: t.golsPro || 0,
        golsContra: t.golsContra || 0,
      })),
      partidas: partidas.map((p) => ({
        clientId: String(p.id),
        numeroRodada: p.numeroRodada,
        timeAClientId: String(p.timeA.id),
        timeBClientId: String(p.timeB.id),
        golsTimeA: Number(p.golsTimeA) || 0,
        golsTimeB: Number(p.golsTimeB) || 0,
        status: "FINALIZADA",
        eventos: (p.eventos || []).map((e) => ({
          clientLanceId: e.clientLanceId || e.id || `cl-${e.tipo}-${Date.now()}`,
          tipo: e.tipo,
          timeClientId: String(e.time?.id || e.timeId),
          jogadorClientId: String(e.jogador?.id || e.jogadorId),
          goleiroClientId: e.goleiro?.id || e.goleiroId ? String(e.goleiro?.id || e.goleiroId) : null,
        })),
      })),
      observacoes: (s.observacoes || []).map((o) => ({
        jogadorClientId: o.jogadorId ? String(o.jogadorId) : null,
        tipo: o.tipo || "ATRASO",
        horario: o.horario || null,
        texto: o.texto || null,
      })),
    };
  }

  // --- API legado (fila) mantida como no-op / compat ---
  function novoClientLanceId() {
    return `cl-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }

  function enfileirarLance() {
    return novoClientLanceId();
  }

  function listarLancesPendentes() {
    return [];
  }

  function removerLancePendente() {}

  function registrarTentativa() {
    return 0;
  }

  function marcarFinalizarPendente() {}

  function temFinalizarPendente() {
    return false;
  }

  function pausarSync() {}

  function syncPausado() {
    return false;
  }

  function qtdPendentes() {
    const s = ler();
    if (!s) return 0;
    return (s.rodadasFinalizadas || []).length + (s.jogadores || []).length > 0 ? 1 : 0;
  }

  function temJogoLocal() {
    const s = ler();
    if (!s) return false;
    return !!(
      s.peladaId ||
      (s.jogadores || []).length ||
      (s.times || []).length ||
      s.partida ||
      (s.rodadasFinalizadas || []).length
    );
  }

  return {
    obter,
    iniciarPeladaLocal,
    listarJogadores,
    adicionarJogador,
    atualizarJogador,
    removerJogador,
    sortearTimesLocal,
    listarTimes,
    listarGoleiros,
    atualizarTimeLocal,
    moverJogadorLocal,
    iniciarPartidaLocal,
    salvarPartida,
    atualizarPartida,
    salvarTimes,
    limpar,
    limparPartidaAberta,
    finalizarPartidaLocal,
    cancelarPartidaLocal,
    adicionarObservacaoLocal,
    listarObservacoes,
    removerObservacaoLocal,
    montarPayloadSync,
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
    temJogoLocal,
  };
})();

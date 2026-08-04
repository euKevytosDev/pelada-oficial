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
      cronometro: null,
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
        assistencias: 0,
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
        assistencias: 0,
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
      s.cronometro = null;
      s.lancesPendentes = [];
      s.finalizarPendente = false;
      return s;
    });
  }

  function salvarCronometro(dados) {
    mutar((s) => {
      s.cronometro = dados || null;
      return s;
    });
  }

  function lerCronometro() {
    return ler()?.cronometro || null;
  }

  function limparCronometro() {
    mutar((s) => {
      s.cronometro = null;
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
      s.cronometro = null;
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
          const ass = (s.jogadores || []).find(
            (x) => String(x.id) === String(ev.assistencia?.id || ev.assistenciaId)
          );
          if (ass) ass.assistencias = (ass.assistencias || 0) + 1;
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
        s.cronometro = null;
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
      j.assistencias = 0;
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
          const ass = (s.jogadores || []).find(
            (x) => String(x.id) === String(ev.assistencia?.id || ev.assistenciaId)
          );
          if (ass) ass.assistencias = (ass.assistencias || 0) + 1;
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
          assistenciaClientId:
            e.assistencia?.id || e.assistenciaId ? String(e.assistencia?.id || e.assistenciaId) : null,
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

  function premioDeNomes(itens, detalhe) {
    if (!itens || !itens.length) return null;
    const nomes = itens.map((i) => i.nome).filter(Boolean);
    if (!nomes.length) return null;
    return {
      nome: nomes.join(" / "),
      nomes,
      empate: nomes.length > 1,
      detalhe: detalhe || "",
    };
  }

  /** Súmula gerada no celular (mesma forma do backend) — funciona sem internet. */
  function montarResumoLocal() {
    const s = ler();
    if (!s) throw new Error("Nenhuma pelada local para gerar súmula");

    const timesEnrich = listarTimes();
    const partidas = [...(s.rodadasFinalizadas || [])];
    const aptos = (s.jogadores || []).filter((j) => j.apto !== false);
    const aptoIds = new Set(aptos.map((j) => String(j.id)));

    const golsPorJogador = new Map();
    const assistPorJogador = new Map();
    const amareloPorJogador = new Map();
    const vermelhoPorJogador = new Map();
    const golsContraPorJogador = new Map();
    const nomePorId = new Map();

    aptos.forEach((j) => {
      nomePorId.set(String(j.id), j.nome);
    });

    const bump = (map, id, nome, n = 1) => {
      if (!id || !aptoIds.has(String(id))) return;
      const key = String(id);
      const cur = map.get(key) || { id: key, nome: nome || nomePorId.get(key) || "?", quantidade: 0 };
      cur.quantidade += n;
      if (nome) cur.nome = nome;
      map.set(key, cur);
    };

    partidas.forEach((p) => {
      (p.eventos || []).forEach((e) => {
        const jId = e.jogador?.id || e.jogadorId;
        const jNome = e.jogador?.nome || e.jogadorNome;
        if (e.tipo === "GOL") {
          bump(golsPorJogador, jId, jNome);
          const aId = e.assistencia?.id || e.assistenciaId;
          const aNome = e.assistencia?.nome || e.assistenciaNome;
          if (aId) bump(assistPorJogador, aId, aNome);
        } else if (e.tipo === "GOL_CONTRA") {
          bump(golsContraPorJogador, jId, jNome);
        } else if (e.tipo === "CARTAO_AMARELO") {
          bump(amareloPorJogador, jId, jNome);
        } else if (e.tipo === "CARTAO_VERMELHO") {
          bump(vermelhoPorJogador, jId, jNome);
        }
      });
    });

    const golsMap = new Map([...golsPorJogador.values()].map((g) => [g.id, g.quantidade]));
    const times = timesEnrich.map((t) => {
      const jogadores = (t.jogadores || [])
        .filter((j) => aptoIds.has(String(j.id)))
        .map((j) => ({
          nome: j.nome,
          gols: golsMap.get(String(j.id)) || 0,
        }));
      const gkRaw = t.goleiro;
      const gkApto = gkRaw && aptoIds.has(String(gkRaw.id));
      const gk = gkApto
        ? {
            nome: gkRaw.nome,
            golsSofridos: gkRaw.golsSofridos || 0,
          }
        : null;
      return {
        nome: t.nome,
        cor: t.cor,
        goleiro: gk,
        jogadores,
      };
    });

    const classificacao = [...timesEnrich]
      .map((t) => {
        const jogos = (t.vitorias || 0) + (t.empates || 0) + (t.derrotas || 0);
        const gp = t.golsPro || 0;
        const gc = t.golsContra || 0;
        const pts = t.pontos || 0;
        return {
          nome: t.nome,
          pontos: pts,
          jogos,
          vitorias: t.vitorias || 0,
          empates: t.empates || 0,
          derrotas: t.derrotas || 0,
          golsPro: gp,
          golsContra: gc,
          saldo: gp - gc,
          aproveitamento: jogos ? Math.round((pts / (jogos * 3)) * 100) : 0,
        };
      })
      .sort((a, b) => {
        if (b.pontos !== a.pontos) return b.pontos - a.pontos;
        if (b.saldo !== a.saldo) return b.saldo - a.saldo;
        return b.golsPro - a.golsPro;
      })
      .map((t, i) => ({ ...t, posicao: i + 1 }));

    let artilharia = [...golsPorJogador.values()]
      .map((g) => ({ nome: g.nome, gols: g.quantidade, quantidade: g.quantidade }))
      .sort((a, b) => b.gols - a.gols || a.nome.localeCompare(b.nome, "pt-BR"));
    if (artilharia.length) {
      const max = artilharia[0].gols;
      artilharia = artilharia.filter((a) => a.gols === max);
    }

    const golsSofridos = aptos
      .filter((j) => j.goleiro)
      .map((j) => {
        const time = timesEnrich.find((t) => t.goleiro && String(t.goleiro.id) === String(j.id));
        return {
          nome: j.nome,
          quantidade: j.golsSofridos || 0,
          golsSofridos: j.golsSofridos || 0,
          time: time?.nome || "-",
        };
      })
      .sort((a, b) => a.quantidade - b.quantidade || a.nome.localeCompare(b.nome, "pt-BR"));

    const cartoesAmarelos = [...amareloPorJogador.values()]
      .map((c) => ({ nome: c.nome, quantidade: c.quantidade }))
      .sort((a, b) => b.quantidade - a.quantidade || a.nome.localeCompare(b.nome, "pt-BR"));
    const cartoesVermelhos = [...vermelhoPorJogador.values()]
      .map((c) => ({ nome: c.nome, quantidade: c.quantidade }))
      .sort((a, b) => b.quantidade - a.quantidade || a.nome.localeCompare(b.nome, "pt-BR"));
    const golsContra = [...golsContraPorJogador.values()]
      .map((c) => ({ nome: c.nome, quantidade: c.quantidade }))
      .sort((a, b) => b.quantidade - a.quantidade || a.nome.localeCompare(b.nome, "pt-BR"));

    const linha = aptos.filter((j) => !j.goleiro);
    const pontuacaoCraque = (j) => {
      const g = golsPorJogador.get(String(j.id))?.quantidade || 0;
      const a = assistPorJogador.get(String(j.id))?.quantidade || 0;
      const am = amareloPorJogador.get(String(j.id))?.quantidade || 0;
      const v = vermelhoPorJogador.get(String(j.id))?.quantidade || 0;
      return g * 2 + a * 1 - am - v * 2;
    };

    const premios = {
      campeao: classificacao[0]
        ? premioDeNomes([{ nome: classificacao[0].nome }], `${classificacao[0].pontos} pts`)
        : null,
      artilheiro: null,
      bolaDeOuro: null,
      craque: null,
      garcom: null,
      luvaDeOuro: null,
      bolaMurcha: null,
    };

    if (artilharia.length) {
      const max = artilharia[0].gols;
      premios.artilheiro = premioDeNomes(artilharia, `${max} gol${max === 1 ? "" : "s"}`);
      premios.bolaDeOuro = premios.artilheiro;
    }

    const scores = linha.map((j) => ({ nome: j.nome, pts: pontuacaoCraque(j) }));
    if (scores.length) {
      const maxCraque = Math.max(...scores.map((x) => x.pts));
      const tops = scores.filter((x) => x.pts === maxCraque);
      premios.craque = premioDeNomes(
        tops,
        `${maxCraque} pt${maxCraque === 1 ? "" : "s"} (gol 2 · assistência 1 · A -1 · V -2)`
      );
    }

    const assists = [...assistPorJogador.values()];
    if (assists.length) {
      const maxA = Math.max(...assists.map((a) => a.quantidade));
      const tops = assists.filter((a) => a.quantidade === maxA);
      premios.garcom = premioDeNomes(tops, `${maxA} assistência${maxA === 1 ? "" : "s"}`);
    }

    if (golsSofridos.length) {
      const min = golsSofridos[0].quantidade;
      const tops = golsSofridos.filter((g) => g.quantidade === min);
      premios.luvaDeOuro = premioDeNomes(tops, `${min} sofrido${min === 1 ? "" : "s"}`);
    }

    const partidasResumo = partidas.map((p) => ({
      numero: p.numeroRodada,
      numeroRodada: p.numeroRodada,
      timeA: p.timeA?.nome || p.timeANome,
      timeB: p.timeB?.nome || p.timeBNome,
      golsA: p.golsTimeA || 0,
      golsB: p.golsTimeB || 0,
      golsTimeA: p.golsTimeA || 0,
      golsTimeB: p.golsTimeB || 0,
      corA: p.timeA?.cor,
      corB: p.timeB?.cor,
      status: "FINALIZADA",
      eventos: (p.eventos || []).map((e) => ({
        tipo: e.tipo,
        jogadorNome: e.jogador?.nome || e.jogadorNome || "?",
        assistenciaNome: e.assistencia?.nome || e.assistenciaNome || null,
        timeNome: e.time?.nome || e.timeNome || null,
      })),
    }));

    const observacoes = (s.observacoes || []).map((o) => {
      const jog = (s.jogadores || []).find((j) => String(j.id) === String(o.jogadorId));
      return {
        jogadorNome: jog?.nome || o.jogadorNome || null,
        tipo: o.tipo || "ATRASO",
        horario: o.horario || null,
        texto: o.texto || null,
      };
    });

    const agora = new Date().toISOString();
    return {
      pelada: {
        id: s.peladaId || null,
        nome: s.nome || "Pelada Oficial",
        status: "ENCERRADA",
        criadaEm: s.criadaEm || agora,
        encerradaEm: agora,
      },
      classificacao,
      times,
      artilharia,
      golsSofridos,
      cartoesAmarelos,
      cartoesVermelhos,
      totalAmarelos: cartoesAmarelos.reduce((a, c) => a + c.quantidade, 0),
      totalVermelhos: cartoesVermelhos.reduce((a, c) => a + c.quantidade, 0),
      golsContra,
      observacoes,
      partidas: partidasResumo,
      premios,
      _local: true,
    };
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
    salvarCronometro,
    lerCronometro,
    limparCronometro,
    adicionarObservacaoLocal,
    listarObservacoes,
    removerObservacaoLocal,
    montarPayloadSync,
    montarResumoLocal,
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

/**
 * Gera súmula oficial a partir de texto/planilha — sem marcar jogo ao vivo.
 */

const CORES_SUMULA = ["#1B5E20", "#0D47A1", "#B71C1C", "#E65100", "#4A148C", "#006064"];

const EXEMPLO_SUMULA = `FUTEBOL ENTRE AMIGOS
Data: 20/07/2026

TIME 1 - Ricardo
Goleiro: Júnior (6 gols sofridos)
1. Gleisinho
2. Bury
3. Miquéias 1 gol 1 assistência
4. Fernando 1 gol
5. Dudu 2 assistências
6. Ricardo

TIME 2 - Gabriel
Goleiro: Jonatan (6 gols sofridos)
1. Wesley
2. Guilherme
3. Juka
4. Gabriel A — 1 gol 1 assistência
5. Lucas R. — 1 gol
6. Gabriel 3 gols 2 assistências

TIME 3 - Abelardo
Goleiro:
1. Wesley P
2. Josiel
3. Lecão
4. Raian 1 assistência
5. Lucão
6. Abelardo

TIME 4 - Victor Santos
Goleiro:
1. Jonatas
2. Josué
3. Fábio — 1 gol
4. Geovane — 1 gol
5. Thalisson — 1 gol
6. Victor Santos — 1 gol

Cartões
Cartão amarelo
* Lucas Rocha: 2
* Fernando: 2
Cartão vermelho
* Nenhum

Partidas
1ª	Ricardo	1 x 0	Gabriel
2ª	Abelardo	0 x 0	Victor Santos
3ª	Ricardo	1 x 0	Gabriel
4ª	Ricardo	0 x 0	Abelardo
5ª	Victor Santos	0 x 1	Gabriel
6ª	Ricardo	0 x 0	Gabriel
7ª	Abelardo	0 x 0	Victor Santos
8ª	Gabriel	1 x 0	Ricardo
9ª	Gabriel	0 x 1	Victor Santos
10ª	Abelardo	0 x 2	Victor Santos
11ª	Ricardo	0 x 1	Victor Santos
12ª	Gabriel	2 x 1	Victor Santos
13ª	Gabriel	1 x 0	Abelardo

Time Campeão: Gabriel
Artilheiro: Gabriel
Craque: Gabriel
Garçom: Gabriel
Luva de Ouro: Júnior e Jonatan`;

function parseDataBrParaIso(texto) {
  const m = String(texto || "").match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!m) return new Date().toISOString();
  const [, d, mo, y] = m;
  return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}T12:00:00`;
}

function extrairStatsDoNome(linha) {
  const limpa = linha
    .replace(/^[0-9]+[.)]\s*/, "")
    .replace(/^[-*•]\s*/, "")
    .trim();
  const golsM = limpa.match(/(\d+)\s*gols?/i);
  const assM = limpa.match(/(\d+)\s*assist(?:[eê]ncias?)?/i);
  const gols = golsM ? Number(golsM[1]) : 0;
  const assistencias = assM ? Number(assM[1]) : 0;
  const nome = limpa
    .replace(/\s*[—\-–,]?\s*\d+\s*gols?/gi, "")
    .replace(/\s*[—\-–,]?\s*\d+\s*assist(?:[eê]ncias?)?/gi, "")
    .replace(/\s*[—\-–]\s*$/, "")
    .trim();
  return { nome: nome || limpa, gols, assistencias };
}

function parsePremioTexto(valor) {
  const v = String(valor || "").trim();
  if (!v || /^nenhum$/i.test(v) || v === "—" || v === "-") return null;
  const nomes = v
    .split(/\s+e\s+|\s*\/\s*|\s*,\s*/i)
    .map((n) => n.trim())
    .filter(Boolean);
  return {
    nome: nomes.join(" / "),
    nomes,
    empate: nomes.length > 1,
    detalhe: "",
  };
}

function calcularClassificacao(timesMap, partidas) {
  const stats = {};
  Object.keys(timesMap).forEach((nome) => {
    stats[nome] = { j: 0, v: 0, e: 0, d: 0, gp: 0, gc: 0, pts: 0 };
  });

  partidas.forEach((p) => {
    for (const t of [p.timeA, p.timeB]) {
      if (!stats[t]) stats[t] = { j: 0, v: 0, e: 0, d: 0, gp: 0, gc: 0, pts: 0 };
    }
    stats[p.timeA].j += 1;
    stats[p.timeB].j += 1;
    stats[p.timeA].gp += p.golsA;
    stats[p.timeA].gc += p.golsB;
    stats[p.timeB].gp += p.golsB;
    stats[p.timeB].gc += p.golsA;
    if (p.golsA > p.golsB) {
      stats[p.timeA].v += 1;
      stats[p.timeA].pts += 3;
      stats[p.timeB].d += 1;
    } else if (p.golsB > p.golsA) {
      stats[p.timeB].v += 1;
      stats[p.timeB].pts += 3;
      stats[p.timeA].d += 1;
    } else {
      stats[p.timeA].e += 1;
      stats[p.timeB].e += 1;
      stats[p.timeA].pts += 1;
      stats[p.timeB].pts += 1;
    }
  });

  return Object.entries(stats)
    .map(([nome, s]) => {
      const saldo = s.gp - s.gc;
      const aproveitamento = s.j ? Math.round((s.pts / (s.j * 3)) * 100) : 0;
      return {
        nome,
        pontos: s.pts,
        jogos: s.j,
        vitorias: s.v,
        empates: s.e,
        derrotas: s.d,
        golsPro: s.gp,
        golsContra: s.gc,
        saldo,
        aproveitamento,
        cor: timesMap[nome]?.cor || "#1B5E20",
      };
    })
    .sort((a, b) => {
      if (b.pontos !== a.pontos) return b.pontos - a.pontos;
      if (b.saldo !== a.saldo) return b.saldo - a.saldo;
      return b.golsPro - a.golsPro;
    })
    .map((t, i) => ({ ...t, posicao: i + 1 }));
}

/**
 * Converte o texto no formato da súmula em objeto compatível com renderResumoOficial.
 */
function montarResumoDeTexto(textoBruto) {
  const texto = String(textoBruto || "").replace(/\r\n/g, "\n").trim();
  if (!texto) throw new Error("Cole o texto da pelada antes de gerar.");

  const dataIso = parseDataBrParaIso(texto);
  let nomePelada = "Pelada Oficial";
  for (const linha of texto.split("\n").slice(0, 8)) {
    const t = linha.trim();
    if (!t || /^FUTEBOL/i.test(t) || /^Data:/i.test(t) || /^TIME\s*\d+/i.test(t)) continue;
    nomePelada = t;
    break;
  }

  const timesMap = {};
  const timesOrdem = [];
  const timeBlocks = [...texto.matchAll(/TIME\s*\d+\s*[-–—]\s*(.+)/gi)];

  for (let i = 0; i < timeBlocks.length; i++) {
    const block = timeBlocks[i];
    const nomeTime = block[1].trim();
    const start = block.index + block[0].length;
    const end = i + 1 < timeBlocks.length ? timeBlocks[i + 1].index : texto.length;
    const corpo = texto.slice(start, end);

    const secaoFim = corpo.search(/\n\s*(Cart[oõ]es|Partidas|Pontua[cç][aã]o|Campe[aã]o:|TIME\s*\d+)/i);
    const corpoTime = secaoFim >= 0 ? corpo.slice(0, secaoFim) : corpo;

    const gkMatch = corpoTime.match(/Goleiro:\s*([^\n]*)/i);
    let goleiro = null;
    if (gkMatch) {
      const gkLinha = gkMatch[1].trim();
      if (gkLinha && gkLinha !== "—" && gkLinha !== "-" && !/^\d+[.)]/.test(gkLinha)) {
        const sofridos = gkLinha.match(/(\d+)\s*gols?\s*sofridos?/i);
        const nomeGk = gkLinha.replace(/\s*\([^)]*\)\s*$/, "").trim();
        if (nomeGk) {
          goleiro = { nome: nomeGk, golsSofridos: sofridos ? Number(sofridos[1]) : 0 };
        }
      }
    }

    const jogadores = [];
    corpoTime.split("\n").forEach((linha) => {
      const t = linha.trim();
      if (!/^\d+[.)]/.test(t)) return;
      const { nome, gols, assistencias } = extrairStatsDoNome(t);
      if (nome) jogadores.push({ nome, gols, assistencias });
    });

    const cor = CORES_SUMULA[timesOrdem.length % CORES_SUMULA.length];
    timesMap[nomeTime] = { nome: nomeTime, cor, goleiro, jogadores };
    timesOrdem.push(nomeTime);
  }

  if (!timesOrdem.length) {
    throw new Error('Não achei times. Use o formato "TIME 1 - Nome".');
  }

  const partidas = [];
  const partidasMatch = texto.match(/Partidas([\s\S]*?)(?=\n\s*Pontua|\n\s*Time\s+Campe|\n\s*Campe|\n\s*Bola|\n\s*Luva|$)/i);
  const blocoPartidas = partidasMatch ? partidasMatch[1] : "";
  let partidaAtual = null;
  blocoPartidas.split("\n").forEach((linha) => {
    const t = linha.trim();
    if (!t || /^partida/i.test(t) || /^rodada/i.test(t)) return;
    const m =
      t.match(/^(\d+)\s*ª?\s+(.+?)\s+(\d+)\s*[xX×]\s*(\d+)\s+(.+)$/) ||
      t.match(/^(\d+)\s*ª?\t+(.+?)\t+(\d+)\s*[xX×]\s*(\d+)\t+(.+)$/);
    if (m) {
      const timeA = m[2].trim();
      const timeB = m[5].trim();
      partidaAtual = {
        numero: Number(m[1]),
        timeA,
        golsA: Number(m[3]),
        golsB: Number(m[4]),
        timeB,
        corA: timesMap[timeA]?.cor || "#1B5E20",
        corB: timesMap[timeB]?.cor || "#0D47A1",
        eventos: [],
      };
      partidas.push(partidaAtual);
      return;
    }
    if (!partidaAtual) return;
    const gol = t.match(/^Gol:\s*(.+?)(?:\s*[·•]\s*Assist[eê]ncia:\s*(.+))?$/i);
    if (gol) {
      partidaAtual.eventos.push({
        tipo: "GOL",
        jogadorNome: gol[1].trim(),
        assistenciaNome: gol[2] ? gol[2].trim() : null,
      });
      return;
    }
    const am = t.match(/^Cart[aã]o\s+amarelo:\s*(.+)$/i);
    if (am) {
      partidaAtual.eventos.push({ tipo: "CARTAO_AMARELO", jogadorNome: am[1].trim() });
      return;
    }
    const vm = t.match(/^Cart[aã]o\s+vermelho:\s*(.+)$/i);
    if (vm) {
      partidaAtual.eventos.push({ tipo: "CARTAO_VERMELHO", jogadorNome: vm[1].trim() });
    }
  });

  const classificacao = calcularClassificacao(timesMap, partidas);

  const amarelos = [];
  const vermelhos = [];
  let modoCartao = null;
  texto.split("\n").forEach((linha) => {
    const t = linha.trim();
    if (/cart[aã]o\s+amarelo/i.test(t)) {
      modoCartao = "A";
      return;
    }
    if (/cart[aã]o\s+vermelho/i.test(t)) {
      modoCartao = "V";
      return;
    }
    if (/^(Partidas|Pontua|Campe|TIME\s*\d+|Bola|Luva|Observ|Atraso|Gols?\s+contra)/i.test(t)) {
      modoCartao = null;
      return;
    }
    if (!modoCartao) return;
    if (/nenhum/i.test(t)) return;
    const cm = t.match(/^[*•\-]?\s*([^:]+):\s*(\d+)\s*$/);
    if (!cm) return;
    const item = { nome: cm[1].trim(), quantidade: Number(cm[2]) };
    if (modoCartao === "A") amarelos.push(item);
    else vermelhos.push(item);
  });

  const artilharia = [];
  const golsSofridos = [];
  timesOrdem.forEach((nomeTime) => {
    const t = timesMap[nomeTime];
    (t.jogadores || []).forEach((j) => {
      if (j.gols > 0) artilharia.push({ nome: j.nome, gols: j.gols, quantidade: j.gols, time: nomeTime });
    });
    if (t.goleiro) {
      golsSofridos.push({
        nome: t.goleiro.nome,
        quantidade: t.goleiro.golsSofridos,
        golsSofridos: t.goleiro.golsSofridos,
        time: nomeTime,
      });
    }
  });
  artilharia.sort((a, b) => b.gols - a.gols || a.nome.localeCompare(b.nome, "pt-BR"));
  // Só o artilheiro líder (e empatados, se houver)
  if (artilharia.length) {
    const maxGols = artilharia[0].gols;
    artilharia.splice(0, artilharia.length, ...artilharia.filter((a) => a.gols === maxGols));
  }
  golsSofridos.sort((a, b) => a.quantidade - b.quantidade || a.nome.localeCompare(b.nome, "pt-BR"));

  const rankingAssist = [];
  timesOrdem.forEach((nomeTime) => {
    (timesMap[nomeTime].jogadores || []).forEach((j) => {
      if (j.assistencias > 0) {
        rankingAssist.push({
          nome: j.nome,
          assistencias: j.assistencias,
          quantidade: j.assistencias,
          time: nomeTime,
        });
      }
    });
  });
  rankingAssist.sort((a, b) => b.assistencias - a.assistencias || a.nome.localeCompare(b.nome, "pt-BR"));

  const pegarCampo = (label) => {
    const re = new RegExp(`${label}\\s*:\\s*(.+)`, "i");
    const m = texto.match(re);
    return m ? m[1].trim() : null;
  };

  let premios = {
    campeao: classificacao[0]
      ? { nome: classificacao[0].nome, nomes: [classificacao[0].nome], empate: false, detalhe: `${classificacao[0].pontos} pts` }
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
    const tops = artilharia.filter((a) => a.gols === max);
    const premio = {
      nome: tops.map((t) => t.nome).join(" / "),
      nomes: tops.map((t) => t.nome),
      empate: tops.length > 1,
      detalhe: `${max} gol${max === 1 ? "" : "s"}`,
    };
    premios.artilheiro = premio;
    premios.bolaDeOuro = premio;
  }
  if (golsSofridos.length) {
    const min = golsSofridos[0].quantidade;
    const tops = golsSofridos.filter((g) => g.quantidade === min);
    premios.luvaDeOuro = {
      nome: tops.map((t) => t.nome).join(" / "),
      nomes: tops.map((t) => t.nome),
      empate: tops.length > 1,
      detalhe: `${min} sofrido${min === 1 ? "" : "s"}`,
    };
  }
  if (rankingAssist.length) {
    const maxA = rankingAssist[0].assistencias;
    const tops = rankingAssist.filter((a) => a.assistencias === maxA);
    premios.garcom = {
      nome: tops.map((t) => t.nome).join(" / "),
      nomes: tops.map((t) => t.nome),
      empate: tops.length > 1,
      detalhe: `${maxA} assistência${maxA === 1 ? "" : "s"}`,
    };
  }

  const qtdCartao = (lista, nome) =>
    (lista || []).find((c) => String(c.nome).toLowerCase() === String(nome).toLowerCase())?.quantidade || 0;
  const scoresCraque = [];
  timesOrdem.forEach((nomeTime) => {
    (timesMap[nomeTime].jogadores || []).forEach((j) => {
      const pts =
        (j.gols || 0) * 2 +
        (j.assistencias || 0) -
        qtdCartao(amarelos, j.nome) -
        qtdCartao(vermelhos, j.nome) * 2;
      scoresCraque.push({ nome: j.nome, pts });
    });
  });
  if (scoresCraque.length) {
    const maxC = Math.max(...scoresCraque.map((x) => x.pts));
    const tops = scoresCraque.filter((x) => x.pts === maxC);
    premios.craque = {
      nome: tops.map((t) => t.nome).join(" / "),
      nomes: tops.map((t) => t.nome),
      empate: tops.length > 1,
      detalhe: `${maxC} pt${maxC === 1 ? "" : "s"} (gol 2 · assistência 1 · A -1 · V -2)`,
    };
  }

  const campeaoTxt = pegarCampo("Campe[aã]o");
  const artilheiroTxt = pegarCampo("Artilheiro") || pegarCampo("Bola de Ouro");
  const craqueTxt = pegarCampo("Craque");
  const garcomTxt = pegarCampo("Gar[cç]om") || pegarCampo("Assist[eê]ncia");
  const luvaTxt = pegarCampo("Luva de Ouro");
  if (campeaoTxt !== null) {
    const p = parsePremioTexto(campeaoTxt);
    if (p) premios.campeao = { ...p, detalhe: premios.campeao?.detalhe || "" };
  }
  if (artilheiroTxt !== null) {
    const p = parsePremioTexto(artilheiroTxt);
    premios.artilheiro = p ? { ...p, detalhe: premios.artilheiro?.detalhe || "" } : null;
    premios.bolaDeOuro = premios.artilheiro;
  }
  if (craqueTxt !== null) {
    const p = parsePremioTexto(craqueTxt);
    if (p) premios.craque = { ...p, detalhe: premios.craque?.detalhe || "" };
  }
  if (garcomTxt !== null) {
    const p = parsePremioTexto(garcomTxt);
    if (p) premios.garcom = { ...p, detalhe: premios.garcom?.detalhe || "" };
  }
  if (luvaTxt !== null) {
    const p = parsePremioTexto(luvaTxt);
    premios.luvaDeOuro = p ? { ...p, detalhe: premios.luvaDeOuro?.detalhe || "" } : null;
  }

  const times = timesOrdem.map((nome) => {
    const t = timesMap[nome];
    return {
      nome: t.nome,
      cor: t.cor,
      goleiro: t.goleiro,
      jogadores: t.jogadores,
    };
  });

  return {
    pelada: {
      nome: nomePelada,
      status: "ENCERRADA",
      criadaEm: dataIso,
      encerradaEm: dataIso,
      quantidadeTimes: times.length,
    },
    classificacao,
    times,
    partidas,
    artilharia,
    assistencias: rankingAssist,
    golsSofridos,
    cartoesAmarelos: amarelos,
    cartoesVermelhos: vermelhos,
    totalAmarelos: amarelos.reduce((s, c) => s + c.quantidade, 0),
    totalVermelhos: vermelhos.reduce((s, c) => s + c.quantidade, 0),
    golsContra: [],
    observacoes: [...texto.matchAll(/Atraso:\s*(.+?)\s+às\s+(\d{1,2}:\d{2})/gi)].map((m) => ({
      tipo: "ATRASO",
      jogadorNome: m[1].trim(),
      horario: m[2],
    })),
    premios,
  };
}

function baixarPlanilhaCsv(resumo) {
  const linhas = [];
  const esc = (v) => {
    const s = String(v ?? "");
    return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const row = (...cols) => linhas.push(cols.map(esc).join(";"));

  row("FUTEBOL ENTRE AMIGOS");
  row("Pelada", resumo.pelada?.nome || "Pelada Oficial");
  row("Data", formatarDataBr(resumo.pelada?.encerradaEm || resumo.pelada?.criadaEm));
  row("");
  row("CLASSIFICAÇÃO");
  row("Pos", "Time", "Pts", "J", "V", "E", "D", "GP", "GC", "SG", "%");
  (resumo.classificacao || []).forEach((t) => {
    row(t.posicao, t.nome, t.pontos, t.jogos, t.vitorias, t.empates, t.derrotas, t.golsPro, t.golsContra, t.saldo, t.aproveitamento);
  });
  row("");
  row("PREMIAÇÃO");
  row("Prêmio", "Vencedor");
  const premios = resumo.premios || {};
  row("Time Campeão", premios.campeao?.nome || "—");
  row("Artilheiro", (premios.artilheiro || premios.bolaDeOuro)?.nome || "—");
  row("Craque", premios.craque?.nome || "—");
  row("Garçom", premios.garcom?.nome || "—");
  row("Luva de Ouro", premios.luvaDeOuro?.nome || "—");
  row("");
  row("TIMES");
  (resumo.times || []).forEach((t) => {
    row(t.nome);
    row("Goleiro", t.goleiro ? `${t.goleiro.nome} (${t.goleiro.golsSofridos ?? 0} sofridos)` : "—");
    row("#", "Jogador", "Gols", "Assistências");
    (t.jogadores || []).forEach((j, i) => row(i + 1, j.nome, j.gols || 0, j.assistencias || 0));
    row("");
  });
  row("ARTILHARIA");
  row("Jogador", "Gols", "Time");
  (resumo.artilharia || []).forEach((a) => row(a.nome, a.gols || a.quantidade, a.time || ""));
  row("");
  row("ASSISTÊNCIAS");
  row("Jogador", "Assistências", "Time");
  (resumo.assistencias || []).forEach((a) => row(a.nome, a.assistencias || a.quantidade, a.time || ""));
  row("");
  row("CARTÕES AMARELOS");
  row("Jogador", "Qtd");
  (resumo.cartoesAmarelos || []).forEach((c) => row(c.nome, c.quantidade));
  row("");
  row("CARTÕES VERMELHOS");
  row("Jogador", "Qtd");
  (resumo.cartoesVermelhos || []).forEach((c) => row(c.nome, c.quantidade));
  row("");
  row("PARTIDAS");
  row("Rodada", "Time A", "Gols A", "Gols B", "Time B", "Lances");
  (resumo.partidas || []).forEach((p) =>
    row(`${p.numero}ª`, p.timeA, p.golsA, p.golsB, p.timeB, typeof textoDetalhePartida === "function" ? textoDetalhePartida(p) : p.detalhe || "")
  );

  const blob = new Blob(["\uFEFF" + linhas.join("\n")], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  const nome = (resumo.pelada?.nome || "pelada").replace(/\s+/g, "-").toLowerCase();
  a.href = URL.createObjectURL(blob);
  a.download = `sumula-${nome}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

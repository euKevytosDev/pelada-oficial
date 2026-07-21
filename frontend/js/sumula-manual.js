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
3. Miquéias 1 gol
4. Fernando 1 gol
5. Dudu
6. Ricardo

TIME 2 - Gabriel
Goleiro: Jonatan (6 gols sofridos)
1. Wesley
2. Guilherme
3. Juka
4. Gabriel A — 1 gol
5. Lucas R. — 1 gol
6. Gabriel 3 gols

TIME 3 - Abelardo
Goleiro:
1. Wesley P
2. Josiel
3. Lecão
4. Raian
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

Campeão: Gabriel
Bola de Ouro: Gabriel
Luva de Ouro: Júnior e Jonatan
Bola Murcha: Nenhum`;

function parseDataBrParaIso(texto) {
  const m = String(texto || "").match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!m) return new Date().toISOString();
  const [, d, mo, y] = m;
  return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}T12:00:00`;
}

function extrairGolsDoNome(linha) {
  const limpa = linha
    .replace(/^[0-9]+[.)]\s*/, "")
    .replace(/^[-*•]\s*/, "")
    .trim();
  const match = limpa.match(/^(.*?)(?:\s*[—\-–]?\s*(\d+)\s*gols?)?\s*$/i);
  if (!match) return { nome: limpa, gols: 0 };
  const nome = (match[1] || "").replace(/\s*[—\-–]\s*$/, "").trim();
  const gols = match[2] ? Number(match[2]) : 0;
  return { nome, gols };
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

  const dataIso = (() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}T12:00:00`;
  })();

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
      const { nome, gols } = extrairGolsDoNome(t);
      if (nome) jogadores.push({ nome, gols });
    });

    const cor = CORES_SUMULA[timesOrdem.length % CORES_SUMULA.length];
    timesMap[nomeTime] = { nome: nomeTime, cor, goleiro, jogadores };
    timesOrdem.push(nomeTime);
  }

  if (!timesOrdem.length) {
    throw new Error('Não achei times. Use o formato "TIME 1 - Nome".');
  }

  const partidas = [];
  const partidasMatch = texto.match(/Partidas([\s\S]*?)(?=\n\s*Pontua|\n\s*Campe|\n\s*Bola|\n\s*Luva|$)/i);
  const blocoPartidas = partidasMatch ? partidasMatch[1] : "";
  blocoPartidas.split("\n").forEach((linha) => {
    const t = linha.trim();
    if (!t || /^partida/i.test(t) || /^rodada/i.test(t)) return;
    const m =
      t.match(/^(\d+)\s*ª?\s+(.+?)\s+(\d+)\s*[xX×]\s*(\d+)\s+(.+)$/) ||
      t.match(/^(\d+)\s*ª?\t+(.+?)\t+(\d+)\s*[xX×]\s*(\d+)\t+(.+)$/);
    if (!m) return;
    const timeA = m[2].trim();
    const timeB = m[5].trim();
    partidas.push({
      numero: Number(m[1]),
      timeA,
      golsA: Number(m[3]),
      golsB: Number(m[4]),
      timeB,
      corA: timesMap[timeA]?.cor || "#1B5E20",
      corB: timesMap[timeB]?.cor || "#0D47A1",
    });
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
    if (/^(Partidas|Pontua|Campe|TIME\s*\d+|Bola|Luva)/i.test(t)) {
      modoCartao = null;
      return;
    }
    if (!modoCartao) return;
    if (/nenhum/i.test(t)) return;
    const cm = t.match(/^[*•\-]?\s*(.+?)\s*:\s*(\d+)\s*$/);
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
  golsSofridos.sort((a, b) => a.quantidade - b.quantidade || a.nome.localeCompare(b.nome, "pt-BR"));

  const pegarCampo = (label) => {
    const re = new RegExp(`${label}\\s*:\\s*(.+)`, "i");
    const m = texto.match(re);
    return m ? m[1].trim() : null;
  };

  let premios = {
    campeao: classificacao[0]
      ? { nome: classificacao[0].nome, nomes: [classificacao[0].nome], empate: false, detalhe: `${classificacao[0].pontos} pts` }
      : null,
    bolaDeOuro: null,
    luvaDeOuro: null,
    bolaMurcha: null,
  };

  if (artilharia.length) {
    const max = artilharia[0].gols;
    const tops = artilharia.filter((a) => a.gols === max);
    premios.bolaDeOuro = {
      nome: tops.map((t) => t.nome).join(" / "),
      nomes: tops.map((t) => t.nome),
      empate: tops.length > 1,
      detalhe: `${max} gol${max === 1 ? "" : "s"}`,
    };
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

  const campeaoTxt = pegarCampo("Campe[aã]o");
  const bolaTxt = pegarCampo("Bola de Ouro");
  const luvaTxt = pegarCampo("Luva de Ouro");
  const murchaTxt = pegarCampo("Bola Murcha");
  if (campeaoTxt !== null) {
    const p = parsePremioTexto(campeaoTxt);
    if (p) premios.campeao = { ...p, detalhe: premios.campeao?.detalhe || "" };
  }
  if (bolaTxt !== null) {
    const p = parsePremioTexto(bolaTxt);
    premios.bolaDeOuro = p ? { ...p, detalhe: premios.bolaDeOuro?.detalhe || "" } : null;
  }
  if (luvaTxt !== null) {
    const p = parsePremioTexto(luvaTxt);
    premios.luvaDeOuro = p ? { ...p, detalhe: premios.luvaDeOuro?.detalhe || "" } : null;
  }
  if (murchaTxt !== null) {
    premios.bolaMurcha = parsePremioTexto(murchaTxt);
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
      nome: "Pelada Oficial",
      status: "ENCERRADA",
      criadaEm: dataIso,
      encerradaEm: dataIso,
      quantidadeTimes: times.length,
    },
    classificacao,
    times,
    partidas,
    artilharia,
    golsSofridos,
    cartoesAmarelos: amarelos,
    cartoesVermelhos: vermelhos,
    totalAmarelos: amarelos.reduce((s, c) => s + c.quantidade, 0),
    totalVermelhos: vermelhos.reduce((s, c) => s + c.quantidade, 0),
    golsContra: [],
    observacoes: [],
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
  row("Campeão", premios.campeao?.nome || "—");
  row("Bola de Ouro", premios.bolaDeOuro?.nome || "—");
  row("Luva de Ouro", premios.luvaDeOuro?.nome || "—");
  row("Bola Murcha", premios.bolaMurcha?.nome || "—");
  row("");
  row("TIMES");
  (resumo.times || []).forEach((t) => {
    row(t.nome);
    row("Goleiro", t.goleiro ? `${t.goleiro.nome} (${t.goleiro.golsSofridos ?? 0} sofridos)` : "—");
    row("#", "Jogador", "Gols");
    (t.jogadores || []).forEach((j, i) => row(i + 1, j.nome, j.gols || 0));
    row("");
  });
  row("ARTILHARIA");
  row("Jogador", "Gols", "Time");
  (resumo.artilharia || []).forEach((a) => row(a.nome, a.gols || a.quantidade, a.time || ""));
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
  row("Rodada", "Time A", "Gols A", "Gols B", "Time B");
  (resumo.partidas || []).forEach((p) => row(`${p.numero}ª`, p.timeA, p.golsA, p.golsB, p.timeB));

  const blob = new Blob(["\uFEFF" + linhas.join("\n")], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  const nome = (resumo.pelada?.nome || "pelada").replace(/\s+/g, "-").toLowerCase();
  a.href = URL.createObjectURL(blob);
  a.download = `sumula-${nome}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

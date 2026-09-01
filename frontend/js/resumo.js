/**
 * Resumo final profissional da pelada (estilo súmula + Brasileirão).
 */

/** Data de hoje no fuso do aparelho (relatório sempre com o dia real). */
function dataHojeBr() {
  try {
    return new Date().toLocaleDateString("pt-BR", {
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || undefined,
    });
  } catch (_) {
    return new Date().toLocaleDateString("pt-BR");
  }
}

function formatarDataBr(iso) {
  if (!iso) return dataHojeBr();
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso).slice(0, 10);
  return d.toLocaleDateString("pt-BR");
}

/** Agrupa nomes iguais: João, João → João (2) — usado em listas compactas */
function nomesAgrupados(nomes) {
  const contagem = new Map();
  (nomes || []).forEach((n) => {
    const key = n || "?";
    contagem.set(key, (contagem.get(key) || 0) + 1);
  });
  return [...contagem.entries()]
    .map(([nome, qtd]) => (qtd > 1 ? `${nome} (${qtd})` : nome))
    .join(", ");
}

/**
 * Lances da partida, um por linha, bem claros:
 * "Gol: Fulano · Assistência: Beltrano"
 * "Cartão amarelo: Ciclano"
 */
function linhasDetalhePartida(partida) {
  const eventos = partida?.eventos || [];
    if (!eventos.length) {
      // detalhe do backend (novo: 1 linha por lance; antigo: · )
      if (partida?.detalhe && typeof partida.detalhe === "string") {
        return partida.detalhe
          .split(/\n|·/)
          .map((s) => s.trim())
          .filter(Boolean);
      }
      return [];
    }

  const linhas = [];
  eventos.forEach((e) => {
    const nome = e.jogadorNome || e.nome || "?";
    const tipo = e.tipo;
    if (tipo === "GOL") {
      const ass = e.assistenciaNome;
      if (ass && String(ass) !== "null" && String(ass).trim()) {
        linhas.push(`Gol: ${nome} · Assistência: ${ass}`);
      } else {
        linhas.push(`Gol: ${nome}`);
      }
    } else if (tipo === "GOL_CONTRA") {
      linhas.push(`Gol contra: ${nome}`);
    } else if (tipo === "CARTAO_AMARELO") {
      linhas.push(`Cartão amarelo: ${nome}`);
    } else if (tipo === "CARTAO_VERMELHO") {
      linhas.push(`Cartão vermelho: ${nome}`);
    }
  });
  return linhas;
}

/** Texto para WhatsApp (linhas com quebra). */
function textoDetalhePartida(partida) {
  return linhasDetalhePartida(partida).join("\n   ");
}

function tabelaBrasileirao(classificacao) {
  if (!classificacao || !classificacao.length) {
    return `<p class="vazio">Sem classificação ainda.</p>`;
  }
  return `
    <div class="tabela-scroll">
      <table class="tabela-bra">
        <thead>
          <tr>
            <th class="pos">#</th>
            <th class="time">Time</th>
            <th class="num">P</th>
            <th class="num">J</th>
            <th class="num">V</th>
            <th class="num">E</th>
            <th class="num">D</th>
            <th class="num">GP</th>
            <th class="num">GC</th>
            <th class="num">SG</th>
            <th class="num">%</th>
          </tr>
        </thead>
        <tbody>
          ${classificacao
            .map(
              (t, i) => `
            <tr class="${i === 0 ? "lider" : ""}">
              <td class="pos">${t.posicao}</td>
              <td class="time"><span class="cor-dot" style="background:${t.cor}"></span>${t.nome}</td>
              <td class="num pts">${t.pontos}</td>
              <td class="num">${t.jogos}</td>
              <td class="num">${t.vitorias}</td>
              <td class="num">${t.empates}</td>
              <td class="num">${t.derrotas}</td>
              <td class="num">${t.golsPro}</td>
              <td class="num">${t.golsContra}</td>
              <td class="num">${t.saldo > 0 ? "+" : ""}${t.saldo}</td>
              <td class="num">${t.aproveitamento}</td>
            </tr>`
            )
            .join("")}
        </tbody>
      </table>
    </div>`;
}

function listaSimples(itens, vazio) {
  if (!itens || !itens.length) return `<p class="vazio">${vazio}</p>`;
  return `<ul class="lista-resumo">${itens
    .map((i) => `<li><span>${i.nome}${i.time ? ` <em>(${i.time})</em>` : ""}</span><strong>${i.quantidade ?? i.gols ?? ""}</strong></li>`)
    .join("")}</ul>`;
}

/** Só o líder da artilharia; se empatar, mantém todos empatados. */
function artilheirosLideres(lista) {
  if (!lista || !lista.length) return [];
  const max = Math.max(...lista.map((a) => Number(a.gols ?? a.quantidade) || 0));
  if (max <= 0) return [];
  return lista.filter((a) => (Number(a.gols ?? a.quantidade) || 0) === max);
}

function listaObservacoes(itens) {
  if (!itens || !itens.length) return `<p class="vazio">Nenhuma observação.</p>`;
  return `<ul class="lista-resumo">${itens
    .map((o) => {
      const hora = o.horario ? ` às ${o.horario}` : "";
      const extra = o.texto ? ` — ${o.texto}` : "";
      const tipo = o.tipo === "ATRASO" ? "Atraso" : o.tipo || "Obs.";
      return `<li><span><strong>${tipo}:</strong> ${o.jogadorNome || "?"}${hora}${extra}</span></li>`;
    })
    .join("")}</ul>`;
}

const PREMIO_ICONE = {
  Artilheiro: "⚽",
  Craque: "⭐",
  Garçom: "🎯",
  "Luva de Ouro": "🧤",
};

function normalizarNomeTime(n) {
  return String(n || "")
    .trim()
    .toLowerCase();
}

function nomeTimeCampeaoResumo(resumo) {
  const campeao = resumo?.premios?.campeao;
  if (campeao?.nome) return String(campeao.nome).trim();
  const lider =
    (resumo?.classificacao || []).find((t) => Number(t.posicao) === 1) || resumo?.classificacao?.[0];
  return lider?.nome ? String(lider.nome).trim() : null;
}

function statsJogadorNoResumo(resumo, nome) {
  if (!nome || !resumo) return null;
  let gols = 0;
  let ass = 0;
  (resumo.times || []).forEach((t) => {
    (t.jogadores || []).forEach((j) => {
      if (String(j.nome).trim() === String(nome).trim()) {
        gols = Number(j.gols) || 0;
        ass = Number(j.assistencias) || 0;
      }
    });
  });
  const am =
    (resumo.cartoesAmarelos || []).find((c) => String(c.nome).trim() === String(nome).trim())?.quantidade || 0;
  const ver =
    (resumo.cartoesVermelhos || []).find((c) => String(c.nome).trim() === String(nome).trim())?.quantidade || 0;
  const pts = gols * 2 + ass - am - ver * 2;
  return { gols, ass, am, ver, pts };
}

function montarDetalheCraqueCompacto(stats, ptsFallback) {
  const pts = stats?.pts ?? ptsFallback;
  if (pts == null || Number.isNaN(pts)) return "";
  const parts = [`${pts} pts`];
  if (stats?.gols) parts.push(`gol ${stats.gols}`);
  if (stats?.ass) parts.push(`ass ${stats.ass}`);
  if (stats?.am) parts.push(`A ${stats.am}`);
  if (stats?.ver) parts.push(`V ${stats.ver}`);
  return parts.join(" · ");
}

function montarDetalhePremioCompacto(titulo, premio, resumo) {
  if (!premio) return "";
  const raw = String(premio.detalhe || "").trim();
  const num = (re) => {
    const m = raw.match(re);
    return m ? Number(m[1]) : null;
  };

  if (titulo === "Artilheiro") {
    const n = num(/(\d+)\s*gol/i) ?? num(/^gol\s*(\d+)/i);
    return n != null ? `gol ${n}` : raw;
  }
  if (titulo === "Garçom") {
    const n = num(/(\d+)\s*assist/i) ?? num(/^ass\s*(\d+)/i);
    return n != null ? `ass ${n}` : raw;
  }
  if (titulo === "Luva de Ouro") {
    const n = num(/(\d+)\s*sofr/i) ?? num(/^sofr\s*(\d+)/i);
    return n != null ? `sofr ${n}` : raw;
  }
  if (titulo === "Craque") {
    if (/pts\s·/.test(raw) && !/\(/.test(raw)) return raw;
    const ptsFallback = num(/^(-?\d+)\s*pt/i);
    const nome = (premio.nomes && premio.nomes[0]) || premio.nome;
    const stats = statsJogadorNoResumo(resumo, nome);
    if (stats) return montarDetalheCraqueCompacto(stats, ptsFallback ?? stats.pts);
    return ptsFallback != null ? `${ptsFallback} pts` : raw.replace(/\s*\([^)]*\)\s*/g, "").trim();
  }
  return raw;
}

function premiosGridHtml(premios, resumo) {
  const slots = [
    { titulo: "Artilheiro", premio: premios.artilheiro || premios.bolaDeOuro, key: "artilheiro" },
    { titulo: "Craque", premio: premios.craque, key: "craque" },
    { titulo: "Garçom", premio: premios.garcom, key: "garcom" },
    { titulo: "Luva de Ouro", premio: premios.luvaDeOuro, key: "luvaDeOuro" },
  ];
  const linhas = [];
  for (let i = 0; i < slots.length; i += 2) {
    const par = slots
      .slice(i, i + 2)
      .map((s) => premioCard(s.titulo, s.premio, s.key, resumo))
      .join("");
    linhas.push(`<div class="premios-par">${par}</div>`);
  }
  return `<div class="premios">${linhas.join("")}</div>`;
}

function premioTituloCardHtml(titulo, premio, nomesHtml, resumo) {
  const icone = PREMIO_ICONE[titulo] || "";
  const detalhe = montarDetalhePremioCompacto(titulo, premio, resumo);
  return `<header class="premio-titulo-card">
    <div class="premio-titulo-cat">
      ${icone ? `<span class="premio-ico" aria-hidden="true">${icone}</span>` : ""}
      <span class="premio-categoria">${titulo}</span>
    </div>
    <div class="premio-titulo-nome">${nomesHtml}</div>
    <p class="premio-detalhe">${detalhe}</p>
  </header>`;
}

function premioCard(titulo, premio, fotoKey, resumo) {
  const icone = PREMIO_ICONE[titulo] || "";
  if (!premio) {
    return `<article class="premio premio-compacto"><h4 class="premio-badge">${icone ? `<span class="premio-ico" aria-hidden="true">${icone}</span>` : ""}${titulo}</h4><p class="vazio">—</p></article>`;
  }
  const nomes = premio.nomes && premio.nomes.length ? premio.nomes : [premio.nome];
  const nomesHtml = nomes.map((n) => `<p class="premio-nome">${n}</p>`).join("");
  const foto =
    fotoKey && typeof FotosPremios !== "undefined" ? FotosPremios.get(fotoKey) : null;
  const tituloHeader = premioTituloCardHtml(titulo, premio, nomesHtml, resumo);
  if (foto) {
    return `<article class="premio premio-destaque premio-com-foto">
      ${tituloHeader}
      <div class="premio-foto-wrap">
        <img class="premio-foto" src="${foto}" alt="${titulo}" decoding="async" />
      </div>
    </article>`;
  }
  return `<article class="premio premio-compacto">
    ${tituloHeader}
  </article>`;
}

function campeaoHeroHtml(resumo, campeaoNome) {
  const foto = typeof FotosPremios !== "undefined" ? FotosPremios.get("campeao") : null;
  if (!foto || !campeaoNome) return "";
  const detalhe = resumo?.premios?.campeao?.detalhe || "";
  return `<div class="campeao-foto-hero">
    <img class="campeao-foto-img" src="${foto}" alt="Time campeão ${campeaoNome}" decoding="async" />
    <div class="campeao-foto-overlay">
      <p class="campeao-foto-eyebrow">Time campeão</p>
      <h3 class="campeao-foto-nome">${campeaoNome}</h3>
      ${detalhe ? `<p class="campeao-foto-detalhe">${detalhe}</p>` : ""}
    </div>
  </div>`;
}

function renderResumoOficial(resumo) {
  const el = document.getElementById("resumo-oficial");
  if (!el || !resumo) return;

  const p = resumo.pelada || {};
  const premios = resumo.premios || {};
  const campeaoNome = nomeTimeCampeaoResumo(resumo);

  const timesHtml = (resumo.times || [])
    .map((t) => {
      const isCampeao =
        campeaoNome && normalizarNomeTime(t.nome) === normalizarNomeTime(campeaoNome);
      const gk = t.goleiro
        ? `${t.goleiro.nome} <span class="meta">(${t.goleiro.golsSofridos ?? 0} sofridos)</span>`
        : "sem goleiro";
      const jogadores = (t.jogadores || [])
        .map((j) => {
          const gols = j.gols || 0;
          const ass = j.assistencias || 0;
          const contra = j.golsContra || 0;
          const contraTxt = contra ? ` · ${contra} contra` : "";
          return `<li><span>${j.nome}</span><span class="meta">${gols} gol(s) · ${ass} assist.${contraTxt}</span></li>`;
        })
        .join("");
      return `
        <article class="time-resumo${isCampeao ? " time-resumo-campeao" : ""}" style="border-left-color:${t.cor}">
          ${isCampeao ? '<p class="time-campeao-faixa">Campeão</p>' : ""}
          <h3>${t.nome}</h3>
          <p class="gk-linha">Goleiro: <strong>${gk}</strong></p>
          <ul class="lista-resumo">${jogadores || "<li class='vazio'>Sem jogadores</li>"}</ul>
        </article>`;
    })
    .join("");

  const partidasHtml = (resumo.partidas || []).length
    ? `<ul class="lista-partidas">${resumo.partidas
        .map((m) => {
          const linhas = linhasDetalhePartida(m);
          const lancesHtml = linhas.length
            ? `<ul class="partida-lances">${linhas.map((l) => `<li>${l}</li>`).join("")}</ul>`
            : "";
          return `
        <li class="partida-resumo-item">
          <span class="rod">${String(m.numero).padStart(2, "0")}ª</span>
          <div class="partida-linha">
            <span class="placar-mini">
              <strong style="color:${m.corA}">${m.timeA}</strong>
              <b>${m.golsA}</b>
              <i>x</i>
              <b>${m.golsB}</b>
              <strong style="color:${m.corB}">${m.timeB}</strong>
            </span>
            ${lancesHtml}
          </div>
        </li>`;
        })
        .join("")}</ul>`
    : `<p class="vazio">Nenhuma partida registrada.</p>`;

  el.innerHTML = `
    <div class="resumo-capa-pdf">
      <header class="resumo-topo">
        <div>
          <p class="eyebrow">Futebol entre amigos</p>
          <h2>${p.nome || "Minha pelada"}</h2>
        </div>
        <p class="resumo-data">${formatarDataBr(p.encerradaEm || p.criadaEm)}</p>
      </header>

      <section class="resumo-bloco resumo-classificacao">
        <h3>Classificação</h3>
        ${tabelaBrasileirao(resumo.classificacao)}
      </section>

      <section class="resumo-bloco premios-grid">
        <h3>Premiação</h3>
        ${premiosGridHtml(premios, resumo)}
      </section>
    </div>

    <div class="resumo-pagina-campeao-pdf">
      ${campeaoHeroHtml(resumo, campeaoNome)}
      <section class="resumo-bloco resumo-times">
        <h3>Times e goleiros</h3>
        <div class="times-resumo-grid">${timesHtml || '<p class="vazio">Sem times</p>'}</div>
      </section>
    </div>

    <div class="resumo-pagina-stats-pdf">
    <section class="resumo-bloco">
      <h3>Gols sofridos (goleiros)</h3>
      ${listaSimples(resumo.golsSofridos, "Nenhum goleiro cadastrado.")}
    </section>

    <section class="resumo-bloco duas-cols">
      <div>
        <h3>Cartão amarelo <span class="badge-qtd">${resumo.totalAmarelos || 0}</span></h3>
        ${listaSimples(resumo.cartoesAmarelos, "Nenhum amarelo.")}
      </div>
      <div>
        <h3>Cartão vermelho <span class="badge-qtd vermelho">${resumo.totalVermelhos || 0}</span></h3>
        ${listaSimples(resumo.cartoesVermelhos, "Nenhum vermelho.")}
      </div>
    </section>

    <section class="resumo-bloco">
      <h3>Gols contra</h3>
      ${listaSimples(resumo.golsContra, "Nenhum gol contra.")}
    </section>

    <section class="resumo-bloco">
      <h3>Observações</h3>
      ${listaObservacoes(resumo.observacoes)}
    </section>

    <section class="resumo-bloco">
      <h3>Partidas</h3>
      ${partidasHtml}
    </section>
    </div>

    <footer class="resumo-rodape">Gerado por Rei da Pelada</footer>
  `;

  if (typeof FotosPremios !== "undefined") {
    FotosPremios.syncPainel(resumo);
  }
}

function textoResumoWhatsApp(resumo) {
  const p = resumo.pelada || {};
  const linhas = [];
  linhas.push(`*${p.nome || "Minha pelada"}*`);
  linhas.push(`📅 ${formatarDataBr(p.encerradaEm || p.criadaEm)}`);
  linhas.push("");
  linhas.push("*Classificação*");
  (resumo.classificacao || []).forEach((t) => {
    linhas.push(`${t.posicao}º ${t.nome} — ${t.pontos} pts (V${t.vitorias} E${t.empates} D${t.derrotas}) SG ${t.saldo}`);
  });

  const premios = resumo.premios || {};
  linhas.push("");
  linhas.push("*Premiação*");
  if (premios.campeao) linhas.push(`🏆 Time Campeão: ${premios.campeao.nome}`);
  const artilheiro = premios.artilheiro || premios.bolaDeOuro;
  if (artilheiro) {
    linhas.push(`⚽ Artilheiro: ${artilheiro.nome} (${artilheiro.detalhe})`);
  }
  if (premios.craque) {
    linhas.push(`⭐ Craque: ${premios.craque.nome} (${premios.craque.detalhe})`);
  }
  if (premios.garcom) {
    linhas.push(`🎯 Garçom: ${premios.garcom.nome} (${premios.garcom.detalhe})`);
  }
  if (premios.luvaDeOuro) {
    linhas.push(`🧤 Luva de Ouro: ${premios.luvaDeOuro.nome} (${premios.luvaDeOuro.detalhe})`);
  }

  const artilheiros = artilheirosLideres(resumo.artilharia);
  if (artilheiros.length) {
    linhas.push("");
    linhas.push("*Artilharia*");
    artilheiros.forEach((a) => linhas.push(`• ${a.nome}: ${a.gols || a.quantidade}`));
  }

  if ((resumo.golsSofridos || []).length) {
    linhas.push("");
    linhas.push("*Gols sofridos (GK)*");
    resumo.golsSofridos.forEach((g) => linhas.push(`• ${g.nome}: ${g.quantidade}`));
  }

  if ((resumo.cartoesAmarelos || []).length) {
    linhas.push("");
    linhas.push(`*Amarelos (${resumo.totalAmarelos})*`);
    resumo.cartoesAmarelos.forEach((c) => linhas.push(`• ${c.nome}: ${c.quantidade}`));
  }
  if ((resumo.cartoesVermelhos || []).length) {
    linhas.push("");
    linhas.push(`*Vermelhos (${resumo.totalVermelhos})*`);
    resumo.cartoesVermelhos.forEach((c) => linhas.push(`• ${c.nome}: ${c.quantidade}`));
  }
  if ((resumo.golsContra || []).length) {
    linhas.push("");
    linhas.push("*Gols contra*");
    resumo.golsContra.forEach((c) => linhas.push(`• ${c.nome}: ${c.quantidade}`));
  }
  if ((resumo.observacoes || []).length) {
    linhas.push("");
    linhas.push("*Observações*");
    resumo.observacoes.forEach((o) => {
      const hora = o.horario ? ` às ${o.horario}` : "";
      const extra = o.texto ? ` — ${o.texto}` : "";
      linhas.push(`• ${o.tipo === "ATRASO" ? "Atraso" : o.tipo}: ${o.jogadorNome}${hora}${extra}`);
    });
  }

  if ((resumo.partidas || []).length) {
    linhas.push("");
    linhas.push("*Partidas*");
    resumo.partidas.forEach((m) => {
      const lances = linhasDetalhePartida(m);
      linhas.push(
        `${String(m.numero).padStart(2, "0")}ª ${m.timeA} ${m.golsA} x ${m.golsB} ${m.timeB}`
      );
      lances.forEach((l) => linhas.push(`   ${l}`));
    });
  }

  linhas.push("");
  linhas.push("_Rei da Pelada_");
  return linhas.join("\n");
}

async function compartilharWhatsApp(resumo) {
  const texto = textoResumoWhatsApp(resumo);
  const url = `https://wa.me/?text=${encodeURIComponent(texto)}`;
  window.open(url, "_blank");
}

async function compartilharNativo(resumo) {
  const texto = textoResumoWhatsApp(resumo);
  if (navigator.share) {
    await navigator.share({
      title: resumo.pelada?.nome || "Minha pelada",
      text: texto,
    });
    return;
  }
  await navigator.clipboard.writeText(texto);
  toast("Resumo copiado! Cole no WhatsApp.");
}

async function baixarPdfResumo() {
  if (typeof PlanoApp !== "undefined" && !PlanoApp.exigirPro("Para baixar o PDF, faça o upgrade para o Rei da Pelada Pro")) return;
  const el = document.getElementById("resumo-oficial");
  if (!el) return;
  if (typeof html2pdf === "undefined") {
    window.print();
    return;
  }
  if (typeof FotosPremios !== "undefined") {
    await FotosPremios.aguardarImagensResumo(el);
  }
  const nome = (estado.resumoAtual?.pelada?.nome || "pelada").replace(/\s+/g, "-").toLowerCase();
  const opt = opcoesPdfPadrao(`resumo-${nome}.pdf`);
  const baixar = () => baixarPdfHtml(el, opt);
  if (typeof comLoading === "function") {
    await comLoading(baixar, "Gerando PDF...");
  } else {
    await baixar();
  }
}

async function baixarPdfElemento(elId, filename) {
  if (typeof PlanoApp !== "undefined" && !PlanoApp.exigirPro("Para baixar o PDF, faça o upgrade para o Rei da Pelada Pro")) return;
  const el = document.getElementById(elId);
  if (!el) return;
  if (typeof html2pdf === "undefined") {
    window.print();
    return;
  }
  const opt = opcoesPdfPadrao(filename || "relatorio.pdf");
  const baixar = () => baixarPdfHtml(el, opt);
  if (typeof comLoading === "function") {
    await comLoading(baixar, "Gerando PDF...");
  } else {
    await baixar();
  }
}

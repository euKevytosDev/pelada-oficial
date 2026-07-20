/**
 * Resumo final profissional da pelada (estilo súmula + Brasileirão).
 */

function formatarDataBr(iso) {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso).slice(0, 10);
  return d.toLocaleDateString("pt-BR");
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

function premioCard(titulo, premio) {
  if (!premio) {
    return `<article class="premio"><h4>${titulo}</h4><p class="vazio">—</p></article>`;
  }
  return `<article class="premio">
    <h4>${titulo}</h4>
    <p class="premio-nome">${premio.nome}</p>
    <p class="premio-detalhe">${premio.detalhe || ""}</p>
  </article>`;
}

function renderResumoOficial(resumo) {
  const el = document.getElementById("resumo-oficial");
  if (!el || !resumo) return;

  const p = resumo.pelada || {};
  const premios = resumo.premios || {};

  const timesHtml = (resumo.times || [])
    .map((t) => {
      const gk = t.goleiro ? t.goleiro.nome : "sem goleiro";
      const jogadores = (t.jogadores || [])
        .map(
          (j) =>
            `<li><span>${j.nome}</span><span class="meta">${j.gols || 0} gol(s)</span></li>`
        )
        .join("");
      return `
        <article class="time-resumo" style="border-left-color:${t.cor}">
          <h3>${t.nome}</h3>
          <p class="gk-linha">Goleiro: <strong>${gk}</strong></p>
          <ul class="lista-resumo">${jogadores || "<li class='vazio'>Sem jogadores</li>"}</ul>
        </article>`;
    })
    .join("");

  const partidasHtml = (resumo.partidas || []).length
    ? `<ul class="lista-partidas">${resumo.partidas
        .map(
          (m) => `
        <li>
          <span class="rod">${String(m.numero).padStart(2, "0")}ª</span>
          <span class="placar-mini">
            <strong style="color:${m.corA}">${m.timeA}</strong>
            <b>${m.golsA}</b>
            <i>x</i>
            <b>${m.golsB}</b>
            <strong style="color:${m.corB}">${m.timeB}</strong>
          </span>
        </li>`
        )
        .join("")}</ul>`
    : `<p class="vazio">Nenhuma partida registrada.</p>`;

  el.innerHTML = `
    <header class="resumo-topo">
      <div>
        <p class="eyebrow">Futebol entre amigos</p>
        <h2>${p.nome || "Pelada Oficial"}</h2>
      </div>
      <p class="resumo-data">${formatarDataBr(p.encerradaEm || p.criadaEm)}</p>
    </header>

    <section class="resumo-bloco">
      <h3>Classificação</h3>
      ${tabelaBrasileirao(resumo.classificacao)}
    </section>

    <section class="resumo-bloco premios-grid">
      <h3>Premiação</h3>
      <div class="premios">
        ${premioCard("Campeão", premios.campeao)}
        ${premioCard("Bola de Ouro", premios.bolaDeOuro)}
        ${premioCard("Luva de Ouro", premios.luvaDeOuro)}
        ${premioCard("Bola Murcha", premios.bolaMurcha)}
      </div>
    </section>

    <section class="resumo-bloco">
      <h3>Times e goleiros</h3>
      <div class="times-resumo-grid">${timesHtml || '<p class="vazio">Sem times</p>'}</div>
    </section>

    <section class="resumo-bloco">
      <h3>Artilharia</h3>
      ${listaSimples(resumo.artilharia, "Nenhum gol marcado.")}
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
      <h3>Partidas</h3>
      ${partidasHtml}
    </section>

    <footer class="resumo-rodape">Gerado por Pelada Oficial</footer>
  `;
}

function textoResumoWhatsApp(resumo) {
  const p = resumo.pelada || {};
  const linhas = [];
  linhas.push(`*${p.nome || "Pelada Oficial"}*`);
  linhas.push(`📅 ${formatarDataBr(p.encerradaEm || p.criadaEm)}`);
  linhas.push("");
  linhas.push("*Classificação*");
  (resumo.classificacao || []).forEach((t) => {
    linhas.push(`${t.posicao}º ${t.nome} — ${t.pontos} pts (V${t.vitorias} E${t.empates} D${t.derrotas}) SG ${t.saldo}`);
  });

  const premios = resumo.premios || {};
  linhas.push("");
  linhas.push("*Premiação*");
  if (premios.campeao) linhas.push(`🏆 Campeão: ${premios.campeao.nome}`);
  if (premios.bolaDeOuro) linhas.push(`⚽ Bola de Ouro: ${premios.bolaDeOuro.nome} (${premios.bolaDeOuro.detalhe})`);
  if (premios.luvaDeOuro) linhas.push(`🧤 Luva de Ouro: ${premios.luvaDeOuro.nome}`);
  if (premios.bolaMurcha) linhas.push(`😅 Bola Murcha: ${premios.bolaMurcha.nome}`);

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

  linhas.push("");
  linhas.push("_Pelada Oficial_");
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
      title: resumo.pelada?.nome || "Pelada Oficial",
      text: texto,
    });
    return;
  }
  await navigator.clipboard.writeText(texto);
  toast("Resumo copiado! Cole no WhatsApp.");
}

async function baixarPdfResumo() {
  const el = document.getElementById("resumo-oficial");
  if (!el) return;
  if (typeof html2pdf === "undefined") {
    window.print();
    return;
  }
  const nome = (estado.resumoAtual?.pelada?.nome || "pelada").replace(/\s+/g, "-").toLowerCase();
  const opt = {
    margin: 8,
    filename: `resumo-${nome}.pdf`,
    image: { type: "jpeg", quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true },
    jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
  };
  await html2pdf().set(opt).from(el).save();
}

/**
 * Relatório da pelada (Pelada Pro) — mês, ano ou período.
 * Vitória = jogador no time que fechou em 1º na tabela da pelada.
 */
function mesesRelatorioOpcoes() {
  const agora = new Date();
  const opts = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(agora.getFullYear(), agora.getMonth() - i, 1);
    const ano = d.getFullYear();
    const mes = d.getMonth() + 1;
    const label = d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
    opts.push({ ano, mes, label: label.charAt(0).toUpperCase() + label.slice(1) });
  }
  return opts;
}

function preencherSelectMesRelatorio() {
  const sel = document.getElementById("relatorio-mes");
  if (!sel || sel.options.length) return;
  mesesRelatorioOpcoes().forEach((o, i) => {
    const opt = document.createElement("option");
    opt.value = `${o.ano}-${String(o.mes).padStart(2, "0")}`;
    opt.textContent = o.label;
    if (i === 0) opt.selected = true;
    sel.appendChild(opt);
  });
}

function preencherSelectAnoRelatorio() {
  const sel = document.getElementById("relatorio-ano");
  if (!sel || sel.options.length) return;
  const atual = new Date().getFullYear();
  for (let y = atual; y >= atual - 5; y--) {
    const opt = document.createElement("option");
    opt.value = String(y);
    opt.textContent = String(y);
    if (y === atual) opt.selected = true;
    sel.appendChild(opt);
  }
}

function preencherDatasPadraoPeriodo() {
  const de = document.getElementById("relatorio-de");
  const ate = document.getElementById("relatorio-ate");
  if (!de || !ate) return;
  const hoje = new Date();
  const iso = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };
  if (!de.value) {
    de.value = iso(new Date(hoje.getFullYear(), hoje.getMonth(), 1));
  }
  if (!ate.value) {
    ate.value = iso(hoje);
  }
}

function modoRelatorioAtual() {
  return estado.relatorioModo || "mes";
}

function setModoRelatorio(modo) {
  estado.relatorioModo = modo;
  document.querySelectorAll(".relatorio-modo").forEach((b) => {
    b.classList.toggle("ativo", b.dataset.relModo === modo);
  });
  document.getElementById("relatorio-filtro-mes")?.classList.toggle("oculto", modo !== "mes");
  document.getElementById("relatorio-filtro-ano")?.classList.toggle("oculto", modo !== "ano");
  document.getElementById("relatorio-filtro-periodo")?.classList.toggle("oculto", modo !== "periodo");
}

function paramsRelatorioAtual() {
  const modo = modoRelatorioAtual();
  if (modo === "ano") {
    const ano = parseInt(document.getElementById("relatorio-ano")?.value, 10);
    return { ano: Number.isFinite(ano) ? ano : new Date().getFullYear(), mes: null, extras: { modo: "ano" } };
  }
  if (modo === "periodo") {
    return {
      ano: null,
      mes: null,
      extras: {
        modo: "periodo",
        de: document.getElementById("relatorio-de")?.value || "",
        ate: document.getElementById("relatorio-ate")?.value || "",
      },
    };
  }
  const v = document.getElementById("relatorio-mes")?.value || "";
  const [ano, mes] = v.split("-").map((n) => parseInt(n, 10));
  const agora = new Date();
  return {
    ano: Number.isFinite(ano) ? ano : agora.getFullYear(),
    mes: Number.isFinite(mes) ? mes : agora.getMonth() + 1,
    extras: { modo: "mes" },
  };
}

function textoRelatorioMensalWhatsApp(rel) {
  const linhas = [];
  linhas.push(`*${rel.titulo || "Relatório"}*`);
  const peladas = rel.peladasNoPeriodo ?? rel.peladasNoMes ?? 0;
  const partidas = rel.partidasNoPeriodo ?? rel.partidasNoMes ?? 0;
  linhas.push(`${peladas} pelada(s) · ${partidas} partida(s) · ${rel.totalGols || 0} gols`);
  linhas.push("");
  const p = rel.premios || {};
  linhas.push("*Destaques*");
  if (p.campeao) linhas.push(`🏆 Campeão: ${p.campeao.nome} (${p.campeao.detalhe})`);
  if (p.artilheiro) linhas.push(`⚽ Artilheiro: ${p.artilheiro.nome} (${p.artilheiro.detalhe})`);
  if (p.garcom) linhas.push(`🎯 Garçom: ${p.garcom.nome} (${p.garcom.detalhe})`);
  if (p.craque) linhas.push(`⭐ Craque: ${p.craque.nome} (${p.craque.detalhe})`);
  if (p.luvaDeOuro) linhas.push(`🧤 Luva: ${p.luvaDeOuro.nome} (${p.luvaDeOuro.detalhe})`);
  if (p.cartolaAmarela) linhas.push(`🟨 Amarelos: ${p.cartolaAmarela.nome} (${p.cartolaAmarela.detalhe})`);
  if (p.expulsoes) linhas.push(`🟥 Vermelhos: ${p.expulsoes.nome} (${p.expulsoes.detalhe})`);
  if (p.fairPlay) linhas.push(`🤝 Fair play: ${(p.fairPlay.nomes || [p.fairPlay.nome]).join(", ")}`);
  const top = (lista, titulo, campo) => {
    const arr = (lista || []).slice(0, 8);
    if (!arr.length) return;
    linhas.push("");
    linhas.push(`*${titulo}*`);
    arr.forEach((i) => linhas.push(`• ${i.nome}: ${i[campo] ?? i.quantidade}`));
  };
  top(rel.campeoes, "Campeões (peladas ganhas)", "vitorias");
  top(rel.artilharia, "Artilharia", "gols");
  top(rel.garcons, "Assistências", "quantidade");
  top(rel.goleiros, "Goleiros (sofridos)", "quantidade");
  top(rel.amarelos, "Amarelos", "quantidade");
  top(rel.vermelhos, "Vermelhos", "quantidade");
  linhas.push("");
  linhas.push("_Pelada Oficial — relatório_");
  return linhas.join("\n");
}

function renderRelatorioMensal(rel) {
  const el = document.getElementById("resumo-mensal-oficial");
  if (!el || !rel) return;
  const p = rel.premios || {};
  const peladas = rel.peladasNoPeriodo ?? rel.peladasNoMes ?? 0;
  const partidas = rel.partidasNoPeriodo ?? rel.partidasNoMes ?? 0;
  const gkLista = (rel.goleiros || []).map((g) => ({
    nome: g.nome,
    quantidade: `${g.quantidade} sofr. · ${g.peladas || 0} pel. · méd ${g.media ?? "-"}`,
  }));
  const labelPeriodo =
    rel.modo === "ano" ? "do ano" : rel.modo === "periodo" ? "do período" : "do mês";
  el.innerHTML = `
    <header class="resumo-topo">
      <div>
        <p class="eyebrow">Relatório ${escHtmlRel(labelPeriodo)}</p>
        <h2>${escHtmlRel(rel.titulo || "Relatório")}</h2>
        ${rel.subtitulo ? `<p class="dica" style="margin:6px 0 0">${escHtmlRel(rel.subtitulo)}</p>` : ""}
      </div>
      <p class="resumo-data">${peladas} pelada(s)</p>
    </header>
    <section class="resumo-bloco">
      <h3>Números</h3>
      <ul class="lista-resumo">
        <li><span>Peladas</span><strong>${peladas}</strong></li>
        <li><span>Partidas</span><strong>${partidas}</strong></li>
        <li><span>Vitórias (1º lugar)</span><strong>${rel.totalVitorias || 0}</strong></li>
        <li><span>Gols</span><strong>${rel.totalGols || 0}</strong></li>
        <li><span>Assistências</span><strong>${rel.totalAssistencias || 0}</strong></li>
        <li><span>Amarelos</span><strong>${rel.totalAmarelos || 0}</strong></li>
        <li><span>Vermelhos</span><strong>${rel.totalVermelhos || 0}</strong></li>
      </ul>
    </section>
    <section class="resumo-bloco premios-grid">
      <h3>Destaques</h3>
      <div class="premios">
        ${premioCard("Campeão", p.campeao)}
        ${premioCard("Artilheiro", p.artilheiro)}
        ${premioCard("Garçom", p.garcom)}
        ${premioCard("Craque", p.craque)}
        ${premioCard("Luva de Ouro", p.luvaDeOuro)}
        ${premioCard("Amarelos", p.cartolaAmarela)}
        ${premioCard("Vermelhos", p.expulsoes)}
      </div>
      <p class="dica" style="margin-top:10px">Campeão = quem mais vezes ficou no time em 1º na tabela da pelada.</p>
    </section>
    <section class="resumo-bloco">
      <h3>Campeões (peladas ganhas)</h3>
      ${listaSimples(rel.campeoes, "Nenhuma pelada com campeão ainda.")}
    </section>
    <section class="resumo-bloco">
      <h3>Artilharia</h3>
      ${listaSimples(rel.artilharia, "Nenhum gol no período.")}
    </section>
    <section class="resumo-bloco">
      <h3>Assistências</h3>
      ${listaSimples(rel.garcons, "Nenhuma assistência no período.")}
    </section>
    <section class="resumo-bloco">
      <h3>Goleiros (menos vazado)</h3>
      ${listaSimples(gkLista, "Nenhum goleiro no período.")}
    </section>
    <section class="resumo-bloco">
      <h3>Cartões amarelos</h3>
      ${listaSimples(rel.amarelos, "Nenhum amarelo.")}
    </section>
    <section class="resumo-bloco">
      <h3>Cartões vermelhos</h3>
      ${listaSimples(rel.vermelhos, "Nenhum vermelho.")}
    </section>
    ${(rel.golsContra || []).length ? `<section class="resumo-bloco"><h3>Gols contra</h3>${listaSimples(rel.golsContra, "")}</section>` : ""}
    <section class="resumo-bloco">
      <h3>Peladas</h3>
      ${
        (rel.peladas || []).length
          ? `<ul class="lista-resumo">${rel.peladas
              .map((x) => {
                const camp =
                  x.campeaoTime
                    ? ` · 🏆 ${x.campeaoTime}${(x.campeoes || []).length ? ` (${x.campeoes.slice(0, 3).join(", ")}${(x.campeoes || []).length > 3 ? "…" : ""})` : ""}`
                    : "";
                return `<li><span>${x.data ? `${escHtmlRel(x.data)} · ` : ""}${escHtmlRel(x.nome)}${escHtmlRel(camp)}</span><strong>${x.partidas || 0} jog.</strong></li>`;
              })
              .join("")}</ul>`
          : `<p class="vazio">Nenhuma pelada neste período.</p>`
      }
    </section>
    <footer class="resumo-rodape">Gerado por Pelada Oficial</footer>
  `;
}

function escHtmlRel(s) {
  return String(s || "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}

async function abrirRelatorioMensal() {
  if (typeof PlanoApp !== "undefined" && !PlanoApp.exigirPro("O relatório do mês faz parte do Pelada Pro")) {
    return;
  }
  estado.telaAntesRelatorio = document.querySelector(".tela.ativa")?.id || "tela-inicio";
  preencherSelectMesRelatorio();
  preencherSelectAnoRelatorio();
  preencherDatasPadraoPeriodo();
  setModoRelatorio(modoRelatorioAtual());
  mostrarTela("tela-relatorio-mensal");
  if (modoRelatorioAtual() !== "periodo") {
    await carregarRelatorioMensalNaTela();
  }
}

async function carregarRelatorioMensalNaTela() {
  const { ano, mes, extras } = paramsRelatorioAtual();
  if (extras?.modo === "periodo" && (!extras.de || !extras.ate)) {
    toast("Escolha as datas do período");
    return;
  }
  try {
    await comLoading(async () => {
      const rel = await PeladaAPI.relatorioMensal(ano, mes, extras);
      estado.relatorioMensalAtual = rel;
      renderRelatorioMensal(rel);
    }, "Montando o relatório...");
  } catch (err) {
    toast(err.message || "Não deu para montar o relatório");
  }
}

function initRelatorioMensal() {
  document.getElementById("btn-relatorio-mensal")?.addEventListener("click", () => abrirRelatorioMensal());
  document.getElementById("btn-relatorio-inicio")?.addEventListener("click", () => abrirRelatorioMensal());
  document.getElementById("cfg-relatorio-mensal")?.addEventListener("click", () => abrirRelatorioMensal());
  document.getElementById("btn-voltar-relatorio")?.addEventListener("click", () => {
    mostrarTela(estado.telaAntesRelatorio || "tela-inicio");
  });
  document.querySelectorAll(".relatorio-modo").forEach((btn) => {
    btn.addEventListener("click", async () => {
      setModoRelatorio(btn.dataset.relModo);
      if (btn.dataset.relModo === "periodo") {
        preencherDatasPadraoPeriodo();
        return;
      }
      await carregarRelatorioMensalNaTela();
    });
  });
  document.getElementById("relatorio-mes")?.addEventListener("change", () => carregarRelatorioMensalNaTela());
  document.getElementById("relatorio-ano")?.addEventListener("change", () => carregarRelatorioMensalNaTela());
  document.getElementById("btn-relatorio-periodo")?.addEventListener("click", () => carregarRelatorioMensalNaTela());
  document.getElementById("btn-pdf-mensal")?.addEventListener("click", async () => {
    const nome = (estado.relatorioMensalAtual?.titulo || "relatorio").replace(/\s+/g, "-").toLowerCase();
    try {
      await baixarPdfElemento("resumo-mensal-oficial", `${nome}.pdf`);
    } catch (err) {
      toast(err.message || "Não foi possível gerar o PDF");
    }
  });
  document.getElementById("btn-whats-mensal")?.addEventListener("click", () => {
    const rel = estado.relatorioMensalAtual;
    if (!rel) return;
    const texto = textoRelatorioMensalWhatsApp(rel);
    window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, "_blank");
  });
}

/**
 * Relatório da pelada (Rei da Pelada Pro) — mês, ano ou período.
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

function relKpi(label, valor) {
  return `<div class="rel-kpi"><strong>${escHtmlRel(valor)}</strong><span>${escHtmlRel(label)}</span></div>`;
}

function relChip(titulo, premio) {
  const nome = premio?.nome || "—";
  const det = premio?.detalhe || "";
  return `<article class="rel-chip"><span>${escHtmlRel(titulo)}</span><strong>${escHtmlRel(nome)}</strong>${
    det ? `<em>${escHtmlRel(det)}</em>` : ""
  }</article>`;
}

function liRel(item, pos) {
  const qtd = item.quantidade ?? item.gols ?? "";
  const marca = pos ? `<span class="rel-pos">${pos}</span>` : "";
  return `<li>${marca}<span class="rel-nome">${escHtmlRel(item.nome)}</span><strong>${escHtmlRel(qtd)}</strong></li>`;
}

function corpoRel(lista, vazio, cols, comPos) {
  if (!lista.length) return `<p class="rel-vazio">${escHtmlRel(vazio)}</p>`;
  const nCols = Math.max(1, cols || 1);
  const porCol = Math.ceil(lista.length / nCols);
  const blocos = [];
  for (let c = 0; c < nCols; c++) {
    const fatia = lista.slice(c * porCol, (c + 1) * porCol);
    if (!fatia.length) continue;
    const linhas = fatia
      .map((item, i) => liRel(item, comPos ? c * porCol + i + 1 : 0))
      .join("");
    blocos.push(`<ol>${linhas}</ol>`);
  }
  return nCols > 1 ? `<div class="rel-cols">${blocos.join("")}</div>` : blocos[0];
}

function relTabela(titulo, itens, vazio, extraClass, cols) {
  const lista = itens || [];
  return `<section class="rel-tabela ${extraClass || ""}"><h3>${escHtmlRel(titulo)}</h3>${corpoRel(lista, vazio, cols, true)}</section>`;
}

function renderRelatorioMensal(rel) {
  const el = document.getElementById("resumo-mensal-oficial");
  if (!el || !rel) return;
  const p = rel.premios || {};
  const peladas = rel.peladasNoPeriodo ?? rel.peladasNoMes ?? 0;
  const partidas = rel.partidasNoPeriodo ?? rel.partidasNoMes ?? 0;
  const modo = rel.modo === "ano" ? "ano" : rel.modo === "periodo" ? "periodo" : "mes";
  const labelPeriodo = modo === "ano" ? "Anual" : modo === "periodo" ? "Período" : "Mensal";
  const gkLista = [...(rel.goleiros || [])]
    .sort((a, b) => {
      const vit = (b.vitorias ?? b.quantidade ?? 0) - (a.vitorias ?? a.quantidade ?? 0);
      if (vit !== 0) return vit;
      return (a.golsSofridos ?? 0) - (b.golsSofridos ?? 0);
    })
    .map((g) => {
      const vit = g.vitorias ?? g.quantidade ?? 0;
      const sofridos = g.golsSofridos ?? 0;
      return { nome: g.nome, quantidade: `${vit} vit. · ${sofridos} sofr.` };
    });
  const freq = [...(rel.frequencia || [])]
    .sort((a, b) => (b.peladas ?? b.quantidade ?? 0) - (a.peladas ?? a.quantidade ?? 0))
    .map((j) => {
      const n = j.peladas ?? j.quantidade ?? 0;
      return { nome: j.nome, quantidade: totalLabelFreq(n, peladas) };
    });
  const peladasItens = (rel.peladas || []).map((x) => {
    const camp = x.campeaoTime ? ` · ${x.campeaoTime}` : "";
    return {
      nome: `${x.data ? `${x.data} · ` : ""}${x.nome || "Pelada"}${camp}`,
      quantidade: `${x.partidas || 0} jog.`,
    };
  });
  el.classList.add("relatorio-doc");
  el.innerHTML = `
    <article class="rel-folha rel-folha--${modo}" data-modo="${modo}">
      <header class="rel-cabeca">
        <div>
          <p class="rel-marca">Rei da Pelada</p>
          <h2>${escHtmlRel(rel.titulo || "Relatório")}</h2>
          ${rel.subtitulo ? `<p class="rel-sub">${escHtmlRel(rel.subtitulo)}</p>` : ""}
        </div>
        <div class="rel-selo">
          <span>${escHtmlRel(labelPeriodo)}</span>
          <strong>${peladas}</strong>
          <em>${peladas === 1 ? "pelada" : "peladas"}</em>
        </div>
      </header>
      <div class="rel-kpis">
        ${relKpi("Peladas", peladas)}
        ${relKpi("Partidas", partidas)}
        ${relKpi("Vitórias", rel.totalVitorias || 0)}
        ${relKpi("Gols", rel.totalGols || 0)}
        ${relKpi("Assist.", rel.totalAssistencias || 0)}
        ${relKpi("Amarelos", rel.totalAmarelos || 0)}
        ${relKpi("Vermelhos", rel.totalVermelhos || 0)}
      </div>
      <section class="rel-destaques">
        <h3>Destaques</h3>
        <div class="rel-chips">
          ${relChip("Campeão", p.campeao)}
          ${relChip("Artilheiro", p.artilheiro)}
          ${relChip("Garçom", p.garcom)}
          ${relChip("Craque", p.craque)}
          ${relChip("Goleiro", p.luvaDeOuro)}
          ${relChip("Amarelos", p.cartolaAmarela)}
          ${relChip("Vermelhos", p.expulsoes)}
        </div>
      </section>
      <div class="rel-grade">
        ${relTabela("Campeões", rel.campeoes, "Sem campeão")}
        ${relTabela("Artilharia", rel.artilharia, "Sem gols")}
        ${relTabela("Assistências", rel.garcons, "Sem assistência")}
        ${relTabela("Goleiros", gkLista, "Sem goleiro")}
        ${relTabela("Amarelos", rel.amarelos, "Nenhum")}
        ${relTabela("Vermelhos", rel.vermelhos, "Nenhum")}
        ${(rel.golsContra || []).length ? relTabela("Gols contra", rel.golsContra, "") : ""}
        ${modo === "mes" ? "" : relTabela("Frequência", freq, "Sem presença", "rel-freq", 3)}
      </div>
      <section class="rel-tabela rel-peladas">
        <h3>Peladas</h3>
        ${corpoRel(peladasItens, "Nenhuma pelada neste período.", 2, false)}
      </section>
      <footer class="rel-rodape">Gerado por Rei da Pelada · campeão = 1º da tabela · goleiro = menos vazado do dia</footer>
    </article>
  `;
}

function totalLabelFreq(n, total) {
  const base = n === 1 ? "1 pelada" : `${n} peladas`;
  return total > 0 ? `${base} / ${total}` : base;
}

function escHtmlRel(s) {
  return String(s || "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}

async function abrirRelatorioMensal() {
  if (typeof PlanoApp !== "undefined" && !PlanoApp.exigirPro("O relatório do mês faz parte do Rei da Pelada Pro. Faça o upgrade para liberar.")) {
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
      if (typeof sincronizarApaguesPendentes === "function") {
        await sincronizarApaguesPendentes();
      }
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
}

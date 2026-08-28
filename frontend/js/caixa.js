/**
 * Caixa da pelada (Pelada Pro) — painel do mês + cobrança de quem jogou.
 */
function preencherSelectMesCaixa() {
  const sel = document.getElementById("caixa-mes");
  if (!sel || sel.options.length) return;
  const agora = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(agora.getFullYear(), agora.getMonth() - i, 1);
    const ano = d.getFullYear();
    const mes = d.getMonth() + 1;
    let label = d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
    label = label.charAt(0).toUpperCase() + label.slice(1);
    const opt = document.createElement("option");
    opt.value = `${ano}-${String(mes).padStart(2, "0")}`;
    opt.textContent = label;
    if (i === 0) opt.selected = true;
    sel.appendChild(opt);
  }
}

function mesSelecionadoCaixa() {
  const v = document.getElementById("caixa-mes")?.value || "";
  const [ano, mes] = v.split("-").map((n) => parseInt(n, 10));
  const agora = new Date();
  return {
    ano: Number.isFinite(ano) ? ano : agora.getFullYear(),
    mes: Number.isFinite(mes) ? mes : agora.getMonth() + 1,
  };
}

function reaisParaInput(n) {
  const v = Number(n);
  if (!Number.isFinite(v) || v === 0) return "";
  return v.toLocaleString("pt-BR", {
    minimumFractionDigits: Number.isInteger(v) ? 0 : 2,
    maximumFractionDigits: 2,
  });
}

function rotuloModalidade(m) {
  if (m === "MENSAL") return "Mensalista";
  if (m === "ISENTO") return "Isento";
  return "Por jogo";
}

function badgeModalidade(m) {
  const txt = rotuloModalidade(m);
  const cls = m === "MENSAL" ? "mensal" : m === "ISENTO" ? "isento" : "avulso";
  return `<span class="caixa-badge caixa-badge-${cls}">${txt}</span>`;
}

function escHtml(s) {
  return String(s || "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[c]));
}

function descricaoJogadorCaixa(j) {
  if (j.resumo) return j.resumo;
  const jogos = Number(j.jogos) || 0;
  const jogosTxt = jogos ? `${jogos} jogo${jogos === 1 ? "" : "s"} no mês` : "não jogou neste mês";
  if (j.modalidade === "ISENTO") return `Não paga · ${jogosTxt}`;
  if (j.modalidade === "MENSAL") {
    if (j.mesCoberto || j.status === "QUITADO") return `Mês pago · ${jogosTxt} — liberado`;
    if (j.status === "PENDENTE") return `Deve mensalidade · ${jogosTxt}`;
    return `Mensalista · ${jogosTxt}`;
  }
  if (j.status === "PENDENTE") {
    return jogos ? `${jogosTxt} · deve ${formatarReais(j.pendente)}` : `Deve ${formatarReais(j.pendente)}`;
  }
  if (j.status === "QUITADO") return `${jogosTxt} · em dia`;
  return jogosTxt;
}

function rotuloDireitaJogador(j) {
  if (j.modalidade === "ISENTO") return `<span class="caixa-valor-neutro">Isento</span>`;
  if (j.modalidade === "MENSAL" && (j.mesCoberto || j.status === "QUITADO")) {
    return `<span class="caixa-valor-ok">Mês pago</span>`;
  }
  if (j.status === "PENDENTE") {
    return `<strong class="caixa-valor-deve">${formatarReais(j.pendente)}</strong>`;
  }
  if (j.status === "QUITADO") return `<span class="caixa-valor-ok">Em dia</span>`;
  return `<span class="caixa-valor-neutro">—</span>`;
}

function textoCaixaWhatsApp(caixa) {
  const t = caixa.totais || {};
  const linhas = [];
  linhas.push(`*Caixa — ${caixa.titulo || "mês"}*`);
  linhas.push(`Recebeu ${formatarReais(t.pago)} · falta ${formatarReais(t.pendente)}`);
  const lista = caixa.jogadores || [];
  const pend = lista.filter((j) => j.status === "PENDENTE");
  const mensalOk = lista.filter((j) => j.modalidade === "MENSAL" && (j.mesCoberto || j.status === "QUITADO"));
  if (pend.length) {
    linhas.push("");
    linhas.push("*Quem ainda deve*");
    pend.forEach((j) => {
      const tipo = j.modalidade === "MENSAL" ? "mensalidade" : "por jogo";
      linhas.push(`• ${j.nome} (${tipo}): ${formatarReais(j.pendente)}`);
    });
  }
  if (mensalOk.length) {
    linhas.push("");
    linhas.push("*Mensalistas — mês pago*");
    mensalOk.forEach((j) => {
      const jogos = Number(j.jogos) ? ` · ${j.jogos} jogo(s)` : "";
      linhas.push(`• ${j.nome}${jogos}`);
    });
  }
  if (!pend.length && !mensalOk.length) {
    linhas.push("");
    linhas.push("Todo mundo em dia neste mês.");
  }
  linhas.push("");
  linhas.push("_Pelada Oficial_");
  return linhas.join("\n");
}

function renderBoletimCaixa(caixa) {
  const el = document.getElementById("caixa-boletim");
  if (!el) return;
  const t = caixa.totais || {};
  const lista = caixa.jogadores || [];
  const pend = lista.filter((j) => j.status === "PENDENTE");
  const mensalOk = lista.filter((j) => j.modalidade === "MENSAL" && (j.mesCoberto || j.status === "QUITADO"));
  const avulsoOk = lista.filter((j) => j.modalidade === "AVULSO" && j.status === "QUITADO");
  el.innerHTML = `
    <header class="resumo-topo">
      <div>
        <p class="eyebrow">Caixa da pelada</p>
        <h2>${escHtml(caixa.titulo || "Mês")}</h2>
      </div>
    </header>
    <p class="dica" style="margin-top:0">Recebeu ${formatarReais(t.pago)} · falta ${formatarReais(t.pendente)} · ${t.peladas || 0} pelada(s)</p>
    <section class="resumo-bloco">
      <h3>Quem ainda deve <span class="badge-qtd">${pend.length}</span></h3>
      ${
        pend.length
          ? `<ul class="lista-resumo">${pend
              .map(
                (j) =>
                  `<li><span>${escHtml(j.nome)} · ${rotuloModalidade(j.modalidade)}</span><strong>${formatarReais(j.pendente)}</strong></li>`
              )
              .join("")}</ul>`
          : `<p class="dica">Ninguém deve.</p>`
      }
    </section>
    ${
      mensalOk.length
        ? `<section class="resumo-bloco">
             <h3>Mensalistas — mês pago <span class="badge-qtd">${mensalOk.length}</span></h3>
             <ul class="lista-resumo">${mensalOk
               .map((j) => `<li><span>${escHtml(j.nome)}${j.jogos ? ` · ${j.jogos} jogo(s)` : ""}</span><strong>ok</strong></li>`)
               .join("")}</ul>
           </section>`
        : ""
    }
    ${
      avulsoOk.length
        ? `<section class="resumo-bloco">
             <h3>Por jogo — em dia <span class="badge-qtd">${avulsoOk.length}</span></h3>
             <ul class="lista-resumo">${avulsoOk.map((j) => `<li><span>${escHtml(j.nome)}</span><strong>ok</strong></li>`).join("")}</ul>
           </section>`
        : ""
    }
    <footer class="resumo-rodape">Pelada Oficial — boletim da caixa</footer>
  `;
}

function itemJogadorCaixa(j) {
  return `
    <li>
      <button type="button" class="caixa-linha" data-caixa-acao="${j.id}">
        <span class="caixa-linha-esq">
          <span class="caixa-linha-nome">${escHtml(j.nome)}${j.goleiro ? " <span class=\"meta\">GK</span>" : ""}</span>
          <span class="caixa-linha-meta">${badgeModalidade(j.modalidade)} · ${escHtml(descricaoJogadorCaixa(j))}</span>
        </span>
        <span class="caixa-linha-dir">${rotuloDireitaJogador(j)}<span class="caixa-seta" aria-hidden="true">›</span></span>
      </button>
    </li>`;
}

function secaoCaixa(titulo, jogadores, vazio) {
  if (!jogadores.length && !vazio) return "";
  return `
    <h3 class="lista-titulo caixa-secao-titulo">${titulo} <span class="caixa-conta">${jogadores.length}</span></h3>
    <ul class="lista caixa-lista">${
      jogadores.length
        ? jogadores.map((j) => itemJogadorCaixa(j)).join("")
        : `<li class="caixa-vazio"><span>${vazio}</span></li>`
    }</ul>`;
}

function renderCaixa(caixa) {
  const t = caixa.totais || {};
  const ultima = caixa.ultimaPelada || {};
  const lista = caixa.jogadores || [];
  const pend = lista.filter((j) => j.status === "PENDENTE");
  const mensalOk = lista.filter((j) => j.modalidade === "MENSAL" && (j.mesCoberto || j.status === "QUITADO"));
  const avulsoOk = lista.filter((j) => j.modalidade === "AVULSO" && j.status === "QUITADO");
  const isentos = lista.filter((j) => j.modalidade === "ISENTO");
  const resto = lista.filter(
    (j) =>
      j.status === "SEM_COBRANCA" &&
      j.modalidade !== "ISENTO" &&
      j.modalidade !== "MENSAL"
  );

  const mensal = document.getElementById("caixa-valor-mensal");
  const avulso = document.getElementById("caixa-valor-avulso");
  if (mensal && document.activeElement !== mensal) mensal.value = reaisParaInput(caixa.valorMensal);
  if (avulso && document.activeElement !== avulso) avulso.value = reaisParaInput(caixa.valorAvulso);

  const qtdUltima = (ultima.avulsosParaCobrar || []).length;
  const ctaUltima = ultima.podeCobrar
    ? `<div class="caixa-cta">
         <button type="button" class="btn btn-principal" id="btn-caixa-cobrar-ultima">
           Cobrar avulsos do último jogo${ultima.quandoTexto ? ` · ${escHtml(ultima.quandoTexto)}` : ""}
         </button>
         <p class="dica">${qtdUltima} por jogo · ${formatarReais(caixa.valorAvulso)} cada. Mensalistas não entram — pagam 1x no mês.</p>
       </div>`
    : ultima.podeCancelar
      ? `<div class="caixa-cta">
           <button type="button" class="btn btn-secundario" id="btn-caixa-cancelar-ultima">
             Desfazer cobrança do último jogo
           </button>
         </div>`
      : ultima.tem
        ? `<p class="dica caixa-cta-texto">Último jogo (${escHtml(ultima.quandoTexto || "")}): só avulsos entram. Mensalistas já estão no mês.</p>`
        : `<p class="dica caixa-cta-texto">Encerre uma pelada para cobrar quem joga por jogo.</p>`;

  const painel = document.getElementById("caixa-painel");
  if (painel) {
    painel.innerHTML = `
      <div class="caixa-resumo">
        <div class="caixa-resumo-item">
          <span class="caixa-resumo-label">Recebeu</span>
          <strong class="caixa-resumo-valor ok">${formatarReais(t.pago)}</strong>
        </div>
        <div class="caixa-resumo-item">
          <span class="caixa-resumo-label">Ainda falta</span>
          <strong class="caixa-resumo-valor${Number(t.pendente) > 0 ? " deve" : ""}">${formatarReais(t.pendente)}</strong>
        </div>
      </div>
      <p class="dica caixa-resumo-meta">${pend.length} devem · ${mensalOk.length} mensalistas ok · ${t.peladas || 0} pelada(s)</p>
      ${ctaUltima}
      ${secaoCaixa("Quem deve", pend, "Todo mundo em dia neste mês.")}
      ${mensalOk.length ? secaoCaixa("Mensalistas — mês pago", mensalOk, "") : ""}
      ${
        avulsoOk.length || isentos.length || resto.length
          ? `<details class="caixa-mais"><summary>Por jogo em dia, isentos e outros (${avulsoOk.length + isentos.length + resto.length})</summary>
             ${avulsoOk.length ? secaoCaixa("Por jogo — em dia", avulsoOk, "") : ""}
             ${isentos.length ? secaoCaixa("Isentos", isentos, "") : ""}
             ${resto.length ? secaoCaixa("Sem cobrança neste mês", resto, "") : ""}
           </details>`
          : ""
      }
    `;
    document.getElementById("btn-caixa-cobrar-ultima")?.addEventListener("click", () => cobrarUltimaPeladaCaixa());
    document.getElementById("btn-caixa-cancelar-ultima")?.addEventListener("click", () => cancelarUltimaPeladaCaixa());
  }
  renderBoletimCaixa(caixa);
  pintarFaixaCaixaHome(caixa);
}

function pintarFaixaCaixaHome(caixa) {
  const faixa = document.getElementById("caixa-faixa-home");
  if (!faixa) return;
  const t = caixa?.totais || {};
  const pend = Number(t.pendentes) || 0;
  const falta = Number(t.pendente) || 0;
  if (!caixa || (!pend && !falta && !(Number(t.cobrado) > 0))) {
    faixa.classList.add("oculto");
    faixa.textContent = "";
    return;
  }
  faixa.classList.remove("oculto");
  faixa.textContent = pend
    ? `Caixa: ${pend} devem · falta ${formatarReais(falta)}`
    : `Caixa em dia · ${formatarReais(t.pago)} recebidos`;
}

async function atualizarFaixaCaixaHome() {
  const faixa = document.getElementById("caixa-faixa-home");
  if (!faixa) return;
  if (typeof PlanoApp === "undefined" || !PlanoApp.temPro()) {
    faixa.classList.add("oculto");
    return;
  }
  try {
    const agora = new Date();
    const caixa = await PeladaAPI.caixa(agora.getFullYear(), agora.getMonth() + 1);
    pintarFaixaCaixaHome(caixa);
  } catch (_) {
    faixa.classList.add("oculto");
  }
}

async function carregarCaixaNaTela() {
  const { ano, mes } = mesSelecionadoCaixa();
  try {
    await comLoading(async () => {
      const caixa = await PeladaAPI.caixa(ano, mes);
      estado.caixaAtual = caixa;
      renderCaixa(caixa);
    }, "Abrindo a caixa...");
  } catch (err) {
    toast(err.message || "Não deu para abrir a caixa");
  }
}

async function abrirCaixaPelada() {
  if (typeof PlanoApp !== "undefined" && !PlanoApp.exigirPro("A caixa da pelada faz parte do Pelada Pro. Faça o upgrade para liberar.")) {
    return;
  }
  estado.telaAntesCaixa = document.querySelector(".tela.ativa")?.id || "tela-inicio";
  preencherSelectMesCaixa();
  mostrarTela("tela-caixa");
  await carregarCaixaNaTela();
}

async function caixaAcao(fn, texto) {
  const { ano, mes } = mesSelecionadoCaixa();
  try {
    await comLoading(async () => {
      const caixa = await fn(ano, mes);
      estado.caixaAtual = caixa;
      renderCaixa(caixa);
    }, texto);
    return estado.caixaAtual;
  } catch (err) {
    toast(err.message || "Não deu para atualizar a caixa");
    return null;
  }
}

async function cobrarUltimaPeladaCaixa() {
  const ultima = estado.caixaAtual?.ultimaPelada;
  const r = await caixaAcao(
    (ano, mes) => PeladaAPI.caixaCobrarJogo(ano, mes, ultima?.id ? { peladaId: ultima.id } : {}),
    "Cobrando avulsos..."
  );
  if (!r) return;
  const n = Number(r.cobradosAgora) || 0;
  toast(n ? `${n} avulso(s) cobrados · mensalistas ignorados` : "Esse jogo já estava lançado");
}

async function cancelarUltimaPeladaCaixa() {
  const ultima = estado.caixaAtual?.ultimaPelada;
  if (!ultima?.id) return;
  const ok = confirm(
    `Desfazer a cobrança do jogo de ${ultima.quandoTexto || "último jogo"}?\n\nSó avulsos. Pagamentos já anotados ficam.`
  );
  if (!ok) return;
  const r = await caixaAcao(
    (ano, mes) => PeladaAPI.caixaCancelarJogo(ano, mes, ultima.id),
    "Desfazendo..."
  );
  if (!r) return;
  toast(`${Number(r.canceladosAgora) || 0} cobrança(s) apagada(s)`);
}

async function cobrarQuemJogouHoje() {
  if (typeof PlanoApp !== "undefined" && !PlanoApp.exigirPro("A caixa da pelada faz parte do Pelada Pro. Faça o upgrade para liberar.")) {
    return;
  }
  const peladaId = estado.caixaPeladaIdPendente || estado.peladaId;
  const jogadores = estado.caixaPresencaPendente || [];
  preencherSelectMesCaixa();
  mostrarTela("tela-caixa");
  const body = peladaId ? { peladaId } : { jogadores };
  const r = await caixaAcao((ano, mes) => PeladaAPI.caixaCobrarJogo(ano, mes, body), "Cobrando avulsos...");
  if (!r) return;
  const n = Number(r.cobradosAgora) || 0;
  toast(n ? `${n} avulso(s) cobrados · mensalistas ignorados` : "Esse jogo já estava na caixa");
}

async function abrirAcoesJogadorCaixa(id) {
  const j = (estado.caixaAtual?.jogadores || []).find((x) => String(x.id) === String(id));
  if (!j) return;
  const avulso = formatarReais(estado.caixaAtual?.valorAvulso || 0);
  const mensal = formatarReais(estado.caixaAtual?.valorMensal || 0);
  const opcoes = [];

  if (j.modalidade === "MENSAL") {
    if (j.status === "PENDENTE") {
      opcoes.push({ id: "quitar", label: `Recebeu mensalidade do mês · ${formatarReais(j.pendente)}` });
    }
    if (j.modalidade !== "AVULSO") opcoes.push({ id: "mod-avulso", label: `Mudar para por jogo (${avulso}/jogo)` });
    if (j.modalidade !== "ISENTO") opcoes.push({ id: "mod-isento", label: "Marcar como isento" });
    if (Number(j.pago) > 0) opcoes.push({ id: "desfazer", label: "Desfazer último pagamento" });
  } else if (j.modalidade === "ISENTO") {
    opcoes.push({ id: "mod-mensal", label: `Mudar para mensalista (${mensal}/mês)` });
    opcoes.push({ id: "mod-avulso", label: `Mudar para por jogo (${avulso}/jogo)` });
  } else {
    if (j.status === "PENDENTE") {
      opcoes.push({ id: "quitar", label: `Recebeu tudo · ${formatarReais(j.pendente)}` });
      opcoes.push({ id: "pagar", label: "Recebeu parte do valor" });
    }
    opcoes.push({ id: "mod-mensal", label: `Mudar para mensalista (${mensal}/mês)` });
    opcoes.push({ id: "mod-isento", label: "Marcar como isento" });
    if (Number(j.pago) > 0) opcoes.push({ id: "desfazer", label: "Desfazer último pagamento" });
    if (Number(j.cobrado) > 0) opcoes.push({ id: "desfazer-cobranca", label: "Desfazer última cobrança de jogo" });
  }

  const escolha = await escolherOpcao(j.nome, opcoes);
  if (!escolha) return;

  if (escolha === "pagar") {
    const sugerido = Number(j.pendente) > 0 ? reaisParaInput(j.pendente) : "";
    const valor = await pedirNumero(`Quanto ${j.nome} pagou?`, sugerido, "Pagamento parcial — o resto fica pendente.");
    if (valor == null) return;
    if (valor <= 0) {
      toast("Informe o valor pago");
      return;
    }
    await caixaAcao((ano, mes) => PeladaAPI.caixaPagar(id, ano, mes, valor), "Registrando...");
    toast("Pagamento anotado");
    return;
  }
  if (escolha === "quitar") {
    await caixaAcao((ano, mes) => PeladaAPI.caixaQuitar(id, ano, mes), "Registrando...");
    toast(j.modalidade === "MENSAL" ? `${j.nome} · mês liberado` : `${j.nome} em dia`);
    return;
  }
  if (escolha === "desfazer") {
    await caixaAcao((ano, mes) => PeladaAPI.caixaDesfazer(id, ano, mes), "Desfazendo...");
    toast("Último pagamento desfeito");
    return;
  }
  if (escolha === "desfazer-cobranca") {
    await caixaAcao((ano, mes) => PeladaAPI.caixaDesfazerCobranca(id, ano, mes), "Cancelando...");
    toast("Última cobrança cancelada");
    return;
  }
  if (escolha === "mod-mensal") {
    await caixaAcao((ano, mes) => PeladaAPI.caixaModalidade(id, ano, mes, "MENSAL"), "Salvando...");
    toast(`${j.nome} · mensalista (paga 1x e joga o mês)`);
    return;
  }
  if (escolha === "mod-avulso") {
    await caixaAcao((ano, mes) => PeladaAPI.caixaModalidade(id, ano, mes, "AVULSO"), "Salvando...");
    toast(`${j.nome} · por jogo`);
    return;
  }
  if (escolha === "mod-isento") {
    await caixaAcao((ano, mes) => PeladaAPI.caixaModalidade(id, ano, mes, "ISENTO"), "Salvando...");
    toast(`${j.nome} · isento`);
  }
}

function guardarPresencaCaixa(local, peladaId) {
  const lista = (local?.jogadores || [])
    .filter((j) => j.apto !== false)
    .map((j) => ({
      nome: j.nome,
      goleiro: !!j.goleiro,
      apto: true,
    }));
  estado.caixaPresencaPendente = lista;
  estado.caixaPeladaIdPendente = peladaId || null;
  const btn = document.getElementById("btn-caixa-cobrar-fim");
  if (!btn) return;
  const pro = typeof PlanoApp !== "undefined" && PlanoApp.temPro();
  btn.classList.toggle("oculto", !pro || !lista.length);
}

function initCaixaPelada() {
  document.getElementById("btn-caixa-inicio")?.addEventListener("click", () => abrirCaixaPelada());
  document.getElementById("btn-caixa-home")?.addEventListener("click", () => abrirCaixaPelada());
  document.getElementById("cfg-caixa")?.addEventListener("click", () => abrirCaixaPelada());
  document.getElementById("caixa-faixa-home")?.addEventListener("click", () => abrirCaixaPelada());
  document.getElementById("btn-caixa-cobrar-fim")?.addEventListener("click", () => cobrarQuemJogouHoje());
  document.getElementById("btn-voltar-caixa")?.addEventListener("click", () => {
    mostrarTela(estado.telaAntesCaixa || "tela-inicio");
  });
  document.getElementById("caixa-mes")?.addEventListener("change", () => carregarCaixaNaTela());
  document.getElementById("caixa-painel")?.addEventListener("click", (e) => {
    const acao = e.target.closest("[data-caixa-acao]");
    if (!acao) return;
    abrirAcoesJogadorCaixa(acao.dataset.caixaAcao);
  });
  document.getElementById("form-caixa-valores")?.addEventListener("submit", (e) => {
    e.preventDefault();
    document.getElementById("btn-caixa-salvar-valores")?.click();
  });
  document.getElementById("btn-caixa-salvar-valores")?.addEventListener("click", async () => {
    const mensal = parseReais(document.getElementById("caixa-valor-mensal")?.value) ?? 0;
    const avulso = parseReais(document.getElementById("caixa-valor-avulso")?.value) ?? 0;
    await caixaAcao(
      (ano, mes) => PeladaAPI.caixaValores(ano, mes, { valorMensal: mensal, valorAvulso: avulso }),
      "Salvando valores..."
    );
    toast("Valores salvos");
  });
  document.getElementById("btn-caixa-whats")?.addEventListener("click", () => {
    const caixa = estado.caixaAtual;
    if (!caixa) return;
    window.open(`https://wa.me/?text=${encodeURIComponent(textoCaixaWhatsApp(caixa))}`, "_blank");
  });
  document.getElementById("btn-caixa-pdf")?.addEventListener("click", async () => {
    const el = document.getElementById("caixa-boletim");
    if (!el || !estado.caixaAtual) return;
    el.classList.remove("oculto");
    try {
      const nome = (estado.caixaAtual.titulo || "caixa").replace(/\s+/g, "-").toLowerCase();
      await baixarPdfElemento("caixa-boletim", `caixa-${nome}.pdf`);
    } finally {
      el.classList.add("oculto");
    }
  });
}

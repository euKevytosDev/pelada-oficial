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
  if (m === "MENSAL") return "Mensal";
  if (m === "ISENTO") return "Isento";
  return "Avulso";
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

function pctBarra(pago, cobrado) {
  const c = Number(cobrado) || 0;
  const p = Number(pago) || 0;
  if (c <= 0) return 0;
  return Math.min(100, Math.round((p / c) * 100));
}

function textoCaixaWhatsApp(caixa) {
  const t = caixa.totais || {};
  const linhas = [];
  linhas.push(`*Caixa — ${caixa.titulo || "mês"}*`);
  linhas.push(`${t.peladas || 0} pelada(s) · ${t.percentual || 0}% recebido`);
  linhas.push(`Entrou ${formatarReais(t.pago)} · falta ${formatarReais(t.pendente)}`);
  const lista = caixa.jogadores || [];
  const pend = lista.filter((j) => j.status === "PENDENTE");
  if (pend.length) {
    linhas.push("");
    linhas.push("*Ainda devem*");
    pend.forEach((j) => {
      const jogos = Number(j.jogos) ? ` · ${j.jogos} jogo(s)` : "";
      linhas.push(`• ${j.nome}: falta ${formatarReais(j.pendente)}${jogos}`);
    });
  } else {
    linhas.push("");
    linhas.push("Ninguém deve neste mês.");
  }
  linhas.push("");
  linhas.push("_Pelada Oficial_");
  return linhas.join("\n");
}

function renderBoletimCaixa(caixa) {
  const el = document.getElementById("caixa-boletim");
  if (!el) return;
  const t = caixa.totais || {};
  const pend = (caixa.jogadores || []).filter((j) => j.status === "PENDENTE");
  const ok = (caixa.jogadores || []).filter((j) => j.status === "QUITADO");
  el.innerHTML = `
    <header class="resumo-topo">
      <div>
        <p class="eyebrow">Caixa da pelada</p>
        <h2>${escHtml(caixa.titulo || "Mês")}</h2>
      </div>
      <p class="resumo-data">${t.percentual || 0}% recebido</p>
    </header>
    <p class="dica" style="margin-top:0">Entrou ${formatarReais(t.pago)} · falta ${formatarReais(t.pendente)} · ${t.peladas || 0} pelada(s)</p>
    <section class="resumo-bloco">
      <h3>Ainda devem <span class="badge-qtd">${pend.length}</span></h3>
      ${
        pend.length
          ? `<ul class="lista-resumo">${pend
              .map(
                (j) =>
                  `<li><span>${escHtml(j.nome)}${j.jogos ? ` · ${j.jogos} jogo(s)` : ""}</span><strong>${formatarReais(j.pendente)}</strong></li>`
              )
              .join("")}</ul>`
          : `<p class="dica">Ninguém deve.</p>`
      }
    </section>
    <section class="resumo-bloco">
      <h3>Quitados <span class="badge-qtd">${ok.length}</span></h3>
      ${
        ok.length
          ? `<ul class="lista-resumo">${ok.map((j) => `<li><span>${escHtml(j.nome)}</span><strong>ok</strong></li>`).join("")}</ul>`
          : `<p class="dica">Ainda ninguém quitou.</p>`
      }
    </section>
    <footer class="resumo-rodape">Pelada Oficial — boletim da caixa</footer>
  `;
}

function itemJogadorCaixa(j, caixa) {
  const pct = pctBarra(j.pago, j.cobrado);
  const statusCls = String(j.status || "").toLowerCase().replace("_", "-");
  const jogos = Number(j.jogos)
    ? `${j.jogos} jogo${Number(j.jogos) === 1 ? "" : "s"}`
    : "não jogou neste mês";
  const falta =
    j.status === "PENDENTE"
      ? `Falta ${formatarReais(j.pendente)}`
      : j.status === "QUITADO"
        ? "Quitado"
        : "Sem cobrança";
  const mensalAtivo = j.modalidade === "MENSAL";
  const avulsoAtivo = j.modalidade !== "MENSAL" && j.modalidade !== "ISENTO";
  const valorRef =
    j.modalidade === "MENSAL"
      ? `mensal ${formatarReais(caixa?.valorMensal || 0)}`
      : j.modalidade === "ISENTO"
        ? "isento"
        : `avulso ${formatarReais(caixa?.valorAvulso || 0)}`;
  return `
    <li>
      <div class="caixa-jogador">
        <div class="caixa-jogador-topo">
          <strong>${escHtml(j.nome)}${j.goleiro ? " <span class=\"meta\">GK</span>" : ""}</strong>
          <span class="caixa-mod" role="group" aria-label="Tipo de cobrança">
            <button type="button" class="caixa-mod-btn${mensalAtivo ? " ativo" : ""}"
              data-caixa-mod="MENSAL" data-caixa-id="${j.id}">Mensal</button>
            <button type="button" class="caixa-mod-btn${avulsoAtivo ? " ativo" : ""}"
              data-caixa-mod="AVULSO" data-caixa-id="${j.id}">Avulso</button>
          </span>
        </div>
        <button type="button" class="caixa-jogador-corpo" data-caixa-acao="${j.id}">
          <span class="caixa-jogador-base">
            <span class="caixa-status ${statusCls}">${falta}</span>
          </span>
          <span class="caixa-barra" aria-hidden="true"><span style="width:${pct}%"></span></span>
          <span class="caixa-jogador-base">
            <span class="caixa-detalhe">${jogos} · ${valorRef} · pago ${formatarReais(j.pago)}</span>
          </span>
        </button>
      </div>
    </li>`;
}

function renderCaixa(caixa) {
  const t = caixa.totais || {};
  const ultima = caixa.ultimaPelada || {};
  const lista = caixa.jogadores || [];
  const pend = lista.filter((j) => j.status === "PENDENTE");
  const resto = lista.filter((j) => j.status !== "PENDENTE");
  const pct = Math.min(100, Number(t.percentual) || 0);

  const mensal = document.getElementById("caixa-valor-mensal");
  const avulso = document.getElementById("caixa-valor-avulso");
  if (mensal && document.activeElement !== mensal) mensal.value = reaisParaInput(caixa.valorMensal);
  if (avulso && document.activeElement !== avulso) avulso.value = reaisParaInput(caixa.valorAvulso);

  const nomesUltima = (ultima.avulsosParaCobrar || []).map((j) => j.nome).slice(0, 4);
  const extraUltima = (ultima.avulsosParaCobrar || []).length - nomesUltima.length;
  const ctaUltima = ultima.podeCobrar
    ? `<button type="button" class="btn btn-principal" id="btn-caixa-cobrar-ultima">
         Cobrar quem jogou em ${escHtml(ultima.quandoTexto || "último jogo")}
       </button>
       <p class="dica">${nomesUltima.map(escHtml).join(", ")}${extraUltima > 0 ? ` e mais ${extraUltima}` : ""} · ${formatarReais(caixa.valorAvulso)} cada · inaptos fora</p>`
    : ultima.podeCancelar
      ? `<button type="button" class="btn btn-secundario" id="btn-caixa-cancelar-ultima">
           Cancelar cobrança de ${escHtml(ultima.quandoTexto || "último jogo")}
         </button>
         <p class="dica">Apaga o lançamento automático deste jogo. Pagamentos já anotados continuam.</p>`
      : ultima.tem
        ? `<p class="dica">Última pelada (${escHtml(ultima.quandoTexto || "")}): nada a cobrar nos avulsos aptos.</p>`
        : `<p class="dica">Encerre uma pelada neste mês para cobrar automaticamente quem entrou em campo.</p>`;

  const painel = document.getElementById("caixa-painel");
  if (painel) {
    painel.innerHTML = `
      <div class="caixa-meter">
        <p class="caixa-meter-kicker">${escHtml(caixa.titulo || "")} · ${t.peladas || 0} pelada(s)</p>
        <p class="caixa-meter-valor">${pct}<span>%</span></p>
        <p class="caixa-meter-legenda">da caixa recebida</p>
        <span class="caixa-barra caixa-barra-lg" aria-hidden="true"><span style="width:${pct}%"></span></span>
        <p class="caixa-meter-numeros">Entrou ${formatarReais(t.pago)} · falta ${formatarReais(t.pendente)}</p>
      </div>
      <div class="caixa-cta">${ctaUltima}</div>
      <h3 class="lista-titulo">Ainda devem <span class="caixa-conta">${pend.length}</span></h3>
      <ul class="lista caixa-lista">${
        pend.length
          ? pend.map((j) => itemJogadorCaixa(j, caixa)).join("")
          : `<li class="caixa-vazio"><span>Ninguém deve neste mês.</span></li>`
      }</ul>
      ${
        resto.length
          ? `<details class="caixa-mais"><summary>Quitados e sem cobrança (${resto.length})</summary>
             <ul class="lista caixa-lista">${resto.map((j) => itemJogadorCaixa(j, caixa)).join("")}</ul></details>`
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
    ? `Caixa: ${pend} ainda devem · ${formatarReais(falta)}`
    : `Caixa do mês quitada · ${formatarReais(t.pago)}`;
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
    "Lançando quem jogou..."
  );
  if (!r) return;
  const n = Number(r.cobradosAgora) || 0;
  toast(n ? `${n} avulso(s) cobrados neste jogo` : "Esse jogo já estava lançado");
}

async function cancelarUltimaPeladaCaixa() {
  const ultima = estado.caixaAtual?.ultimaPelada;
  if (!ultima?.id) return;
  const ok = confirm(
    `Cancelar a cobrança automática de ${ultima.quandoTexto || "último jogo"}?\n\nOs valores lançados desse jogo somem. Quem já pagou continua com o pagamento anotado.`
  );
  if (!ok) return;
  const r = await caixaAcao(
    (ano, mes) => PeladaAPI.caixaCancelarJogo(ano, mes, ultima.id),
    "Cancelando cobrança..."
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
  const r = await caixaAcao((ano, mes) => PeladaAPI.caixaCobrarJogo(ano, mes, body), "Cobrando quem jogou...");
  if (!r) return;
  const n = Number(r.cobradosAgora) || 0;
  toast(n ? `${n} avulso(s) cobrados` : "Esse jogo já estava na caixa");
}

async function abrirAcoesJogadorCaixa(id) {
  const j = (estado.caixaAtual?.jogadores || []).find((x) => String(x.id) === String(id));
  if (!j) return;
  const avulso = formatarReais(estado.caixaAtual?.valorAvulso || 0);
  const opcoes = [{ id: "pagar", label: "Registrar pagamento" }];
  if (j.status === "PENDENTE") {
    opcoes.push({ id: "quitar", label: `Quitou · ${formatarReais(j.pendente)}` });
  }
  opcoes.push({ id: "cobrar", label: `+1 jogo avulso (${avulso})` });
  opcoes.push({ id: "mod-isento", label: "Marcar como isento" });
  if (Number(j.pago) > 0) {
    opcoes.push({ id: "desfazer", label: "Desfazer último pagamento" });
  }
  if (Number(j.cobrado) > 0 && j.modalidade !== "MENSAL") {
    opcoes.push({ id: "desfazer-cobranca", label: "Cancelar última cobrança" });
  }

  const escolha = await escolherOpcao(j.nome, opcoes);
  if (!escolha) return;

  if (escolha === "pagar") {
    const sugerido = Number(j.pendente) > 0 ? reaisParaInput(j.pendente) : "";
    const valor = await pedirNumero(
      `Quanto ${j.nome} pagou?`,
      sugerido,
      "Se pagar só uma parte, o resto fica pendente."
    );
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
    await caixaAcao((ano, mes) => PeladaAPI.caixaQuitar(id, ano, mes), "Quitando...");
    toast("Quitado");
    return;
  }
  if (escolha === "cobrar") {
    await caixaAcao((ano, mes) => PeladaAPI.caixaCobrar(id, ano, mes), "Cobrando...");
    toast("Jogo cobrado");
    return;
  }
  if (escolha === "desfazer") {
    await caixaAcao((ano, mes) => PeladaAPI.caixaDesfazer(id, ano, mes), "Desfazendo...");
    toast("Último pagamento desfeito");
    return;
  }
  if (escolha === "desfazer-cobranca") {
    await caixaAcao((ano, mes) => PeladaAPI.caixaDesfazerCobranca(id, ano, mes), "Cancelando cobrança...");
    toast("Última cobrança cancelada");
    return;
  }
  if (escolha === "mod-isento") {
    await caixaAcao((ano, mes) => PeladaAPI.caixaModalidade(id, ano, mes, "ISENTO"), "Salvando...");
    toast(`${j.nome} · isento`);
  }
}

async function mudarModalidadeCaixa(id, modalidade) {
  const j = (estado.caixaAtual?.jogadores || []).find((x) => String(x.id) === String(id));
  if (!j || j.modalidade === modalidade) return;
  const r = await caixaAcao(
    (ano, mes) => PeladaAPI.caixaModalidade(id, ano, mes, modalidade),
    "Salvando tipo..."
  );
  if (!r) return;
  const nome = j.nome || "Jogador";
  toast(
    modalidade === "MENSAL"
      ? `${nome} · mensal (${formatarReais(estado.caixaAtual?.valorMensal || 0)})`
      : `${nome} · avulso (${formatarReais(estado.caixaAtual?.valorAvulso || 0)})`
  );
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
    const mod = e.target.closest("[data-caixa-mod]");
    if (mod) {
      e.preventDefault();
      mudarModalidadeCaixa(mod.dataset.caixaId, mod.dataset.caixaMod);
      return;
    }
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
    toast("Valores da caixa salvos");
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

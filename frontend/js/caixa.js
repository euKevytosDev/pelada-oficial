/**
 * Caixa da pelada (Pelada Pro) — só o organizador vê quem pagou e quem deve.
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

function textoCaixaWhatsApp(caixa) {
  const t = caixa.totais || {};
  const linhas = [];
  linhas.push(`*Caixa — ${caixa.titulo || "mês"}*`);
  linhas.push(`Mensal ${formatarReais(caixa.valorMensal)} · avulso ${formatarReais(caixa.valorAvulso)}`);
  linhas.push(`Recebido ${formatarReais(t.pago)} · falta ${formatarReais(t.pendente)}`);
  const lista = caixa.jogadores || [];
  const pend = lista.filter((j) => j.status === "PENDENTE");
  const ok = lista.filter((j) => j.status === "QUITADO");
  if (pend.length) {
    linhas.push("");
    linhas.push("*Pendentes*");
    pend.forEach((j) => {
      linhas.push(`• ${j.nome}: pagou ${formatarReais(j.pago)} · falta ${formatarReais(j.pendente)}`);
    });
  }
  if (ok.length) {
    linhas.push("");
    linhas.push("*Quitados*");
    ok.forEach((j) => linhas.push(`• ${j.nome}`));
  }
  linhas.push("");
  linhas.push("_Pelada Oficial — só o organizador_");
  return linhas.join("\n");
}

function renderCaixa(caixa) {
  const t = caixa.totais || {};
  const resumo = document.getElementById("caixa-resumo");
  if (resumo) {
    resumo.innerHTML = `
      <p class="caixa-resumo-pago">Recebido ${formatarReais(t.pago)}</p>
      <p class="caixa-resumo-pendente">Falta ${formatarReais(t.pendente)}</p>
    `;
  }

  const mensal = document.getElementById("caixa-valor-mensal");
  const avulso = document.getElementById("caixa-valor-avulso");
  if (mensal && document.activeElement !== mensal) mensal.value = reaisParaInput(caixa.valorMensal);
  if (avulso && document.activeElement !== avulso) avulso.value = reaisParaInput(caixa.valorAvulso);

  const filtro = document.getElementById("caixa-filtro")?.value || "todos";
  const busca = (document.getElementById("caixa-busca")?.value || "").trim().toLowerCase();
  let lista = caixa.jogadores || [];
  if (filtro === "pendente") lista = lista.filter((j) => j.status === "PENDENTE");
  if (filtro === "quitado") lista = lista.filter((j) => j.status === "QUITADO");
  if (busca) lista = lista.filter((j) => String(j.nome || "").toLowerCase().includes(busca));

  const ul = document.getElementById("caixa-lista");
  if (!ul) return;
  if (!lista.length) {
    ul.innerHTML = `<li class="caixa-vazio"><span>Ninguém nesta lista ainda. Cadastre o elenco na pelada — eles aparecem aqui.</span></li>`;
    return;
  }
  ul.innerHTML = lista
    .map((j) => {
      const statusCls = String(j.status || "").toLowerCase().replace("_", "-");
      const detalhe =
        j.status === "PENDENTE"
          ? `Pago ${formatarReais(j.pago)} · falta ${formatarReais(j.pendente)}`
          : j.status === "QUITADO"
            ? `Quitado · ${formatarReais(j.pago)}`
            : j.modalidade === "MENSAL"
              ? "Mensalista — ainda sem pagamento neste mês"
              : "Avulso — cobre uma pelada quando ele jogar";
      return `
        <li>
          <button type="button" class="caixa-jogador" data-caixa-id="${j.id}">
            <span class="caixa-jogador-topo">
              <strong>${escHtml(j.nome)}${j.goleiro ? " <span class=\"meta\">GK</span>" : ""}</strong>
              <span class="caixa-tag">${rotuloModalidade(j.modalidade)}</span>
            </span>
            <span class="caixa-jogador-base">
              <span class="caixa-detalhe">${detalhe}</span>
              <span class="caixa-status ${statusCls}">${
                j.status === "PENDENTE" ? formatarReais(j.pendente) : j.status === "QUITADO" ? "ok" : "—"
              }</span>
            </span>
          </button>
        </li>`;
    })
    .join("");
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
  if (typeof PlanoApp !== "undefined" && !PlanoApp.exigirPro("A caixa da pelada faz parte do Pelada Pro")) {
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
  } catch (err) {
    toast(err.message || "Não deu para atualizar a caixa");
  }
}

async function abrirAcoesJogadorCaixa(id) {
  const j = (estado.caixaAtual?.jogadores || []).find((x) => String(x.id) === String(id));
  if (!j) return;
  const avulso = formatarReais(estado.caixaAtual?.valorAvulso || 0);
  const opcoes = [
    { id: "pagar", label: "Registrar pagamento" },
  ];
  if (j.status === "PENDENTE") {
    opcoes.push({ id: "quitar", label: `Quitou · paga ${formatarReais(j.pendente)}` });
  }
  opcoes.push({ id: "cobrar", label: `+1 pelada avulsa (${avulso})` });
  opcoes.push({ id: "mod-mensal", label: "Tipo: mensalista" });
  opcoes.push({ id: "mod-avulso", label: "Tipo: avulso" });
  opcoes.push({ id: "mod-isento", label: "Tipo: isento" });
  if (Number(j.pago) > 0) {
    opcoes.push({ id: "desfazer", label: "Desfazer último pagamento" });
  }

  const escolha = await escolherOpcao(`${j.nome}`, opcoes);
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
    await caixaAcao((ano, mes) => PeladaAPI.caixaCobrar(id, ano, mes), "Cobrando pelada...");
    toast("Pelada cobrada");
    return;
  }
  if (escolha === "desfazer") {
    await caixaAcao((ano, mes) => PeladaAPI.caixaDesfazer(id, ano, mes), "Desfazendo...");
    toast("Último pagamento desfeito");
    return;
  }
  const mapa = { "mod-mensal": "MENSAL", "mod-avulso": "AVULSO", "mod-isento": "ISENTO" };
  const modalidade = mapa[escolha];
  if (modalidade) {
    await caixaAcao((ano, mes) => PeladaAPI.caixaModalidade(id, ano, mes, modalidade), "Salvando...");
    toast(`${j.nome} · ${rotuloModalidade(modalidade).toLowerCase()}`);
  }
}

function initCaixaPelada() {
  document.getElementById("btn-caixa-inicio")?.addEventListener("click", () => abrirCaixaPelada());
  document.getElementById("btn-caixa-home")?.addEventListener("click", () => abrirCaixaPelada());
  document.getElementById("cfg-caixa")?.addEventListener("click", () => abrirCaixaPelada());
  document.getElementById("btn-voltar-caixa")?.addEventListener("click", () => {
    mostrarTela(estado.telaAntesCaixa || "tela-inicio");
  });
  document.getElementById("caixa-mes")?.addEventListener("change", () => carregarCaixaNaTela());
  document.getElementById("caixa-filtro")?.addEventListener("change", () => {
    if (estado.caixaAtual) renderCaixa(estado.caixaAtual);
  });
  document.getElementById("caixa-busca")?.addEventListener("input", () => {
    if (estado.caixaAtual) renderCaixa(estado.caixaAtual);
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
  document.getElementById("caixa-lista")?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-caixa-id]");
    if (!btn) return;
    abrirAcoesJogadorCaixa(btn.dataset.caixaId);
  });
  document.getElementById("btn-caixa-whats")?.addEventListener("click", () => {
    const caixa = estado.caixaAtual;
    if (!caixa) return;
    window.open(`https://wa.me/?text=${encodeURIComponent(textoCaixaWhatsApp(caixa))}`, "_blank");
  });
}

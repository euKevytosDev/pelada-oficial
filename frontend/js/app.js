/**
 * Pelada Oficial — telas no celular
 *
 * - Estrelas 1 a 10
 * - Goleiros fixos (emprestáveis entre times)
 * - Nome do time editável (padrão = jogador com mais estrelas)
 * - Gol contra (invertido: time que sofreu escolhe o autor)
 */

const estado = {
  peladaId: null,
  peladaAtiva: null,
  ultimaPelada: null,
  historicoPeladas: [],
  estrelasSelecionadas: 5,
  times: [],
  goleiros: [],
  partidaAtual: null,
  resumoAtual: null,
  sumulaManual: false,
  telaAntesSumula: "tela-inicio",
  telaAntesConfig: "tela-inicio",
  telaAntesHistorico: "tela-inicio",
};

/** Pelada encerrada pode ser retomada por até 24h. */
const JANELA_RETOMAR_MS = 24 * 60 * 60 * 1000;

function mostrarTela(id) {
  document.querySelectorAll(".tela").forEach((tela) => tela.classList.remove("ativa"));
  document.getElementById(id).classList.add("ativa");

  const titulos = {
    "tela-auth": "Entre para salvar sua pelada",
    "tela-inicio": "Controle da pelada no celular",
    "tela-configuracoes": "Configurações",
    "tela-historico": "Histórico de peladas",
    "tela-sumula-manual": "Gerar súmula sem marcar jogo",
    "tela-jogadores": "Jogadores e goleiros",
    "tela-times": "Times sorteados",
    "tela-partida": "Partida ao vivo",
    "tela-classificacao": "Classificação",
    "tela-fim": "Súmula oficial",
  };
  document.getElementById("subtitulo-tela").textContent = titulos[id] || "";
}

function toast(mensagem) {
  const el = document.getElementById("toast");
  el.textContent = mensagem;
  el.classList.remove("oculto");
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => el.classList.add("oculto"), 2600);
}

let loadingCount = 0;
function mostrarLoading(texto) {
  const overlay = document.getElementById("loading-overlay");
  const label = document.getElementById("loading-texto");
  if (label) label.textContent = texto || "Carregando...";
  loadingCount += 1;
  if (overlay) overlay.classList.remove("oculto");
}

function esconderLoading() {
  loadingCount = Math.max(0, loadingCount - 1);
  if (loadingCount > 0) return;
  const overlay = document.getElementById("loading-overlay");
  if (overlay) overlay.classList.add("oculto");
}

async function comLoading(fn, texto) {
  mostrarLoading(texto);
  try {
    return await fn();
  } finally {
    esconderLoading();
  }
}

function msDesdeEncerramento(pelada) {
  const t = pelada?.encerradaEm || pelada?.criadaEm;
  if (!t) return Infinity;
  const d = new Date(t);
  return Number.isNaN(d.getTime()) ? Infinity : Date.now() - d.getTime();
}

function podeContinuarPelada(pelada) {
  if (!pelada?.id) return false;
  if (pelada.status === "EM_ANDAMENTO" || pelada.status === "AGUARDANDO") return true;
  if (pelada.status === "ENCERRADA") return msDesdeEncerramento(pelada) < JANELA_RETOMAR_MS;
  return false;
}

function podeVerSumula(pelada) {
  return pelada?.status === "ENCERRADA" || pelada?.status === "EM_ANDAMENTO";
}

function badgeStatusPelada(pelada) {
  if (pelada.status === "EM_ANDAMENTO") return { cls: "", txt: "Ao vivo" };
  if (pelada.status === "AGUARDANDO") return { cls: "", txt: "Preparando" };
  if (pelada.status === "ENCERRADA" && podeContinuarPelada(pelada)) {
    const restante = JANELA_RETOMAR_MS - msDesdeEncerramento(pelada);
    const horas = Math.max(1, Math.ceil(restante / 3600000));
    return { cls: "retomar", txt: `Retomar · ${horas}h` };
  }
  return { cls: "encerrada", txt: "Encerrada" };
}

function metaPeladaHistorico(pelada) {
  const quando = pelada.encerradaEm || pelada.criadaEm;
  const data = quando ? formatarDataBr(quando) : "";
  if (pelada.status === "ENCERRADA" && podeContinuarPelada(pelada)) {
    return `${data} · pode continuar com mais partidas`;
  }
  if (pelada.status === "ENCERRADA") {
    return data ? `Encerrada em ${data}` : "Encerrada";
  }
  if (pelada.status === "EM_ANDAMENTO") return "Pelada em andamento";
  return data ? `Criada em ${data}` : "";
}

function htmlItemHistorico(pelada, opcoes = {}) {
  const badge = badgeStatusPelada(pelada);
  const meta = metaPeladaHistorico(pelada);
  const botoes = [];

  if (podeContinuarPelada(pelada)) {
    const label =
      pelada.status === "ENCERRADA" ? "Continuar partidas" : "Abrir pelada";
    botoes.push(
      `<button type="button" class="btn-mini" data-hist-acao="continuar" data-pelada-id="${pelada.id}">${label}</button>`
    );
  }
  if (podeVerSumula(pelada)) {
    botoes.push(
      `<button type="button" class="btn-mini" data-hist-acao="sumula" data-pelada-id="${pelada.id}">Ver súmula</button>`
    );
  }
  if (opcoes.mostrarApagar) {
    botoes.push(
      `<button type="button" class="btn-apagar btn-mini" data-hist-acao="apagar" data-pelada-id="${pelada.id}">Apagar</button>`
    );
  }

  return `
    <li data-pelada-id="${pelada.id}">
      <div class="historico-linha">
        <div>
          <strong>${pelada.nome || "Pelada Oficial"}</strong>
          <p class="historico-meta">${meta}</p>
        </div>
        <span class="badge-status ${badge.cls}">${badge.txt}</span>
      </div>
      ${botoes.length ? `<div class="historico-acoes">${botoes.join("")}</div>` : ""}
    </li>`;
}

function renderHistoricoLista(listaEl, peladas, limite, opcoes) {
  if (!listaEl) return;
  const itens = (peladas || []).slice(0, limite ?? peladas.length);
  if (!itens.length) {
    listaEl.innerHTML = `<li><span>Nenhuma pelada salva ainda</span><span class="meta">—</span></li>`;
    return;
  }
  listaEl.innerHTML = itens.map((p) => htmlItemHistorico(p, opcoes)).join("");
}

async function carregarHistoricoPeladas() {
  try {
    const lista = await PeladaAPI.listarMinhas();
    const ocultos = new Set(lerApagarPendentes().map(String));
    estado.historicoPeladas = (lista || []).filter((p) => p && p.id && !ocultos.has(String(p.id)));
    if (estado.historicoPeladas[0]) {
      estado.ultimaPelada = estado.historicoPeladas[0];
      localStorage.setItem("pelada_ultima_id", String(estado.historicoPeladas[0].id));
    }
    return estado.historicoPeladas;
  } catch (_) {
    const ocultos = new Set(lerApagarPendentes().map(String));
    return (estado.historicoPeladas || []).filter((p) => p && !ocultos.has(String(p.id)));
  }
}

function peladasParaHistoricoHome(idAtiva) {
  const ocultos = new Set(lerApagarPendentes().map(String));
  return (estado.historicoPeladas || []).filter(
    (p) =>
      p &&
      !ocultos.has(String(p.id)) &&
      (!idAtiva || Number(p.id) !== Number(idAtiva))
  );
}

const APAGAR_PENDENTE_KEY = "pelada_apagar_pendente";

function lerApagarPendentes() {
  try {
    const raw = localStorage.getItem(APAGAR_PENDENTE_KEY);
    const lista = raw ? JSON.parse(raw) : [];
    return Array.isArray(lista) ? lista.map(String) : [];
  } catch (_) {
    return [];
  }
}

function salvarApagarPendentes(ids) {
  const unicos = [...new Set((ids || []).map(String).filter(Boolean))];
  if (!unicos.length) localStorage.removeItem(APAGAR_PENDENTE_KEY);
  else localStorage.setItem(APAGAR_PENDENTE_KEY, JSON.stringify(unicos));
}

function marcarApagarPendente(peladaId) {
  const ids = lerApagarPendentes();
  const id = String(peladaId);
  if (!ids.includes(id)) ids.push(id);
  salvarApagarPendentes(ids);
}

function limparApagarPendente(peladaId) {
  salvarApagarPendentes(lerApagarPendentes().filter((id) => id !== String(peladaId)));
}

/** Apaga no servidor em segundo plano (sem travar a tela). */
async function sincronizarApaguesPendentes() {
  if (!getToken()) return;
  const pendentes = lerApagarPendentes();
  if (!pendentes.length) return;
  for (const id of pendentes) {
    try {
      await PeladaAPI.apagar(id);
      limparApagarPendente(id);
    } catch (err) {
      const msg = String(err?.message || "").toLowerCase();
      // Já não existe no servidor — pode tirar da fila
      if (msg.includes("404") || msg.includes("não encontrada") || msg.includes("nao encontrada")) {
        limparApagarPendente(id);
      }
      // Rede/Render lento: tenta de novo depois
    }
  }
}

async function abrirSumulaPelada(peladaId) {
  await comLoading(async () => {
    const resumo = await PeladaAPI.resumo(peladaId);
    estado.peladaId = peladaId;
    estado.resumoAtual = resumo;
    estado.sumulaManual = false;
    const boxAtraso = document.getElementById("box-atraso-fim");
    if (boxAtraso) boxAtraso.classList.remove("oculto");
    renderResumoOficial(resumo);
    await carregarObservacoes(null, "atraso-jogador-fim").catch(() => {});
    mostrarTela("tela-fim");
  }, "Carregando súmula...");
}

async function continuarPeladaPorId(peladaId) {
  const pelada =
    (estado.historicoPeladas || []).find((p) => Number(p.id) === Number(peladaId)) ||
    (estado.peladaAtiva?.id === peladaId ? estado.peladaAtiva : null) ||
    (await PeladaAPI.buscar(peladaId).catch(() => null));

  if (!pelada?.id) {
    toast("Pelada não encontrada");
    return;
  }

  await comLoading(async () => {
    if (pelada.status === "ENCERRADA") {
      if (!podeContinuarPelada(pelada)) {
        throw new Error("Passou das 24 horas — só dá para ver a súmula");
      }
      await PeladaAPI.reabrir(pelada.id);
      const payload = await PeladaAPI.retomarPorId(pelada.id);
      if (payload?.pelada) {
        await aplicarRetomada(payload);
      } else {
        await retomarPelada({ ...pelada, status: "EM_ANDAMENTO" });
      }
      toast("Pelada retomada — pode seguir com mais partidas");
      return;
    }

    estado.peladaAtiva = pelada;
    if (Number(localStorage.getItem(PELADA_KEY)) === Number(pelada.id) && tentarRetomarDoCelular(pelada.id)) {
      return;
    }
    const payload = await PeladaAPI.retomarPorId(pelada.id).catch(() => null);
    if (payload?.pelada) {
      await aplicarRetomada(payload);
    } else {
      await retomarPelada(pelada);
    }
  }, "Abrindo pelada...");
}

async function apagarPeladaPorId(peladaId) {
  const pelada = (estado.historicoPeladas || []).find((p) => Number(p.id) === Number(peladaId));
  const nome = pelada?.nome || "esta pelada";
  if (!confirm(`Apagar "${nome}"?\n\nNão dá para desfazer.`)) return;

  // Some da tela na hora — sync do DELETE em segundo plano
  marcarApagarPendente(peladaId);
  estado.historicoPeladas = (estado.historicoPeladas || []).filter(
    (p) => Number(p.id) !== Number(peladaId)
  );
  if (Number(localStorage.getItem(PELADA_KEY)) === Number(peladaId)) {
    localStorage.removeItem(PELADA_KEY);
  }
  const local = LocalJogo.obter();
  if (local?.peladaId && Number(local.peladaId) === Number(peladaId)) {
    LocalJogo.limpar();
  }
  if (Number(localStorage.getItem("pelada_ultima_id")) === Number(peladaId)) {
    const prox = estado.historicoPeladas[0];
    if (prox?.id) localStorage.setItem("pelada_ultima_id", String(prox.id));
    else localStorage.removeItem("pelada_ultima_id");
    estado.ultimaPelada = prox || null;
  }

  await atualizarHistoricoHome();
  const listaCompleta = document.getElementById("lista-historico-completo");
  if (listaCompleta && document.getElementById("tela-historico")?.classList.contains("ativa")) {
    renderHistoricoLista(listaCompleta, estado.historicoPeladas, null, { mostrarApagar: true });
  }

  toast("Pelada apagada");
  sincronizarApaguesPendentes().catch(() => {});
}

async function atualizarHistoricoHome() {
  const boxHistorico = document.getElementById("box-historico-recente");
  const listaHome = document.getElementById("lista-historico-home");
  if (!boxHistorico || !listaHome) return;

  let idAtiva =
    estado.peladaAtiva?.id ||
    Number(localStorage.getItem(PELADA_KEY)) ||
    LocalJogo.obter()?.peladaId ||
    null;

  const recentes = peladasParaHistoricoHome(idAtiva);
  if (recentes.length) {
    renderHistoricoLista(listaHome, recentes, 5, { mostrarApagar: true });
    boxHistorico.classList.remove("oculto");
  } else {
    boxHistorico.classList.add("oculto");
    listaHome.innerHTML = "";
  }
}

function configurarCliqueHistorico(listaEl) {
  if (!listaEl || listaEl._histBound) return;
  listaEl._histBound = true;
  listaEl.addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-hist-acao]");
    if (!btn) return;
    const id = Number(btn.dataset.peladaId);
    const acao = btn.dataset.histAcao;
    try {
      if (acao === "continuar") await continuarPeladaPorId(id);
      else if (acao === "sumula") await abrirSumulaPelada(id);
      else if (acao === "apagar") await apagarPeladaPorId(id);
    } catch (err) {
      toast(err.message);
    }
  });
}

function estrelasTexto(n) {
  const nivel = Number(n) || 0;
  if (nivel <= 0) return "GK";
  return `${nivel}★`;
}

function montarSeletorEstrelas() {
  const box = document.getElementById("seletor-estrelas");
  box.innerHTML = "";
  for (let i = 1; i <= 10; i++) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "estrela" + (i <= estado.estrelasSelecionadas ? " ativa" : "");
    btn.dataset.estrela = String(i);
    btn.textContent = "★";
    btn.addEventListener("click", () => {
      estado.estrelasSelecionadas = i;
      box.querySelectorAll(".estrela").forEach((b) => {
        b.classList.toggle("ativa", Number(b.dataset.estrela) <= i);
      });
      document.getElementById("nivel-num").textContent = `${i} ★`;
    });
    box.appendChild(btn);
  }
  document.getElementById("nivel-num").textContent = `${estado.estrelasSelecionadas} ★`;
}

let modalEsperaResolve = null;
let modalAbertoEm = 0;

function abrirModal(titulo, corpoHtml) {
  // Nunca cobre escolha com a bolinha
  loadingCount = 0;
  const overlay = document.getElementById("loading-overlay");
  if (overlay) overlay.classList.add("oculto");

  modalAbertoEm = Date.now();
  document.getElementById("modal-titulo").textContent = titulo;
  document.getElementById("modal-corpo").innerHTML = corpoHtml;
  document.getElementById("modal").classList.remove("oculto");
}

function fecharModal() {
  document.getElementById("modal").classList.add("oculto");
  document.getElementById("modal-corpo").innerHTML = "";
}

/** Fecha modal e resolve a Promise pendente (cancelar = null). */
function cancelarModalPendente() {
  // Ignora o toque que abriu o modal (click-through no fundo)
  if (Date.now() - modalAbertoEm < 400) return;

  if (typeof modalEsperaResolve === "function") {
    const done = modalEsperaResolve;
    modalEsperaResolve = null;
    fecharModal();
    done(null);
    return;
  }
  fecharModal();
}

function escolherOpcao(titulo, opcoes, opts = {}) {
  return new Promise((resolve) => {
    if (!opcoes.length) {
      toast("Nenhuma opção disponível");
      resolve(null);
      return;
    }

    const layout = opts.layout === "grade" ? "grade" : "lista";
    modalEsperaResolve = resolve;
    const html = `
      <div class="opcoes opcoes-${layout}">
        ${opcoes
          .map((o) => {
            const extra = o.goleiro ? " opcao-goleiro" : "";
            return `<button type="button" class="opcao${extra}" data-id="${o.id}">${o.label}</button>`;
          })
          .join("")}
      </div>
    `;
    abrirModal(titulo, html);

    const corpo = document.getElementById("modal-corpo");
    const onClick = (e) => {
      const btn = e.target.closest(".opcao");
      if (!btn) return;
      e.preventDefault();
      e.stopPropagation();
      corpo.removeEventListener("click", onClick);
      modalEsperaResolve = null;
      fecharModal();
      resolve(btn.dataset.id);
    };

    // Evita o mesmo toque do botão "Iniciar" fechar o modal na hora
    setTimeout(() => {
      if (modalEsperaResolve !== resolve) return;
      corpo.addEventListener("click", onClick);
    }, 280);
  });
}

function pedirTexto(titulo, valorInicial = "") {
  return new Promise((resolve) => {
    modalEsperaResolve = resolve;
    abrirModal(
      titulo,
      `<input type="text" id="modal-input" maxlength="40" value="${valorInicial.replace(/"/g, "&quot;")}" />
       <button type="button" class="btn btn-principal" id="modal-ok">Salvar</button>
       <p class="dica-modal">Deixe vazio para usar o jogador com mais estrelas.</p>`
    );
    const input = document.getElementById("modal-input");
    input.focus();
    const ok = () => {
      if (modalEsperaResolve !== resolve) return;
      modalEsperaResolve = null;
      const valor = input.value.trim();
      fecharModal();
      resolve(valor);
    };
    setTimeout(() => {
      if (modalEsperaResolve !== resolve) return;
      document.getElementById("modal-ok")?.addEventListener("click", ok, { once: true });
      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") ok();
      });
    }, 280);
  });
}

/* ---------- render ---------- */

function renderListasCadastro(todos) {
  const linha = todos
    .filter((j) => !j.goleiro)
    .sort((a, b) => (a.estrelas || 0) - (b.estrelas || 0) || a.nome.localeCompare(b.nome));
  const goleiros = todos
    .filter((j) => j.goleiro)
    .sort((a, b) => a.nome.localeCompare(b.nome));
  estado.goleiros = goleiros;

  const aptosLinha = linha.filter((j) => j.apto !== false).length;
  const aptosGk = goleiros.filter((j) => j.apto !== false).length;
  const contadores = document.getElementById("contadores-elenco");
  if (contadores) {
    contadores.textContent = `${linha.length} jogador(es) · ${goleiros.length} goleiro(s) · ${aptosLinha + aptosGk} apto(s) para o sorteio`;
  }

  const listaJ = document.getElementById("lista-jogadores");
  const listaG = document.getElementById("lista-goleiros");

  listaJ.innerHTML = linha.length
    ? linha
        .map(
          (j) => `
      <li class="${j.apto === false ? "inapto" : ""}">
        <span>${j.nome}</span>
        <span class="meta-acoes">
          <span class="meta">${estrelasTexto(j.estrelas)}</span>
          <button type="button" class="btn-apto ${j.apto === false ? "off" : ""}" data-apto-id="${j.id}" data-apto="${j.apto !== false}">
            ${j.apto === false ? "Inapto" : "Apto"}
          </button>
          <button type="button" class="btn-editar" data-editar-id="${j.id}" aria-label="Editar ${j.nome}">Editar</button>
          <button type="button" class="btn-apagar" data-apagar-id="${j.id}" aria-label="Apagar ${j.nome}">Apagar</button>
        </span>
      </li>`
        )
        .join("")
    : `<li><span>Nenhum jogador ainda</span><span class="meta">adicione acima</span></li>`;

  listaG.innerHTML = goleiros.length
    ? goleiros
        .map(
          (j) => `
      <li class="${j.apto === false ? "inapto" : ""}">
        <span>${j.nome}</span>
        <span class="meta-acoes">
          <span class="meta">goleiro</span>
          <button type="button" class="btn-apto ${j.apto === false ? "off" : ""}" data-apto-id="${j.id}" data-apto="${j.apto !== false}">
            ${j.apto === false ? "Inapto" : "Apto"}
          </button>
          <button type="button" class="btn-editar" data-editar-id="${j.id}" aria-label="Editar ${j.nome}">Editar</button>
          <button type="button" class="btn-apagar" data-apagar-id="${j.id}" aria-label="Apagar ${j.nome}">Apagar</button>
        </span>
      </li>`
        )
        .join("")
    : `<li><span>Nenhum goleiro ainda</span><span class="meta">adicione acima</span></li>`;
}

async function alternarApto(jogadorId, aptoAtual) {
  LocalJogo.atualizarJogador(jogadorId, { apto: !aptoAtual });
  await carregarCadastro();
  toast(!aptoAtual ? "Marcado como apto" : "Marcado como inapto (fora do sorteio)");
}

async function apagarJogador(jogadorId) {
  const ok = confirm("Apagar esta pessoa da lista?");
  if (!ok) return;
  LocalJogo.removerJogador(jogadorId);
  await carregarCadastro();
  toast("Removido da lista");
}

function pedirEdicaoJogador(jogador) {
  return new Promise((resolve) => {
    const estrelasIniciais = Number(jogador.estrelas) || 5;
    const blocoEstrelas = jogador.goleiro
      ? `<p class="dica-modal">Goleiro não usa estrelas no sorteio.</p>`
      : `
        <label class="dica-modal">Estrelas (1 a 10)</label>
        <div class="modal-estrelas" id="modal-estrelas" role="group"></div>
        <p class="nivel-num" id="modal-nivel">${estrelasIniciais} ★</p>
      `;

    abrirModal(
      "Editar " + (jogador.goleiro ? "goleiro" : "jogador"),
      `<label>Nome
         <input type="text" id="modal-input" maxlength="80" value="${String(jogador.nome).replace(/"/g, "&quot;")}" />
       </label>
       ${blocoEstrelas}
       <button type="button" class="btn btn-principal" id="modal-ok">Salvar</button>`
    );

    let estrelas = estrelasIniciais;
    if (!jogador.goleiro) {
      const box = document.getElementById("modal-estrelas");
      for (let i = 1; i <= 10; i++) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "estrela" + (i <= estrelas ? " ativa" : "");
        btn.dataset.estrela = String(i);
        btn.textContent = "★";
        btn.addEventListener("click", () => {
          estrelas = i;
          box.querySelectorAll(".estrela").forEach((b) => {
            b.classList.toggle("ativa", Number(b.dataset.estrela) <= i);
          });
          document.getElementById("modal-nivel").textContent = `${i} ★`;
        });
        box.appendChild(btn);
      }
    }

    const input = document.getElementById("modal-input");
    input.focus();
    input.select();

    const ok = () => {
      const nome = input.value.trim();
      if (!nome) {
        toast("Informe o nome");
        return;
      }
      fecharModal();
      resolve(jogador.goleiro ? { nome } : { nome, estrelas });
    };

    document.getElementById("modal-ok").addEventListener("click", ok);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") ok();
    });

    const onCancel = () => {
      fecharModal();
      resolve(null);
    };
    document.getElementById("modal-fechar").addEventListener("click", onCancel, { once: true });
    document.getElementById("modal-fundo").addEventListener("click", onCancel, { once: true });
  });
}

async function editarJogador(jogadorId) {
  const todos = LocalJogo.listarJogadores();
  const jogador = todos.find((j) => String(j.id) === String(jogadorId));
  if (!jogador) {
    toast("Jogador não encontrado");
    return;
  }

  const dados = await pedirEdicaoJogador(jogador);
  if (!dados) return;

  LocalJogo.atualizarJogador(jogadorId, dados);
  await carregarCadastro();
  toast("Atualizado");
}

function renderTimes(times) {
  estado.times = times;
  const comGoleiro = times.filter((t) => t.goleiro).length;
  const semGoleiro = times.length - comGoleiro;
  const grade = document.getElementById("grade-times");
  grade.innerHTML = `
    <p class="dica-times">
      Arraste um jogador para outro time (ou toque em <strong>Mover</strong>).
      Pode desequilibrar as estrelas à vontade.
      ${semGoleiro > 0 ? ` · ${semGoleiro} time(s) sem goleiro (emprestam na partida).` : " · Todos têm goleiro."}
    </p>
    ${times
      .map((t) => {
        const gk = t.goleiro ? t.goleiro.nome : "sem goleiro — empresta na partida";
        return `
      <article class="time-card" style="border-left-color:${t.cor}" data-time-id="${t.id}">
        <div class="time-topo">
          <h3>${t.nome}</h3>
          <button type="button" class="btn-mini" data-acao="renomear" data-time-id="${t.id}">Renomear</button>
        </div>
        <p class="estrelas-total">${t.totalEstrelas}★ linha · ${t.jogadores.length} jogadores</p>
        <p class="gk-linha">Goleiro: <strong>${gk}</strong>
          <button type="button" class="btn-mini" data-acao="goleiro" data-time-id="${t.id}">Trocar</button>
        </p>
        <ul class="lista-time-jogadores" data-time-id="${t.id}">
          ${(t.jogadores || [])
            .slice()
            .sort((a, b) => (a.estrelas || 0) - (b.estrelas || 0) || a.nome.localeCompare(b.nome))
            .map(
              (j) => `
            <li class="jogador-arrastavel"
                draggable="true"
                data-jogador-id="${j.id}"
                data-time-origem="${t.id}">
              <span class="jogador-arraste-handle" aria-hidden="true">⠿</span>
              <span class="jogador-nome">${j.nome}</span>
              <span class="meta">${estrelasTexto(j.estrelas)}</span>
              <button type="button" class="btn-mini" data-acao="mover" data-jogador-id="${j.id}" data-time-origem="${t.id}">Mover</button>
            </li>`
            )
            .join("")}
        </ul>
      </article>`;
      })
      .join("")}
  `;
  ativarArrasteJogadores();
}

async function moverJogadorParaTime(jogadorId, timeDestinoId) {
  LocalJogo.moverJogadorLocal(jogadorId, timeDestinoId);
  renderTimes(LocalJogo.listarTimes());
  toast("Jogador movido");
}

async function escolherTimeParaMover(jogadorId, timeOrigemId) {
  const destinos = estado.times.filter((t) => String(t.id) !== String(timeOrigemId));
  if (!destinos.length) {
    toast("Só há um time");
    return;
  }
  const timeId = await escolherOpcao(
    "Mover para qual time?",
    destinos.map((t) => ({ id: t.id, label: `${t.nome} (${t.totalEstrelas}★)` })),
    { layout: "grade" }
  );
  if (!timeId) return;
  await moverJogadorParaTime(jogadorId, timeId);
}

function ativarArrasteJogadores() {
  const grade = document.getElementById("grade-times");
  if (!grade) return;

  let arrastandoId = null;
  let origemId = null;
  let ghost = null;

  grade.querySelectorAll(".jogador-arrastavel").forEach((li) => {
    li.addEventListener("dragstart", (e) => {
      arrastandoId = li.dataset.jogadorId;
      origemId = li.dataset.timeOrigem;
      li.classList.add("arrastando");
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", String(arrastandoId));
    });
    li.addEventListener("dragend", () => {
      li.classList.remove("arrastando");
      grade.querySelectorAll(".time-card").forEach((c) => c.classList.remove("drop-alvo"));
      arrastandoId = null;
      origemId = null;
    });

    // Toque no celular (pointer)
    li.addEventListener("pointerdown", (e) => {
      if (e.target.closest("button")) return;
      if (e.pointerType === "mouse" && e.button !== 0) return;

      const jogadorId = li.dataset.jogadorId;
      const timeOrigem = li.dataset.timeOrigem;
      const startX = e.clientX;
      const startY = e.clientY;
      let moved = false;

      const onMove = (ev) => {
        const dx = ev.clientX - startX;
        const dy = ev.clientY - startY;
        if (!moved && Math.hypot(dx, dy) < 8) return;
        if (!moved) {
          moved = true;
          arrastandoId = jogadorId;
          origemId = timeOrigem;
          li.classList.add("arrastando");
          ghost = li.cloneNode(true);
          ghost.classList.add("ghost-arraste");
          ghost.style.width = `${li.offsetWidth}px`;
          document.body.appendChild(ghost);
          try {
            li.setPointerCapture(ev.pointerId);
          } catch (_) {
            /* ignore */
          }
        }
        ghost.style.transform = `translate(${ev.clientX - 40}px, ${ev.clientY - 20}px)`;
        const el = document.elementFromPoint(ev.clientX, ev.clientY);
        const card = el && el.closest(".time-card");
        grade.querySelectorAll(".time-card").forEach((c) => {
          c.classList.toggle("drop-alvo", card === c && String(c.dataset.timeId) !== String(timeOrigem));
        });
      };

      const onUp = async (ev) => {
        li.removeEventListener("pointermove", onMove);
        li.removeEventListener("pointerup", onUp);
        li.removeEventListener("pointercancel", onUp);
        if (ghost) {
          ghost.remove();
          ghost = null;
        }
        li.classList.remove("arrastando");
        grade.querySelectorAll(".time-card").forEach((c) => c.classList.remove("drop-alvo"));

        if (!moved) return;
        const el = document.elementFromPoint(ev.clientX, ev.clientY);
        const card = el && el.closest(".time-card");
        const destinoId = card ? card.dataset.timeId : null;
        const jId = arrastandoId;
        arrastandoId = null;
        origemId = null;
        if (!destinoId || String(destinoId) === String(timeOrigem)) return;
        try {
          await moverJogadorParaTime(jId, destinoId);
        } catch (err) {
          toast(err.message);
        }
      };

      li.addEventListener("pointermove", onMove);
      li.addEventListener("pointerup", onUp);
      li.addEventListener("pointercancel", onUp);
    });
  });

  grade.querySelectorAll(".time-card").forEach((card) => {
    card.addEventListener("dragover", (e) => {
      e.preventDefault();
      card.classList.add("drop-alvo");
    });
    card.addEventListener("dragleave", () => card.classList.remove("drop-alvo"));
    card.addEventListener("drop", async (e) => {
      e.preventDefault();
      card.classList.remove("drop-alvo");
      const jogadorId = e.dataTransfer.getData("text/plain") || arrastandoId;
      const destinoId = card.dataset.timeId;
      if (!jogadorId || !destinoId || String(destinoId) === String(origemId)) return;
      try {
        await moverJogadorParaTime(jogadorId, destinoId);
      } catch (err) {
        toast(err.message);
      }
    });
  });
}

function renderPartida(partida) {
  estado.partidaAtual = partida;
  LocalJogo.atualizarPartida(partida);
  document.getElementById("nome-time-a").textContent = partida.timeA.nome;
  document.getElementById("nome-time-b").textContent = partida.timeB.nome;
  document.getElementById("gols-a").textContent = partida.golsTimeA;
  document.getElementById("gols-b").textContent = partida.golsTimeB;
  document.getElementById("lado-a").style.color = partida.timeA.cor;
  document.getElementById("lado-b").style.color = partida.timeB.cor;
  document.getElementById("texto-rodada").textContent = `Rodada ${partida.numeroRodada}`;

  const lista = document.getElementById("lista-eventos");
  if (!partida.eventos || !partida.eventos.length) {
    lista.innerHTML = `<li><span>Sem eventos ainda</span><span class="meta">marque gol ou cartão</span></li>`;
    return;
  }

  // Limita a lista na tela para não pesar em 15+ rodadas com muitos lances
  const eventos = [...partida.eventos].reverse();
  const MAX_EVT = 30;
  const visiveis = eventos.slice(0, MAX_EVT);
  const omitidos = eventos.length - visiveis.length;

  lista.innerHTML =
    visiveis
      .map((e) => {
        let texto = "";
        if (e.tipo === "GOL") {
          const ass = e.assistenciaNome ? ` · assist. ${e.assistenciaNome}` : "";
          texto = `Gol de ${e.jogadorNome} (${e.timeNome})${ass} · GK ${e.goleiroNome || "?"}`;
        } else if (e.tipo === "GOL_CONTRA") {
          texto = `Gol contra de ${e.jogadorNome} (${e.timeNome})`;
        } else if (e.tipo === "CARTAO_AMARELO") {
          texto = `Amarelo para ${e.jogadorNome}`;
        } else {
          texto = `Vermelho para ${e.jogadorNome}`;
        }
        return `<li><span>${texto}</span><span class="meta">${e.tipo.replaceAll("_", " ")}</span></li>`;
      })
      .join("") +
    (omitidos > 0
      ? `<li><span class="meta">+ ${omitidos} evento(s) anteriores</span><span></span></li>`
      : "");
}

function atualizarStatusSync() {
  /* status de sync removido da UI — jogo fica limpo */
}

let syncTimerSuave = null;
function agendarSyncSuave() {
  return;
}

function renderClassificacao(times, destinoId) {
  const ordenados = [...times].sort((a, b) => {
    if (b.pontos !== a.pontos) return b.pontos - a.pontos;
    const sgB = b.golsPro - b.golsContra;
    const sgA = a.golsPro - a.golsContra;
    if (sgB !== sgA) return sgB - sgA;
    return b.golsPro - a.golsPro;
  });

  const rows = ordenados.map((t, i) => {
    const jogos = t.vitorias + t.empates + t.derrotas;
    const sg = t.golsPro - t.golsContra;
    const apr = jogos === 0 ? 0 : Math.round(((t.pontos * 100) / (jogos * 3)) * 10) / 10;
    return {
      posicao: i + 1,
      nome: t.nome,
      cor: t.cor,
      pontos: t.pontos,
      jogos,
      vitorias: t.vitorias,
      empates: t.empates,
      derrotas: t.derrotas,
      golsPro: t.golsPro,
      golsContra: t.golsContra,
      saldo: sg,
      aproveitamento: apr,
    };
  });

  document.getElementById(destinoId).innerHTML = `
    <h3 class="lista-titulo" style="margin-top:0">Classificação</h3>
    ${tabelaBrasileirao(rows)}
  `;
}

/* ---------- ações ---------- */

async function carregarCadastro() {
  const todos = LocalJogo.listarJogadores();
  renderListasCadastro(todos);
  return todos;
}

async function sortearTimes() {
  LocalJogo.sortearTimesLocal();
  const times = LocalJogo.listarTimes();
  estado.goleiros = LocalJogo.listarGoleiros();
  renderTimes(times);
  mostrarTela("tela-times");
  const comGk = times.filter((t) => t.goleiro).length;
  toast(
    comGk
      ? `Sorteado! ${comGk} goleiro(s) nos primeiros times`
      : "Times sorteados! Sem goleiros cadastrados"
  );
}

async function renomearTime(timeId) {
  const time = estado.times.find((t) => String(t.id) === String(timeId));
  const novo = await pedirTexto("Nome do time", time ? time.nome : "");
  if (novo === null) return;

  LocalJogo.atualizarTimeLocal(timeId, {
    nome: novo,
    usarNomeAutomatico: novo === "",
  });
  const times = LocalJogo.listarTimes();
  renderTimes(times);
  const atualizado = times.find((t) => String(t.id) === String(timeId));
  toast(atualizado?.nomeManual ? "Nome atualizado" : "Nome automático (mais estrelas)");
}

async function trocarGoleiroTime(timeId) {
  const goleiros = LocalJogo.listarGoleiros();
  if (!goleiros.length) {
    toast("Cadastre goleiros antes");
    return;
  }

  const opcoes = goleiros.map((g) => ({
    id: g.id,
    label: g.timeId ? `${g.nome} (time ${String(g.timeId) === String(timeId) ? "deste" : "outro"})` : `${g.nome} (livre)`,
  }));

  const goleiroId = await escolherOpcao("Goleiro deste time", opcoes);
  if (!goleiroId) return;

  LocalJogo.atualizarTimeLocal(timeId, { goleiroId });
  const times = LocalJogo.listarTimes();
  renderTimes(times);
  toast("Goleiro definido (pode ser emprestado)");
}

async function iniciarPartidaComEscolha() {
  // Garante que nenhum spinner atrapalha a escolha
  loadingCount = 0;
  document.getElementById("loading-overlay")?.classList.add("oculto");

  let times = estado.times.length ? estado.times : [];
  if (times.length < 2) {
    times = LocalJogo.listarTimes();
  }
  estado.times = times;

  if (!times || times.length < 2) {
    toast("Precisa de pelo menos 2 times");
    return;
  }

  // Sempre pergunta Time A e Time B (2, 3 ou 4 times)
  const timeAId = await escolherOpcao(
    "Quem joga? Time A",
    times.map((t) => ({ id: t.id, label: t.nome })),
    { layout: "grade" }
  );
  if (!timeAId) return;

  const restantes = times.filter((t) => String(t.id) !== String(timeAId));
  const timeBId = await escolherOpcao(
    "Quem joga? Time B",
    restantes.map((t) => ({ id: t.id, label: t.nome })),
    { layout: "grade" }
  );
  if (!timeBId) return;

  const partida = LocalJogo.iniciarPartidaLocal(timeAId, timeBId);
  renderPartida(partida);
  mostrarTela("tela-partida");
}

function ordenarPorEstrelasAsc(jogadores) {
  return [...(jogadores || [])].sort((a, b) => {
    const ea = Number(a.estrelas) || 0;
    const eb = Number(b.estrelas) || 0;
    if (ea !== eb) return ea - eb;
    return String(a.nome || "").localeCompare(String(b.nome || ""), "pt-BR");
  });
}

/** Linha + goleiros do time (para marcar gol também com GK). */
function elencoDoTimeParaLance(partida, timeId) {
  const linha =
    (String(timeId) === String(partida.timeA.id)
      ? partida.jogadoresTimeA || partida.timeA.jogadores
      : partida.jogadoresTimeB || partida.timeB.jogadores) || [];
  const gks = (partida.goleirosPelada || [])
    .filter((g) => String(g.timeId) === String(timeId))
    .map((g) => ({ ...g, goleiro: true }));
  const ids = new Set(linha.map((j) => j.id));
  const extras = gks.filter((g) => !ids.has(g.id));
  return ordenarPorEstrelasAsc([
    ...linha.map((j) => ({ ...j, goleiro: !!j.goleiro })),
    ...extras,
  ]);
}

function opcoesJogadoresLance(jogadores) {
  return ordenarPorEstrelasAsc(jogadores).map((j) => ({
    id: j.id,
    label: j.goleiro
      ? `${j.nome} (goleiro)`
      : `${j.nome} · ${Number(j.estrelas) || 0}★`,
    goleiro: !!j.goleiro,
  }));
}

async function registrarEventoAoVivo(tipo) {
  const partida = estado.partidaAtual;
  if (!partida) return;

  let timeId;
  let jogadorId;
  let goleiroId = null;
  let goleiroNome = null;
  let assistenciaId = null;
  let assistenciaNome = null;
  let jogadoresDoTime = [];

  if (tipo === "GOL_CONTRA") {
    timeId = await escolherOpcao(
      "Time que sofreu o gol contra?",
      [
        { id: partida.timeA.id, label: partida.timeA.nome },
        { id: partida.timeB.id, label: partida.timeB.nome },
      ],
      { layout: "grade" }
    );
    if (!timeId) return;

    jogadoresDoTime = elencoDoTimeParaLance(partida, timeId);

    jogadorId = await escolherOpcao(
      "Quem fez o gol contra?",
      opcoesJogadoresLance(jogadoresDoTime)
    );
    if (!jogadorId) return;
  } else {
    timeId = await escolherOpcao(
      "Qual time?",
      [
        { id: partida.timeA.id, label: partida.timeA.nome },
        { id: partida.timeB.id, label: partida.timeB.nome },
      ],
      { layout: "grade" }
    );
    if (!timeId) return;

    jogadoresDoTime = elencoDoTimeParaLance(partida, timeId);

    jogadorId = await escolherOpcao(
      tipo === "GOL" ? "Quem fez o gol?" : "Qual jogador?",
      opcoesJogadoresLance(jogadoresDoTime)
    );
    if (!jogadorId) return;

    if (tipo === "GOL") {
      const colegas = jogadoresDoTime.filter((j) => String(j.id) !== String(jogadorId));
      const opcoesAssist = [
        { id: "__sem__", label: "Sem assistência" },
        ...opcoesJogadoresLance(colegas),
      ];
      const assistEscolhida = await escolherOpcao("Quem deu a assistência?", opcoesAssist);
      if (!assistEscolhida) return;
      if (String(assistEscolhida) !== "__sem__") {
        assistenciaId = assistEscolhida;
        assistenciaNome = (colegas.find((j) => String(j.id) === String(assistenciaId)) || {}).nome || null;
      }

      const timeDefensorId =
        String(timeId) === String(partida.timeA.id) ? partida.timeB.id : partida.timeA.id;
      const goleiros = partida.goleirosPelada || [];

      if (!goleiros.length) {
        toast("Cadastre goleiros para marcar o gol");
        return;
      }

      const ordenados = [...goleiros].sort((a, b) => {
        const aDoTime = String(a.timeId) === String(timeDefensorId) ? 0 : 1;
        const bDoTime = String(b.timeId) === String(timeDefensorId) ? 0 : 1;
        return aDoTime - bDoTime;
      });

      goleiroId = await escolherOpcao(
        "Goleiro que sofreu?",
        ordenados.map((g) => ({
          id: g.id,
          label: g.nome,
        }))
      );
      if (!goleiroId) return;
      goleiroNome = (ordenados.find((g) => String(g.id) === String(goleiroId)) || {}).nome;
    }
  }

  const contexto = {
    tipo,
    timeId,
    jogadorId,
    goleiroId,
    goleiroNome,
    assistenciaId,
    assistenciaNome,
    jogadoresDoTime,
  };

  // Jogo no celular: placar na hora — sync só ao encerrar a pelada
  const clientLanceId = LocalJogo.novoClientLanceId();
  aplicarLanceLocal(partida.id, { ...contexto, clientLanceId });
  toast(tipo === "GOL" ? "Gol!" : tipo === "GOL_CONTRA" ? "Gol contra!" : "Cartão registrado");
}

function aplicarLanceLocal(partidaId, contexto) {
  const base = estado.partidaAtual;
  if (!base || String(base.id) !== String(partidaId)) return;

  const jogador = (contexto.jogadoresDoTime || []).find((j) => String(j.id) === String(contexto.jogadorId))
    || { id: contexto.jogadorId, nome: "Jogador" };
  const time = contexto.timeId && String(contexto.timeId) === String(base.timeA.id) ? base.timeA : base.timeB;
  const goleiro = (base.goleirosPelada || []).find((g) => String(g.id) === String(contexto.goleiroId)) || null;
  const assistencia = (contexto.jogadoresDoTime || []).find((j) => String(j.id) === String(contexto.assistenciaId))
    || (contexto.assistenciaId
      ? { id: contexto.assistenciaId, nome: contexto.assistenciaNome || "Assistência" }
      : null);
  const timeNome =
    String(contexto.timeId) === String(base.timeA.id) ? base.timeA.nome : base.timeB.nome;

  // Já existe este lance local? não soma de novo
  if (
    contexto.clientLanceId &&
    (base.eventos || []).some((e) => e.clientLanceId === contexto.clientLanceId)
  ) {
    return;
  }

  const atualizada = {
    ...base,
    golsTimeA: base.golsTimeA,
    golsTimeB: base.golsTimeB,
    eventos: [...(base.eventos || [])],
  };

  if (contexto.tipo === "GOL") {
    if (String(contexto.timeId) === String(base.timeA.id)) atualizada.golsTimeA += 1;
    else atualizada.golsTimeB += 1;
  } else if (contexto.tipo === "GOL_CONTRA") {
    if (String(contexto.timeId) === String(base.timeA.id)) atualizada.golsTimeB += 1;
    else atualizada.golsTimeA += 1;
  }

  atualizada.eventos.push({
    id: contexto.clientLanceId || `local-${Date.now()}`,
    clientLanceId: contexto.clientLanceId || null,
    _local: true,
    tipo: contexto.tipo,
    jogador,
    time,
    goleiro,
    assistencia,
    timeId: contexto.timeId,
    timeNome,
    jogadorId: contexto.jogadorId,
    jogadorNome: jogador.nome || "Jogador",
    goleiroId: contexto.goleiroId || null,
    goleiroNome: contexto.goleiroNome || null,
    assistenciaId: contexto.assistenciaId || null,
    assistenciaNome: contexto.assistenciaNome || null,
  });

  // Só no celular — sync só ao finalizar rodada / encerrar
  renderPartida(atualizada);
}

let sincronizandoJogo = false;

async function sincronizarJogoEmBackground() {
  return;
}

function somaJogosTimes(times) {
  return (times || []).reduce(
    (acc, t) => acc + (Number(t.vitorias) || 0) + (Number(t.empates) || 0) + (Number(t.derrotas) || 0),
    0
  );
}

async function finalizarPartidaAtual() {
  if (!estado.partidaAtual) return;
  const partida = estado.partidaAtual;

  // Classificação local na hora
  const timesLocais = aplicarResultadoLocalNosTimes(estado.times, partida);
  estado.partidaAtual = null;
  if (timesLocais.length) {
    estado.times = timesLocais;
    renderClassificacao(timesLocais, "tabela-classificacao");
  }
  LocalJogo.finalizarPartidaLocal(partida, timesLocais);

  mostrarTela("tela-classificacao");
  toast("Rodada finalizada");

  carregarPainelCorrecao().catch(() => {});
  carregarObservacoes("lista-observacoes", "atraso-jogador").catch(() => {});
}

/** Aplica 3/1/0 e gols da partida atual nos times em memória (para a tela não depender da API). */
function aplicarResultadoLocalNosTimes(times, partida) {
  if (!Array.isArray(times) || !times.length || !partida?.timeA || !partida?.timeB) {
    return Array.isArray(times) ? times : [];
  }

  const golsA = Number(partida.golsTimeA) || 0;
  const golsB = Number(partida.golsTimeB) || 0;

  return times.map((t) => {
    const copia = { ...t };
    if (String(t.id) === String(partida.timeA.id)) {
      copia.golsPro = (t.golsPro || 0) + golsA;
      copia.golsContra = (t.golsContra || 0) + golsB;
      if (golsA > golsB) {
        copia.pontos = (t.pontos || 0) + 3;
        copia.vitorias = (t.vitorias || 0) + 1;
      } else if (golsA === golsB) {
        copia.pontos = (t.pontos || 0) + 1;
        copia.empates = (t.empates || 0) + 1;
      } else {
        copia.derrotas = (t.derrotas || 0) + 1;
      }
    } else if (String(t.id) === String(partida.timeB.id)) {
      copia.golsPro = (t.golsPro || 0) + golsB;
      copia.golsContra = (t.golsContra || 0) + golsA;
      if (golsB > golsA) {
        copia.pontos = (t.pontos || 0) + 3;
        copia.vitorias = (t.vitorias || 0) + 1;
      } else if (golsA === golsB) {
        copia.pontos = (t.pontos || 0) + 1;
        copia.empates = (t.empates || 0) + 1;
      } else {
        copia.derrotas = (t.derrotas || 0) + 1;
      }
    }
    return copia;
  });
}

async function irParaClassificacao() {
  const times = LocalJogo.listarTimes();
  estado.times = times;
  renderClassificacao(times, "tabela-classificacao");
  await carregarPainelCorrecao();
  await carregarObservacoes("lista-observacoes", "atraso-jogador");
  mostrarTela("tela-classificacao");
}

async function carregarPainelCorrecao() {
  const lista = document.getElementById("lista-partidas-corrigir");
  if (!lista) return;
  const partidas = LocalJogo.obter()?.rodadasFinalizadas || [];
  const ordenadas = [...(partidas || [])].sort((a, b) => a.numeroRodada - b.numeroRodada);
  if (!ordenadas.length) {
    lista.innerHTML = `<li><span>Nenhuma partida ainda</span><span class="meta">—</span></li>`;
    return;
  }
  lista.innerHTML = ordenadas
    .map(
      (p) => `
    <li>
      <span>${String(p.numeroRodada).padStart(2, "0")}ª · ${p.timeA.nome} ${p.golsTimeA} x ${p.golsTimeB} ${p.timeB.nome}</span>
      <span class="meta-acoes">
        <span class="meta">${p.status === "EM_ANDAMENTO" ? "aberta" : "ok"}</span>
        <button type="button" class="btn-apagar" data-cancelar-partida="${p.id}" aria-label="Cancelar partida ${p.numeroRodada}">Cancelar</button>
      </span>
    </li>`
    )
    .join("");
}

async function cancelarPartidaPorId(partidaId) {
  const ok = confirm("Cancelar esta partida? Placar, gols, cartões e pontos serão desfeitos.");
  if (!ok) return;
  LocalJogo.cancelarPartidaLocal(partidaId);
  if (estado.partidaAtual && String(estado.partidaAtual.id) === String(partidaId)) {
    estado.partidaAtual = null;
  }
  await irParaClassificacao();
  toast("Partida cancelada");
}

async function desfazerUltimoEvento() {
  if (!estado.partidaAtual) return;
  const ok = confirm("Desfazer o último gol/cartão?");
  if (!ok) return;

  const base = estado.partidaAtual;
  const eventos = [...(base.eventos || [])];
  if (!eventos.length) {
    toast("Nada para desfazer");
    return;
  }

  const ultimo = eventos[eventos.length - 1];
  eventos.pop();

  let golsA = base.golsTimeA;
  let golsB = base.golsTimeB;
  if (ultimo.tipo === "GOL") {
    if (String(ultimo.timeId) === String(base.timeA.id)) golsA = Math.max(0, golsA - 1);
    else golsB = Math.max(0, golsB - 1);
  } else if (ultimo.tipo === "GOL_CONTRA") {
    if (String(ultimo.timeId) === String(base.timeA.id)) golsB = Math.max(0, golsB - 1);
    else golsA = Math.max(0, golsA - 1);
  }

  renderPartida({ ...base, eventos, golsTimeA: golsA, golsTimeB: golsB });

  if (ultimo._local) {
    const pendentes = LocalJogo.listarLancesPendentes();
    const match = [...pendentes].reverse().find(
      (l) =>
        l.partidaId === base.id &&
        l.payload.tipo === ultimo.tipo &&
        l.payload.jogadorId === ultimo.jogadorId &&
        l.payload.timeId === ultimo.timeId
    );
    if (match) LocalJogo.removerLancePendente(match.id);
    atualizarStatusSync();
    toast("Desfeito");
    return;
  }

  try {
    const atualizada = await PeladaAPI.desfazerUltimoEvento(base.id);
    renderPartida(atualizada);
    toast("Último toque desfeito");
  } catch (_) {
    toast("Desfeito na tela — se voltar no servidor, ajuste depois");
  }
}

async function cancelarPartidaAtual() {
  if (!estado.partidaAtual) return;
  await cancelarPartidaPorId(estado.partidaAtual.id);
}

async function carregarObservacoes(listaId, selectId) {
  const lista = document.getElementById(listaId);
  const select = document.getElementById(selectId);
  const jogoLocal = LocalJogo.temJogoLocal();
  const jogadores = jogoLocal
    ? LocalJogo.listarJogadores()
    : await PeladaAPI.listarJogadores(estado.peladaId);
  const observacoes = jogoLocal
    ? LocalJogo.listarObservacoes()
    : await PeladaAPI.listarObservacoes(estado.peladaId);

  if (select) {
    select.innerHTML = jogadores
      .map((j) => `<option value="${j.id}">${j.nome}${j.goleiro ? " (GK)" : ""}</option>`)
      .join("");
  }

  if (lista) {
    if (!observacoes.length) {
      lista.innerHTML = `<li><span>Nenhuma observação</span><span class="meta">—</span></li>`;
    } else {
      lista.innerHTML = observacoes
        .map((o) => {
          const hora = o.horario ? ` às ${o.horario}` : "";
          const extra = o.texto ? ` — ${o.texto}` : "";
          return `
        <li>
          <span>${o.tipo === "ATRASO" ? "Atraso" : o.tipo}: ${o.jogadorNome}${hora}${extra}</span>
          <button type="button" class="btn-apagar" data-obs-id="${o.id}">Apagar</button>
        </li>`;
        })
        .join("");
    }
  }
}

async function salvarAtraso(sufixo = "") {
  const jogadorId = document.getElementById(`atraso-jogador${sufixo}`).value;
  const horario = document.getElementById(`atraso-horario${sufixo}`).value;
  const texto = document.getElementById(`atraso-texto${sufixo}`).value.trim();
  if (!jogadorId) {
    toast("Escolha o jogador");
    return;
  }
  if (!horario && !texto) {
    toast("Informe o horário ou uma nota");
    return;
  }
  if (LocalJogo.temJogoLocal()) {
    const jogador = LocalJogo.listarJogadores().find((j) => String(j.id) === String(jogadorId));
    LocalJogo.adicionarObservacaoLocal({
      jogadorId,
      jogadorNome: jogador?.nome || "Jogador",
      tipo: "ATRASO",
      horario: horario || null,
      texto: texto || null,
    });
  } else {
    await PeladaAPI.adicionarObservacao(estado.peladaId, {
      jogadorId,
      tipo: "ATRASO",
      horario: horario || null,
      texto: texto || null,
    });
  }
  document.getElementById(`atraso-horario${sufixo}`).value = "";
  document.getElementById(`atraso-texto${sufixo}`).value = "";
  toast("Atraso registrado");

  await carregarObservacoes(
    sufixo === "-fim" ? null : "lista-observacoes",
    sufixo === "-fim" ? "atraso-jogador-fim" : "atraso-jogador"
  );
  if (sufixo === "-fim" && !LocalJogo.temJogoLocal()) {
    const resumo = await PeladaAPI.resumo(estado.peladaId);
    estado.resumoAtual = resumo;
    renderResumoOficial(resumo);
  }
}

async function encerrarPelada() {
  const ok = confirm("Encerrar a pelada agora? Tudo será enviado à sua conta (histórico + súmula).");
  if (!ok) return;
  if (estado.partidaAtual) {
    toast("Finalize ou saia da partida aberta antes de encerrar");
    return;
  }
  await comLoading(async () => {
    const local = LocalJogo.obter();
    let peladaId = estado.peladaId || local?.peladaId;
    if (!peladaId) {
      const criada = await PeladaAPI.criar({
        nome: local?.nome || "Pelada Oficial",
        quantidadeTimes: local?.quantidadeTimes || 2,
        importarElenco: false,
      });
      peladaId = criada.id;
      estado.peladaId = peladaId;
    }
    const payload = LocalJogo.montarPayloadSync();
    const resumo = await PeladaAPI.sincronizarCompleta(peladaId, payload);
    localStorage.setItem("pelada_ultima_id", String(peladaId));
    LocalJogo.limpar();
    estado.resumoAtual = resumo;
    estado.sumulaManual = false;
    estado.ultimaPelada = {
      id: peladaId,
      nome: resumo?.pelada?.nome || "Pelada Oficial",
      status: "ENCERRADA",
      encerradaEm: resumo?.pelada?.encerradaEm,
    };
    const boxAtraso = document.getElementById("box-atraso-fim");
    if (boxAtraso) boxAtraso.classList.remove("oculto");
    renderResumoOficial(resumo);
    await carregarObservacoes(null, "atraso-jogador-fim");
    mostrarTela("tela-fim");
  }, "Enviando pelada e gerando súmula...");
  toast("Pelada encerrada");
}

/* ---------- eventos ---------- */

function atualizarUserBar() {
  const bar = document.getElementById("user-bar");
  const usuario = getUsuario();
  if (!usuario) {
    bar.classList.add("oculto");
    return;
  }
  bar.classList.remove("oculto");
  document.getElementById("user-nome").textContent = usuario.nome;
}

async function entrarNaHome() {
  atualizarUserBar();
  mostrarTela("tela-inicio");
  sincronizarApaguesPendentes().catch(() => {});
  const box = document.getElementById("box-continuar");
  const boxHistorico = document.getElementById("box-historico-recente");
  const listaHome = document.getElementById("lista-historico-home");
  if (box) box.classList.add("oculto");
  if (boxHistorico) boxHistorico.classList.add("oculto");

  configurarCliqueHistorico(listaHome);
  configurarCliqueHistorico(document.getElementById("lista-historico-completo"));

  const local = LocalJogo.obter();
  const temLocal = LocalJogo.temJogoLocal();
  let idAtiva = null;

  try {
    const ativa = await PeladaAPI.ativa();
    if (ativa && ativa.id) {
      estado.peladaAtiva = ativa;
      estado.ultimaPelada = ativa;
      idAtiva = ativa.id;
      if (box) {
        document.querySelector("#box-continuar .continuar-txt").textContent =
          "Você tem uma pelada em andamento.";
        box.classList.remove("oculto");
      }
    } else {
      estado.peladaAtiva = null;
    }
  } catch (_) {
    /* API oscilando */
  }

  if (temLocal && box) {
    box.classList.remove("oculto");
    document.querySelector("#box-continuar .continuar-txt").textContent =
      "Você tem uma pelada salva neste celular.";
    if (local.peladaId) idAtiva = local.peladaId;
  }

  const peladas = await carregarHistoricoPeladas();
  const recentes = peladasParaHistoricoHome(idAtiva);

  if (recentes.length && boxHistorico && listaHome) {
    renderHistoricoLista(listaHome, recentes, 5, { mostrarApagar: true });
    boxHistorico.classList.remove("oculto");
  }
}

async function retomarPelada(pelada) {
  estado.peladaId = pelada.id;
  localStorage.setItem(PELADA_KEY, String(pelada.id));

  if (tentarRetomarDoCelular(pelada.id)) {
    return;
  }

  if (pelada.status === "AGUARDANDO") {
    await carregarCadastro();
    mostrarTela("tela-jogadores");
    toast("Pelada retomada — cadastro");
    return;
  }

  if (pelada.status === "EM_ANDAMENTO") {
    let times = [];
    try {
      times = await PeladaAPI.listarTimes(estado.peladaId);
      estado.times = times;
    } catch (_) {
      /* segue tentando partidas */
    }

    let partidas = [];
    try {
      partidas = await PeladaAPI.listarPartidas(estado.peladaId);
    } catch (_) {
      partidas = [];
    }

    const aberta = (partidas || []).find((p) => p.status === "EM_ANDAMENTO");
    if (aberta) {
      try {
        const completa = await PeladaAPI.buscarPartida(aberta.id);
        renderPartida(completa);
        mostrarTela("tela-partida");
        toast("Partida retomada!");
        return;
      } catch (_) {
        // Placar resumido ainda abre a tela; usuário pode atualizar tocando de novo
        renderPartida({
          ...aberta,
          eventos: [],
          jogadoresTimeA: [],
          jogadoresTimeB: [],
          goleirosPelada: [],
        });
        mostrarTela("tela-partida");
        toast("Partida aberta — se faltar detalhe, toque Continuar de novo");
        return;
      }
    }
    if ((partidas || []).length) {
      try {
        await irParaClassificacao();
        toast("Pelada retomada — classificação");
        return;
      } catch (_) {
        /* cai nos times */
      }
    }
    if (times.length) {
      renderTimes(times);
      mostrarTela("tela-times");
      toast("Pelada retomada — times");
      return;
    }
    throw new Error("Conexão oscilou. Toque de novo em Continuar.");
  }

  if (pelada.status === "ENCERRADA") {
    const resumo = await PeladaAPI.resumo(estado.peladaId);
    estado.resumoAtual = resumo;
    renderResumoOficial(resumo);
    await carregarObservacoes(null, "atraso-jogador-fim");
    mostrarTela("tela-fim");
    return;
  }

  mostrarTela("tela-inicio");
}

/** Abre a pelada usando o payload único de /ativa/retomar (mais estável no celular). */
async function aplicarRetomada(payload) {
  const pelada = payload?.pelada;
  if (!pelada || !pelada.id) {
    throw new Error("Nenhuma pelada ativa");
  }

  estado.peladaId = pelada.id;
  estado.peladaAtiva = pelada;
  localStorage.setItem(PELADA_KEY, String(pelada.id));

  // Preferência: o que está salvo neste celular (jogo local-first)
  if (tentarRetomarDoCelular(pelada.id)) {
    return;
  }

  if (pelada.status === "AGUARDANDO") {
    await carregarCadastro();
    mostrarTela("tela-jogadores");
    toast("Pelada retomada — cadastro");
    return;
  }

  if (pelada.status === "EM_ANDAMENTO") {
    // Classificação local manda se tiver mais rodadas que o payload do servidor
    if (Array.isArray(payload.times)) {
      const local = LocalJogo.obter();
      const timesLocais = local?.times || estado.times || [];
      if (somaJogosTimes(timesLocais) >= somaJogosTimes(payload.times)) {
        estado.times = timesLocais.length ? timesLocais : payload.times;
      } else {
        estado.times = payload.times;
        LocalJogo.salvarTimes(payload.times);
      }
    }

    if (payload.partidaAberta && payload.partidaAberta.id) {
      const local = LocalJogo.obter();
      if (
        local?.partida &&
        local.partida.id === payload.partidaAberta.id &&
        (local.partida.golsTimeA || 0) + (local.partida.golsTimeB || 0) >
          (payload.partidaAberta.golsTimeA || 0) + (payload.partidaAberta.golsTimeB || 0)
      ) {
        renderPartida(local.partida);
      } else {
        renderPartida(payload.partidaAberta);
      }
      mostrarTela("tela-partida");
      toast("Partida retomada!");
      return;
    }

    const partidas = payload.partidas || [];
    if (partidas.length || somaJogosTimes(estado.times) > 0) {
      if (estado.times.length) {
        renderClassificacao(estado.times, "tabela-classificacao");
        mostrarTela("tela-classificacao");
      } else {
        await irParaClassificacao();
      }
      toast("Pelada retomada — classificação");
      return;
    }

    if ((estado.times || []).length) {
      renderTimes(estado.times);
      mostrarTela("tela-times");
      toast("Pelada retomada — times");
      return;
    }
  }

  await retomarPelada(pelada);
}

/** Retoma placar/partida salvos neste navegador (mesmo se a API estiver oscilando). */
function tentarRetomarDoCelular(peladaId) {
  const local = LocalJogo.obter();
  if (!local || String(local.peladaId) !== String(peladaId)) return false;

  estado.peladaId = local.peladaId;
  if (Array.isArray(local.times) && local.times.length) {
    estado.times = local.times;
  }

  // Partida ainda aberta neste celular
  if (local.partida && local.partida.status !== "FINALIZADA" && local.partida.timeA) {
    renderPartida(local.partida);
    mostrarTela("tela-partida");
    toast("Partida retomada");
    return true;
  }

  // Já finalizou localmente → classificação local (não espera servidor)
  if (
    (local.rodadasFinalizadas || []).length ||
    (local.times && local.times.length && somaJogosTimes(local.times) > 0)
  ) {
    if (estado.times.length) {
      renderClassificacao(estado.times, "tabela-classificacao");
      mostrarTela("tela-classificacao");
      toast("Classificação retomada");
      return true;
    }
  }

  if (local.status === "AGUARDANDO" || (local.jogadores || []).length) {
    renderListasCadastro(local.jogadores);
    mostrarTela("tela-jogadores");
    toast("Cadastro retomado");
    return true;
  }

  return false;
}

async function bootAuth() {
  if (!getToken() || !getUsuario()) {
    limparSessao();
    mostrarTela("tela-auth");
    atualizarUserBar();
    return;
  }

  // Já tem login salvo — mantém sessão mesmo se a API estiver acordando
  atualizarUserBar();
  try {
    await PeladaAPI.ativa();
    await entrarNaHome();
  } catch (err) {
    if (!getToken()) {
      mostrarTela("tela-auth");
      atualizarUserBar();
      toast(err.message || "Faça login para continuar");
      return;
    }
    toast(err.message || "Servidor acordando… tente Continuar de novo");
    await entrarNaHome();
  }
}

/* ---------- eventos auth ---------- */

document.querySelectorAll(".auth-tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".auth-tab").forEach((t) => t.classList.remove("ativa"));
    tab.classList.add("ativa");
    const modo = tab.dataset.auth;
    document.getElementById("form-login").classList.toggle("oculto", modo !== "login");
    document.getElementById("form-cadastro").classList.toggle("oculto", modo !== "cadastro");
  });
});

document.querySelectorAll(".btn-olho").forEach((btn) => {
  btn.addEventListener("click", () => {
    const input = document.getElementById(btn.dataset.senha);
    if (!input) return;
    const mostrar = input.type === "password";
    input.type = mostrar ? "text" : "password";
    btn.setAttribute("aria-pressed", mostrar ? "true" : "false");
    btn.setAttribute("aria-label", mostrar ? "Ocultar senha" : "Mostrar senha");
    btn.title = mostrar ? "Ocultar senha" : "Mostrar senha";
  });
});

document.getElementById("form-login").addEventListener("submit", async (e) => {
  e.preventDefault();
  try {
    await comLoading(async () => {
      const data = await AuthAPI.login({
        email: document.getElementById("login-email").value.trim(),
        senha: document.getElementById("login-senha").value,
      });
      salvarSessao(data.token, data.usuario);
      toast(`Olá, ${data.usuario.nome}!`);
      await entrarNaHome();
    }, "Entrando...");
  } catch (err) {
    toast(err.message);
  }
});

document.getElementById("form-cadastro").addEventListener("submit", async (e) => {
  e.preventDefault();
  try {
    await comLoading(async () => {
      const data = await AuthAPI.cadastro({
        nome: document.getElementById("cadastro-nome").value.trim(),
        email: document.getElementById("cadastro-email").value.trim(),
        senha: document.getElementById("cadastro-senha").value,
      });
      salvarSessao(data.token, data.usuario);
      toast("Conta criada!");
      await entrarNaHome();
    }, "Criando conta...");
  } catch (err) {
    toast(err.message);
  }
});

function sairConta() {
  limparSessao();
  estado.peladaId = null;
  estado.times = [];
  estado.partidaAtual = null;
  estado.resumoAtual = null;
  estado.peladaAtiva = null;
  atualizarUserBar();
  mostrarTela("tela-auth");
  toast("Você saiu");
}

document.getElementById("cfg-sair")?.addEventListener("click", sairConta);

document.getElementById("btn-continuar").addEventListener("click", async () => {
  const btn = document.getElementById("btn-continuar");
  btn.disabled = true;
  try {
    await comLoading(async () => {
      const local = LocalJogo.obter();
      if (local?.peladaId && tentarRetomarDoCelular(local.peladaId)) {
        return;
      }

      let ultimoErro = null;
      for (let t = 1; t <= 3; t++) {
        try {
          let payload = null;
          try {
            payload = await PeladaAPI.retomar();
          } catch (_) {
            payload = null;
          }

          if (payload && payload.pelada && payload.pelada.id) {
            await aplicarRetomada(payload);
            return;
          }

          const ativa = await PeladaAPI.ativa();
          if (!ativa || !ativa.id) {
            toast("Nenhuma pelada ativa");
            document.getElementById("box-continuar").classList.add("oculto");
            return;
          }
          estado.peladaAtiva = ativa;
          await retomarPelada(ativa);
          return;
        } catch (err) {
          ultimoErro = err;
          if (!getToken()) throw err;
          if (t < 3) await new Promise((r) => setTimeout(r, 1200 * t));
        }
      }
      throw ultimoErro || new Error("Não deu para continuar. Espere e tente de novo.");
    }, "Abrindo pelada...");
  } catch (err) {
    toast(err.message || "Não deu para continuar");
  } finally {
    btn.disabled = false;
  }
});

document.getElementById("btn-config")?.addEventListener("click", () => {
  const ativa = document.querySelector(".tela.ativa");
  estado.telaAntesConfig = ativa?.id || "tela-inicio";
  ConfigApp.sincronizarTelaConfig();
  mostrarTela("tela-configuracoes");
});

document.getElementById("btn-voltar-config")?.addEventListener("click", () => {
  mostrarTela(estado.telaAntesConfig || "tela-inicio");
});

document.querySelectorAll("[data-tema-opt]").forEach((btn) => {
  btn.addEventListener("click", () => {
    ConfigApp.definirTema(btn.dataset.temaOpt);
    toast("Tema atualizado");
  });
});

document.getElementById("btn-salvar-prefs")?.addEventListener("click", () => {
  const nome = document.getElementById("cfg-nome-pelada")?.value?.trim();
  const qtd = parseInt(document.getElementById("cfg-qtd-times")?.value, 10);
  ConfigApp.salvarPrefs({
    nomePelada: nome || "Pelada Oficial",
    qtdTimes: Number.isFinite(qtd) ? qtd : 2,
  });
  toast("Padrões salvos");
});

async function abrirHistoricoCompleto(origem) {
  estado.telaAntesHistorico = origem || "tela-inicio";
  try {
    await comLoading(async () => {
      const peladas = await carregarHistoricoPeladas();
      renderHistoricoLista(document.getElementById("lista-historico-completo"), peladas);
      mostrarTela("tela-historico");
    }, "Carregando histórico...");
  } catch (err) {
    toast(err.message);
  }
}

document.getElementById("cfg-historico")?.addEventListener("click", () => {
  abrirHistoricoCompleto("tela-configuracoes");
});

document.getElementById("cfg-sumula")?.addEventListener("click", () => {
  estado.telaAntesSumula = "tela-configuracoes";
  abrirTelaSumulaManual();
});

document.getElementById("btn-ver-historico")?.addEventListener("click", () => {
  abrirHistoricoCompleto("tela-inicio");
});

document.getElementById("btn-voltar-historico")?.addEventListener("click", () => {
  mostrarTela(estado.telaAntesHistorico || "tela-inicio");
});

montarSeletorEstrelas();
ConfigApp.init();
bootAuth();
setTimeout(() => sincronizarApaguesPendentes().catch(() => {}), 2500);
document.getElementById("form-nova-pelada").addEventListener("submit", async (e) => {
  e.preventDefault();
  try {
    await comLoading(async () => {
      const pelada = await PeladaAPI.criar({
        nome: document.getElementById("nome-pelada").value.trim(),
        quantidadeTimes: Number(document.getElementById("qtd-times").value),
        importarElenco: false,
      });
      estado.peladaId = pelada.id;
      localStorage.setItem(PELADA_KEY, String(pelada.id));
      let jogadores = [];
      try {
        const elenco = await PeladaAPI.listarElenco();
        jogadores = (Array.isArray(elenco) ? elenco : elenco?.jogadores || []).map((j) => ({
          nome: j.nome,
          estrelas: j.estrelas,
          goleiro: !!j.goleiro,
          apto: j.apto !== false,
        }));
      } catch (_) {
        /* elenco é opcional: o cadastro segue local */
      }
      LocalJogo.iniciarPeladaLocal({
        peladaId: pelada.id,
        nome: pelada.nome || document.getElementById("nome-pelada").value.trim(),
        quantidadeTimes: Number(document.getElementById("qtd-times").value),
        jogadores,
      });
      const todos = await carregarCadastro();
      mostrarTela("tela-jogadores");
      if (todos.length) {
        toast(`Elenco carregado no celular: ${todos.length} pessoa(s)`);
      } else {
        toast("Pelada criada — cadastre no celular e envie ao encerrar");
      }
    }, "Criando pelada...");
  } catch (err) {
    toast(err.message);
  }
});

document.getElementById("form-jogador").addEventListener("submit", async (e) => {
  e.preventDefault();
  try {
    LocalJogo.adicionarJogador({
      nome: document.getElementById("nome-jogador").value.trim(),
      estrelas: estado.estrelasSelecionadas,
      goleiro: false,
    });
    document.getElementById("nome-jogador").value = "";
    await carregarCadastro();
    toast("Jogador adicionado");
  } catch (err) {
    toast(err.message);
  }
});

document.getElementById("form-goleiro").addEventListener("submit", async (e) => {
  e.preventDefault();
  try {
    LocalJogo.adicionarJogador({
      nome: document.getElementById("nome-goleiro").value.trim(),
      goleiro: true,
    });
    document.getElementById("nome-goleiro").value = "";
    await carregarCadastro();
    toast("Goleiro adicionado");
  } catch (err) {
    toast(err.message);
  }
});

document.getElementById("lista-jogadores").addEventListener("click", async (e) => {
  const aptoBtn = e.target.closest("[data-apto-id]");
  if (aptoBtn) {
    try {
      await alternarApto(aptoBtn.dataset.aptoId, aptoBtn.dataset.apto === "true");
    } catch (err) {
      toast(err.message);
    }
    return;
  }
  const editar = e.target.closest("[data-editar-id]");
  if (editar) {
    try {
      await editarJogador(editar.dataset.editarId);
    } catch (err) {
      toast(err.message);
    }
    return;
  }
  const btn = e.target.closest("[data-apagar-id]");
  if (!btn) return;
  try {
    await apagarJogador(btn.dataset.apagarId);
  } catch (err) {
    toast(err.message);
  }
});

document.getElementById("lista-goleiros").addEventListener("click", async (e) => {
  const aptoBtn = e.target.closest("[data-apto-id]");
  if (aptoBtn) {
    try {
      await alternarApto(aptoBtn.dataset.aptoId, aptoBtn.dataset.apto === "true");
    } catch (err) {
      toast(err.message);
    }
    return;
  }
  const editar = e.target.closest("[data-editar-id]");
  if (editar) {
    try {
      await editarJogador(editar.dataset.editarId);
    } catch (err) {
      toast(err.message);
    }
    return;
  }
  const btn = e.target.closest("[data-apagar-id]");
  if (!btn) return;
  try {
    await apagarJogador(btn.dataset.apagarId);
  } catch (err) {
    toast(err.message);
  }
});

document.getElementById("btn-voltar-jogadores").addEventListener("click", async () => {
  try {
    await carregarCadastro();
    mostrarTela("tela-jogadores");
    toast("Pode editar, apagar ou marcar inapto — depois sorteie de novo");
  } catch (err) {
    toast(err.message);
  }
});

document.getElementById("btn-voltar-inicio-jogadores")?.addEventListener("click", async () => {
  toast("Pelada continua salva — use Continuar na home");
  await entrarNaHome();
});

async function voltarDaPartidaComSeguranca() {
  const partida = estado.partidaAtual;
  const eventos = partida?.eventos || [];
  const gols = (Number(partida?.golsTimeA) || 0) + (Number(partida?.golsTimeB) || 0);
  const temLance = eventos.length > 0 || gols > 0;

  if (temLance) {
    const ok = confirm(
      "Sair cancela esta partida em andamento (placar e cartões desta rodada).\n\nAs rodadas já finalizadas ficam salvas."
    );
    if (!ok) return;
  }

  await comLoading(async () => {
    if (partida?.id) {
      if (String(partida.id).startsWith("lp-") || partida._local) {
        LocalJogo.cancelarPartidaLocal(partida.id);
      } else {
        await PeladaAPI.cancelarPartida(partida.id);
      }
      estado.partidaAtual = null;
    }

    const finalizadas = LocalJogo.obter()?.rodadasFinalizadas || [];

    if (finalizadas.length) {
      await irParaClassificacao();
      toast("Voltou à classificação");
    } else {
      const times = LocalJogo.listarTimes();
      estado.times = times;
      renderTimes(times);
      mostrarTela("tela-times");
      toast("Voltou aos times");
    }
  }, "Saindo da partida...");
}

document.getElementById("btn-voltar-partida")?.addEventListener("click", async () => {
  try {
    await voltarDaPartidaComSeguranca();
  } catch (err) {
    toast(err.message || "Não deu para sair da partida");
  }
});

document.getElementById("btn-voltar-times-class")?.addEventListener("click", async () => {
  try {
    const times = LocalJogo.listarTimes();
    estado.times = times;
    renderTimes(times);
    mostrarTela("tela-times");
  } catch (err) {
    toast(err.message);
  }
});

document.getElementById("btn-voltar-inicio-fim")?.addEventListener("click", async () => {
  await entrarNaHome();
});

document.getElementById("btn-sortear").addEventListener("click", async () => {
  try {
    await comLoading(() => sortearTimes(), "Sorteando times...");
  } catch (err) {
    toast(err.message);
  }
});

document.getElementById("btn-re-sortear").addEventListener("click", async () => {
  try {
    await comLoading(() => sortearTimes(), "Sorteando de novo...");
  } catch (err) {
    toast(err.message);
  }
});

document.getElementById("grade-times").addEventListener("click", async (e) => {
  const btn = e.target.closest("[data-acao]");
  if (!btn) return;
  const timeId = btn.dataset.timeId;
  try {
    if (btn.dataset.acao === "renomear") await renomearTime(timeId);
    if (btn.dataset.acao === "goleiro") await trocarGoleiroTime(timeId);
    if (btn.dataset.acao === "mover") {
      await escolherTimeParaMover(btn.dataset.jogadorId, btn.dataset.timeOrigem);
    }
  } catch (err) {
    toast(err.message);
  }
});

document.getElementById("btn-ir-partida").addEventListener("click", async () => {
  try {
    await iniciarPartidaComEscolha();
  } catch (err) {
    toast(err.message);
  }
});

document.querySelectorAll(".acoes-evento [data-evento]").forEach((btn) => {
  btn.addEventListener("click", async () => {
    if (btn.disabled) return;
    const botoes = [...document.querySelectorAll(".acoes-evento [data-evento]")];
    botoes.forEach((b) => {
      b.disabled = true;
    });
    try {
      await registrarEventoAoVivo(btn.dataset.evento);
    } catch (err) {
      toast(err.message);
    } finally {
      botoes.forEach((b) => {
        b.disabled = false;
      });
    }
  });
});

document.getElementById("btn-finalizar-partida").addEventListener("click", async () => {
  const btn = document.getElementById("btn-finalizar-partida");
  if (btn.disabled) return;
  btn.disabled = true;
  try {
    await finalizarPartidaAtual();
  } catch (err) {
    toast(err.message);
  } finally {
    btn.disabled = false;
  }
});

document.getElementById("btn-desfazer-evento").addEventListener("click", async () => {
  try {
    await desfazerUltimoEvento();
  } catch (err) {
    toast(err.message);
  }
});

document.getElementById("btn-cancelar-partida-atual").addEventListener("click", async () => {
  try {
    await cancelarPartidaAtual();
  } catch (err) {
    toast(err.message);
  }
});

document.getElementById("lista-partidas-corrigir").addEventListener("click", async (e) => {
  const btn = e.target.closest("[data-cancelar-partida]");
  if (!btn) return;
  try {
    await cancelarPartidaPorId(btn.dataset.cancelarPartida);
  } catch (err) {
    toast(err.message);
  }
});

document.getElementById("btn-salvar-atraso").addEventListener("click", async () => {
  try {
    await salvarAtraso("");
  } catch (err) {
    toast(err.message);
  }
});

document.getElementById("btn-salvar-atraso-fim").addEventListener("click", async () => {
  try {
    await salvarAtraso("-fim");
  } catch (err) {
    toast(err.message);
  }
});

document.getElementById("lista-observacoes").addEventListener("click", async (e) => {
  const btn = e.target.closest("[data-obs-id]");
  if (!btn) return;
  try {
    LocalJogo.removerObservacaoLocal(btn.dataset.obsId);
    await carregarObservacoes("lista-observacoes", "atraso-jogador");
    toast("Observação removida");
  } catch (err) {
    toast(err.message);
  }
});

document.getElementById("btn-nova-rodada").addEventListener("click", async () => {
  try {
    await iniciarPartidaComEscolha();
  } catch (err) {
    toast(err.message || "Não deu para abrir a partida — tente de novo");
  }
});

document.getElementById("btn-encerrar-pelada").addEventListener("click", async () => {
  try {
    await encerrarPelada();
  } catch (err) {
    toast(err.message);
  }
});

document.getElementById("btn-encerrar-pelada-2").addEventListener("click", async () => {
  try {
    await encerrarPelada();
  } catch (err) {
    toast(err.message);
  }
});

document.getElementById("btn-nova-pelada").addEventListener("click", async () => {
  localStorage.removeItem(PELADA_KEY);
  estado.peladaId = null;
  estado.times = [];
  estado.goleiros = [];
  estado.partidaAtual = null;
  estado.resumoAtual = null;
  const eraManual = estado.sumulaManual;
  estado.sumulaManual = false;
  const boxAtraso = document.getElementById("box-atraso-fim");
  if (boxAtraso) boxAtraso.classList.remove("oculto");
  if (eraManual && !getUsuario()) {
    mostrarTela("tela-auth");
    return;
  }
  await entrarNaHome();
});

document.getElementById("btn-pdf")?.addEventListener("click", async () => {
  try {
    await baixarPdfResumo();
  } catch (err) {
    toast(err.message || "Não foi possível gerar o PDF");
  }
});

function abrirTelaSumulaManual() {
  estado.telaAntesSumula = estado.telaAntesSumula || "tela-inicio";
  const ta = document.getElementById("texto-sumula-manual");
  if (ta && !ta.value.trim()) ta.value = EXEMPLO_SUMULA;
  mostrarTela("tela-sumula-manual");
}

function gerarSumulaManualAgora() {
  try {
    const texto = document.getElementById("texto-sumula-manual").value;
    const resumo = montarResumoDeTexto(texto);
    estado.resumoAtual = resumo;
    estado.sumulaManual = true;
    const boxAtraso = document.getElementById("box-atraso-fim");
    if (boxAtraso) boxAtraso.classList.add("oculto");
    renderResumoOficial(resumo);
    mostrarTela("tela-fim");
    toast("Súmula pronta — PDF, planilha ou WhatsApp");
  } catch (err) {
    toast(err.message || "Não deu para ler o texto");
  }
}

document.getElementById("btn-gerar-sumula-auth")?.addEventListener("click", () => {
  estado.telaAntesSumula = "tela-auth";
  abrirTelaSumulaManual();
});
document.getElementById("btn-sumula-voltar")?.addEventListener("click", () => {
  mostrarTela(estado.telaAntesSumula || "tela-inicio");
});
document.getElementById("btn-sumula-exemplo")?.addEventListener("click", () => {
  document.getElementById("texto-sumula-manual").value = EXEMPLO_SUMULA;
  toast("Exemplo da pelada de 20/07 carregado");
});
document.getElementById("btn-sumula-gerar")?.addEventListener("click", gerarSumulaManualAgora);

document.getElementById("modal-fechar").addEventListener("click", cancelarModalPendente);
document.getElementById("modal-fundo").addEventListener("click", cancelarModalPendente);

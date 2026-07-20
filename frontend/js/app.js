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
  estrelasSelecionadas: 5,
  times: [],
  goleiros: [],
  partidaAtual: null,
  resumoAtual: null,
};

function mostrarTela(id) {
  document.querySelectorAll(".tela").forEach((tela) => tela.classList.remove("ativa"));
  document.getElementById(id).classList.add("ativa");

  const titulos = {
    "tela-auth": "Entre para salvar sua pelada",
    "tela-inicio": "Controle da pelada no celular",
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

function abrirModal(titulo, corpoHtml) {
  document.getElementById("modal-titulo").textContent = titulo;
  document.getElementById("modal-corpo").innerHTML = corpoHtml;
  document.getElementById("modal").classList.remove("oculto");
}

function fecharModal() {
  document.getElementById("modal").classList.add("oculto");
  document.getElementById("modal-corpo").innerHTML = "";
}

function escolherOpcao(titulo, opcoes) {
  return new Promise((resolve) => {
    if (!opcoes.length) {
      toast("Nenhuma opção disponível");
      resolve(null);
      return;
    }
    const html = `
      <div class="opcoes">
        ${opcoes
          .map((o) => `<button type="button" class="opcao" data-id="${o.id}">${o.label}</button>`)
          .join("")}
      </div>
    `;
    abrirModal(titulo, html);

    const corpo = document.getElementById("modal-corpo");
    const onClick = (e) => {
      const btn = e.target.closest(".opcao");
      if (!btn) return;
      corpo.removeEventListener("click", onClick);
      fecharModal();
      resolve(Number(btn.dataset.id));
    };
    corpo.addEventListener("click", onClick);

    const onCancel = () => {
      fecharModal();
      resolve(null);
    };
    document.getElementById("modal-fechar").addEventListener("click", onCancel, { once: true });
    document.getElementById("modal-fundo").addEventListener("click", onCancel, { once: true });
  });
}

function pedirTexto(titulo, valorInicial = "") {
  return new Promise((resolve) => {
    abrirModal(
      titulo,
      `<input type="text" id="modal-input" maxlength="40" value="${valorInicial.replace(/"/g, "&quot;")}" />
       <button type="button" class="btn btn-principal" id="modal-ok">Salvar</button>
       <p class="dica-modal">Deixe vazio para usar o jogador com mais estrelas.</p>`
    );
    const input = document.getElementById("modal-input");
    input.focus();
    const ok = () => {
      fecharModal();
      resolve(input.value.trim());
    };
    document.getElementById("modal-ok").addEventListener("click", ok, { once: true });
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
  await PeladaAPI.atualizarJogador(estado.peladaId, jogadorId, { apto: !aptoAtual });
  await carregarCadastro();
  toast(!aptoAtual ? "Marcado como apto" : "Marcado como inapto (fora do sorteio)");
}

async function apagarJogador(jogadorId) {
  const ok = confirm("Apagar esta pessoa da lista?");
  if (!ok) return;
  await PeladaAPI.removerJogador(estado.peladaId, jogadorId);
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
  const todos = await PeladaAPI.listarJogadores(estado.peladaId);
  const jogador = todos.find((j) => j.id === jogadorId);
  if (!jogador) {
    toast("Jogador não encontrado");
    return;
  }

  const dados = await pedirEdicaoJogador(jogador);
  if (!dados) return;

  await PeladaAPI.atualizarJogador(estado.peladaId, jogadorId, dados);
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
  const times = await PeladaAPI.moverJogador(estado.peladaId, jogadorId, timeDestinoId);
  renderTimes(times);
  toast("Jogador movido");
}

async function escolherTimeParaMover(jogadorId, timeOrigemId) {
  const destinos = estado.times.filter((t) => t.id !== timeOrigemId);
  if (!destinos.length) {
    toast("Só há um time");
    return;
  }
  const timeId = await escolherOpcao(
    "Mover para qual time?",
    destinos.map((t) => ({ id: t.id, label: `${t.nome} (${t.totalEstrelas}★)` }))
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
      arrastandoId = Number(li.dataset.jogadorId);
      origemId = Number(li.dataset.timeOrigem);
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

      const jogadorId = Number(li.dataset.jogadorId);
      const timeOrigem = Number(li.dataset.timeOrigem);
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
          c.classList.toggle("drop-alvo", card === c && Number(c.dataset.timeId) !== timeOrigem);
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
        const destinoId = card ? Number(card.dataset.timeId) : null;
        const jId = arrastandoId;
        arrastandoId = null;
        origemId = null;
        if (!destinoId || destinoId === timeOrigem) return;
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
      const jogadorId = Number(e.dataTransfer.getData("text/plain") || arrastandoId);
      const destinoId = Number(card.dataset.timeId);
      if (!jogadorId || !destinoId || destinoId === origemId) return;
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
  if (estado.peladaId) {
    LocalJogo.salvarPartida(estado.peladaId, partida, estado.times);
  } else {
    LocalJogo.atualizarPartida(partida);
  }
  document.getElementById("nome-time-a").textContent = partida.timeA.nome;
  document.getElementById("nome-time-b").textContent = partida.timeB.nome;
  document.getElementById("gols-a").textContent = partida.golsTimeA;
  document.getElementById("gols-b").textContent = partida.golsTimeB;
  document.getElementById("lado-a").style.color = partida.timeA.cor;
  document.getElementById("lado-b").style.color = partida.timeB.cor;
  document.getElementById("texto-rodada").textContent = `Rodada ${partida.numeroRodada}`;
  atualizarStatusSync();

  const lista = document.getElementById("lista-eventos");
  if (!partida.eventos || !partida.eventos.length) {
    lista.innerHTML = `<li><span>Sem eventos ainda</span><span class="meta">marque gol ou cartão</span></li>`;
    return;
  }

  lista.innerHTML = [...partida.eventos]
    .reverse()
    .map((e) => {
      let texto = "";
      if (e.tipo === "GOL") {
        texto = `Gol de ${e.jogadorNome} (${e.timeNome}) · GK ${e.goleiroNome || "?"}`;
      } else if (e.tipo === "GOL_CONTRA") {
        texto = `Gol contra de ${e.jogadorNome} (${e.timeNome})`;
      } else if (e.tipo === "CARTAO_AMARELO") {
        texto = `Amarelo para ${e.jogadorNome}`;
      } else {
        texto = `Vermelho para ${e.jogadorNome}`;
      }
      const meta = e._local ? "no celular" : e.tipo.replaceAll("_", " ");
      return `<li><span>${texto}</span><span class="meta">${meta}</span></li>`;
    })
    .join("");
}

function atualizarStatusSync() {
  const el = document.getElementById("sync-status");
  if (!el) return;
  const qtd = LocalJogo.qtdPendentes();
  el.classList.remove("pendente", "ok");
  if (qtd > 0) {
    el.textContent = `${qtd} item(ns) aguardando sync · pode fechar e voltar neste celular`;
    el.classList.add("pendente");
  } else {
    el.textContent = "Jogo neste celular · tudo sincronizado (ou sem pendências)";
    el.classList.add("ok");
  }
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
  const todos = await PeladaAPI.listarJogadores(estado.peladaId);
  renderListasCadastro(todos);
  return todos;
}

async function sortearTimes() {
  const times = await PeladaAPI.sortear(estado.peladaId);
  estado.goleiros = await PeladaAPI.listarGoleiros(estado.peladaId);
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
  const time = estado.times.find((t) => t.id === timeId);
  const novo = await pedirTexto("Nome do time", time ? time.nome : "");
  if (novo === null) return;

  const atualizado = await PeladaAPI.atualizarTime(estado.peladaId, timeId, {
    nome: novo,
    usarNomeAutomatico: novo === "",
  });
  const times = await PeladaAPI.listarTimes(estado.peladaId);
  renderTimes(times);
  toast(atualizado.nomeManual ? "Nome atualizado" : "Nome automático (mais estrelas)");
}

async function trocarGoleiroTime(timeId) {
  const goleiros = await PeladaAPI.listarGoleiros(estado.peladaId);
  if (!goleiros.length) {
    toast("Cadastre goleiros antes");
    return;
  }

  const opcoes = goleiros.map((g) => ({
    id: g.id,
    label: g.timeId ? `${g.nome} (time ${g.timeId === timeId ? "deste" : "outro"})` : `${g.nome} (livre)`,
  }));

  const goleiroId = await escolherOpcao("Goleiro deste time", opcoes);
  if (!goleiroId) return;

  await PeladaAPI.atualizarTime(estado.peladaId, timeId, { goleiroId });
  const times = await PeladaAPI.listarTimes(estado.peladaId);
  renderTimes(times);
  toast("Goleiro definido (pode ser emprestado)");
}

async function iniciarPartidaComEscolha() {
  const times = estado.times.length ? estado.times : await PeladaAPI.listarTimes(estado.peladaId);
  estado.times = times;

  if (times.length < 2) {
    toast("Precisa de pelo menos 2 times");
    return;
  }

  let timeAId = times[0].id;
  let timeBId = times[1].id;

  if (times.length > 2) {
    timeAId = await escolherOpcao(
      "Time A",
      times.map((t) => ({ id: t.id, label: t.nome }))
    );
    if (!timeAId) return;

    const restantes = times.filter((t) => t.id !== timeAId);
    timeBId = await escolherOpcao(
      "Time B",
      restantes.map((t) => ({ id: t.id, label: t.nome }))
    );
    if (!timeBId) return;
  }

  const partida = await PeladaAPI.iniciarPartida(estado.peladaId, { timeAId, timeBId });
  renderPartida(partida);
  mostrarTela("tela-partida");
}

async function registrarEventoAoVivo(tipo) {
  const partida = estado.partidaAtual;
  if (!partida) return;

  let timeId;
  let jogadorId;
  let goleiroId = null;
  let goleiroNome = null;
  let jogadoresDoTime = [];

  if (tipo === "GOL_CONTRA") {
    timeId = await escolherOpcao("Time que sofreu o gol contra?", [
      { id: partida.timeA.id, label: partida.timeA.nome },
      { id: partida.timeB.id, label: partida.timeB.nome },
    ]);
    if (!timeId) return;

    jogadoresDoTime =
      timeId === partida.timeA.id ? partida.jogadoresTimeA : partida.jogadoresTimeB;

    jogadorId = await escolherOpcao(
      "Quem fez o gol contra?",
      jogadoresDoTime.map((j) => ({ id: j.id, label: j.nome }))
    );
    if (!jogadorId) return;
  } else {
    timeId = await escolherOpcao("Qual time?", [
      { id: partida.timeA.id, label: partida.timeA.nome },
      { id: partida.timeB.id, label: partida.timeB.nome },
    ]);
    if (!timeId) return;

    jogadoresDoTime =
      timeId === partida.timeA.id ? partida.jogadoresTimeA : partida.jogadoresTimeB;

    jogadorId = await escolherOpcao(
      tipo === "GOL" ? "Quem fez o gol?" : "Qual jogador?",
      jogadoresDoTime.map((j) => ({ id: j.id, label: j.nome }))
    );
    if (!jogadorId) return;

    if (tipo === "GOL") {
      const timeDefensorId = timeId === partida.timeA.id ? partida.timeB.id : partida.timeA.id;
      const goleiros = partida.goleirosPelada || [];

      if (!goleiros.length) {
        toast("Cadastre goleiros para marcar o gol");
        return;
      }

      const ordenados = [...goleiros].sort((a, b) => {
        const aDoTime = a.timeId === timeDefensorId ? 0 : 1;
        const bDoTime = b.timeId === timeDefensorId ? 0 : 1;
        return aDoTime - bDoTime;
      });

      goleiroId = await escolherOpcao(
        "Goleiro que sofreu? (pode emprestar)",
        ordenados.map((g) => ({
          id: g.id,
          label:
            g.timeId === timeDefensorId
              ? `${g.nome} (do time)`
              : g.timeId
                ? `${g.nome} (emprestado)`
                : `${g.nome} (livre)`,
        }))
      );
      if (!goleiroId) return;
      goleiroNome = (ordenados.find((g) => g.id === goleiroId) || {}).nome;
    }
  }

  const contexto = {
    tipo,
    timeId,
    jogadorId,
    goleiroId,
    goleiroNome,
    jogadoresDoTime,
  };

  // Jogo no celular: placar na hora, sync depois (não trava a partida)
  const clientLanceId = LocalJogo.novoClientLanceId();
  aplicarLanceLocal(partida.id, { ...contexto, clientLanceId });
  LocalJogo.enfileirarLance(
    partida.id,
    { tipo, timeId, jogadorId, goleiroId, clientLanceId },
    { tipo, timeId, jogadorId, goleiroId, goleiroNome, clientLanceId }
  );
  atualizarStatusSync();
  toast(tipo === "GOL" ? "Gol!" : tipo === "GOL_CONTRA" ? "Gol contra!" : "Cartão registrado");
  sincronizarJogoEmBackground();
}

function aplicarLanceLocal(partidaId, contexto) {
  const base = estado.partidaAtual;
  if (!base || base.id !== partidaId) return;

  const jogador = (contexto.jogadoresDoTime || []).find((j) => j.id === contexto.jogadorId)
    || { id: contexto.jogadorId, nome: "Jogador" };
  const timeNome =
    contexto.timeId === base.timeA.id ? base.timeA.nome : base.timeB.nome;

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
    if (contexto.timeId === base.timeA.id) atualizada.golsTimeA += 1;
    else atualizada.golsTimeB += 1;
  } else if (contexto.tipo === "GOL_CONTRA") {
    if (contexto.timeId === base.timeA.id) atualizada.golsTimeB += 1;
    else atualizada.golsTimeA += 1;
  }

  atualizada.eventos.push({
    id: contexto.clientLanceId || `local-${Date.now()}`,
    clientLanceId: contexto.clientLanceId || null,
    _local: true,
    tipo: contexto.tipo,
    timeId: contexto.timeId,
    timeNome,
    jogadorId: contexto.jogadorId,
    jogadorNome: jogador.nome || "Jogador",
    goleiroId: contexto.goleiroId || null,
    goleiroNome: contexto.goleiroNome || null,
  });

  renderPartida(atualizada);
}

let sincronizandoJogo = false;

async function sincronizarJogoEmBackground() {
  if (sincronizandoJogo) return;
  if (!getToken()) return;
  sincronizandoJogo = true;
  try {
    for (;;) {
      const pendentes = LocalJogo.listarLancesPendentes();
      if (!pendentes.length) break;
      const item = pendentes[0];
      if (!item.payload?.clientLanceId) {
        // Fila antiga sem id — descarta para não duplicar
        LocalJogo.removerLancePendente(item.id);
        continue;
      }
      try {
        await PeladaAPI.registrarEvento(item.partidaId, item.payload);
        LocalJogo.removerLancePendente(item.id);
        if (estado.partidaAtual && estado.partidaAtual.id === item.partidaId) {
          const p = {
            ...estado.partidaAtual,
            eventos: (estado.partidaAtual.eventos || []).map((e) =>
              e.clientLanceId === item.payload.clientLanceId ? { ...e, _local: false } : e
            ),
          };
          renderPartida(p);
        }
        atualizarStatusSync();
      } catch (_) {
        const tentativas = LocalJogo.registrarTentativa(item.id);
        if (tentativas >= 8) {
          // Para de martelar o mesmo lance (já deve estar no servidor ou falhou de verdade)
          LocalJogo.removerLancePendente(item.id);
          toast("Um lance ficou sem sync — confira o placar no Continuar");
          atualizarStatusSync();
          break;
        }
        await new Promise((r) => setTimeout(r, 3000 * Math.min(tentativas, 3)));
        break; // sai e tenta de novo mais tarde (evita loop infinito agora)
      }
    }

    if (LocalJogo.temFinalizarPendente()) {
      const snap = LocalJogo.obter();
      const partidaId = snap?.partida?.id;
      if (partidaId) {
        try {
          const resultado = await PeladaAPI.finalizarPartida(partidaId);
          LocalJogo.marcarFinalizarPendente(false);
          if (resultado?.times?.length) {
            estado.times = resultado.times;
            LocalJogo.salvarTimes(resultado.times);
            renderClassificacao(resultado.times, "tabela-classificacao");
          }
          LocalJogo.limpar();
          atualizarStatusSync();
        } catch (err) {
          const msg = String(err.message || "").toLowerCase();
          if (msg.includes("finalizada")) {
            LocalJogo.marcarFinalizarPendente(false);
            LocalJogo.limpar();
          }
        }
      }
    }
  } finally {
    sincronizandoJogo = false;
    atualizarStatusSync();
  }
}

async function finalizarPartidaAtual() {
  if (!estado.partidaAtual) return;
  const partida = estado.partidaAtual;
  const partidaId = partida.id;

  // Classificação na hora (celular)
  const timesLocais = aplicarResultadoLocalNosTimes(estado.times, partida);
  estado.partidaAtual = null;
  if (timesLocais.length) {
    estado.times = timesLocais;
    LocalJogo.salvarTimes(timesLocais);
    renderClassificacao(timesLocais, "tabela-classificacao");
  }
  LocalJogo.marcarFinalizarPendente(true);
  // Mantém snapshot da partida finalizada localmente até sync
  const snap = LocalJogo.obter();
  if (snap) {
    snap.partida = { ...partida, status: "FINALIZADA" };
    localStorage.setItem("pelada_jogo_local_v1", JSON.stringify(snap));
  }
  mostrarTela("tela-classificacao");
  atualizarStatusSync();
  toast("Partida finalizada neste celular");

  // Sync em segundo plano (não trava)
  sincronizarJogoEmBackground().then(() => {
    carregarPainelCorrecao().catch(() => {});
    carregarObservacoes("lista-observacoes", "atraso-jogador").catch(() => {});
  });
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
    if (t.id === partida.timeA.id) {
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
    } else if (t.id === partida.timeB.id) {
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
  const times = await PeladaAPI.listarTimes(estado.peladaId);
  estado.times = times;
  renderClassificacao(times, "tabela-classificacao");
  await carregarPainelCorrecao();
  await carregarObservacoes("lista-observacoes", "atraso-jogador");
  mostrarTela("tela-classificacao");
}

async function carregarPainelCorrecao() {
  const lista = document.getElementById("lista-partidas-corrigir");
  if (!lista) return;
  const partidas = await PeladaAPI.listarPartidas(estado.peladaId);
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
  await PeladaAPI.cancelarPartida(partidaId);
  if (estado.partidaAtual && estado.partidaAtual.id === partidaId) {
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
    if (ultimo.timeId === base.timeA.id) golsA = Math.max(0, golsA - 1);
    else golsB = Math.max(0, golsB - 1);
  } else if (ultimo.tipo === "GOL_CONTRA") {
    if (ultimo.timeId === base.timeA.id) golsB = Math.max(0, golsB - 1);
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
    toast("Desfeito neste celular");
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
  const jogadores = await PeladaAPI.listarJogadores(estado.peladaId);
  const observacoes = await PeladaAPI.listarObservacoes(estado.peladaId);

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
  const jogadorId = Number(document.getElementById(`atraso-jogador${sufixo}`).value);
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
  await PeladaAPI.adicionarObservacao(estado.peladaId, {
    jogadorId,
    tipo: "ATRASO",
    horario: horario || null,
    texto: texto || null,
  });
  document.getElementById(`atraso-horario${sufixo}`).value = "";
  document.getElementById(`atraso-texto${sufixo}`).value = "";
  toast("Atraso registrado");

  if (sufixo === "-fim") {
    const resumo = await PeladaAPI.resumo(estado.peladaId);
    estado.resumoAtual = resumo;
    renderResumoOficial(resumo);
    await carregarObservacoes(null, "atraso-jogador-fim");
  } else {
    await carregarObservacoes("lista-observacoes", "atraso-jogador");
  }
}

async function encerrarPelada() {
  const ok = confirm("Encerrar a pelada agora? Nomes e estrelas serão salvos para a próxima.");
  if (!ok) return;
  // Tenta sync pendente antes de encerrar
  await sincronizarJogoEmBackground();
  const resumo = await PeladaAPI.encerrar(estado.peladaId);
  LocalJogo.limpar();
  estado.resumoAtual = resumo;
  renderResumoOficial(resumo);
  await carregarObservacoes(null, "atraso-jogador-fim");
  mostrarTela("tela-fim");
  toast("Pelada encerrada · elenco salvo na conta");
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
  const box = document.getElementById("box-continuar");
  try {
    const ativa = await PeladaAPI.ativa();
    if (ativa && ativa.id) {
      estado.peladaAtiva = ativa;
      box.classList.remove("oculto");
      return;
    }
    estado.peladaAtiva = null;
  } catch (_) {
    /* API oscilando */
  }

  // Se tem jogo salvo no celular, ainda mostra Continuar
  const local = LocalJogo.obter();
  if (local?.peladaId && (local.partida || local.finalizarPendente)) {
    box.classList.remove("oculto");
  } else {
    box.classList.add("oculto");
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
    if (Array.isArray(payload.times)) {
      estado.times = payload.times;
    }

    if (payload.partidaAberta && payload.partidaAberta.id) {
      renderPartida(payload.partidaAberta);
      mostrarTela("tela-partida");
      toast("Partida retomada!");
      sincronizarJogoEmBackground();
      return;
    }

    const partidas = payload.partidas || [];
    if (partidas.length) {
      await irParaClassificacao();
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
  if (!local || Number(local.peladaId) !== Number(peladaId)) return false;

  estado.peladaId = peladaId;
  if (Array.isArray(local.times) && local.times.length) {
    estado.times = local.times;
  }

  if (local.finalizarPendente) {
    if (estado.times.length) {
      renderClassificacao(estado.times, "tabela-classificacao");
    }
    mostrarTela("tela-classificacao");
    toast("Retomado deste celular — sync da finalização em andamento");
    sincronizarJogoEmBackground();
    return true;
  }

  if (local.partida && local.partida.status !== "FINALIZADA" && local.partida.timeA) {
    renderPartida(local.partida);
    mostrarTela("tela-partida");
    toast("Partida retomada deste celular");
    sincronizarJogoEmBackground();
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
    const data = await AuthAPI.login({
      email: document.getElementById("login-email").value.trim(),
      senha: document.getElementById("login-senha").value,
    });
    salvarSessao(data.token, data.usuario);
    toast(`Olá, ${data.usuario.nome}!`);
    await entrarNaHome();
  } catch (err) {
    toast(err.message);
  }
});

document.getElementById("form-cadastro").addEventListener("submit", async (e) => {
  e.preventDefault();
  try {
    const data = await AuthAPI.cadastro({
      nome: document.getElementById("cadastro-nome").value.trim(),
      email: document.getElementById("cadastro-email").value.trim(),
      senha: document.getElementById("cadastro-senha").value,
    });
    salvarSessao(data.token, data.usuario);
    toast("Conta criada!");
    await entrarNaHome();
  } catch (err) {
    toast(err.message);
  }
});

document.getElementById("btn-sair").addEventListener("click", () => {
  limparSessao();
  estado.peladaId = null;
  estado.times = [];
  estado.partidaAtual = null;
  estado.resumoAtual = null;
  estado.peladaAtiva = null;
  atualizarUserBar();
  mostrarTela("tela-auth");
  toast("Você saiu");
});

document.getElementById("btn-continuar").addEventListener("click", async () => {
  const btn = document.getElementById("btn-continuar");
  btn.disabled = true;
  try {
    toast("Abrindo pelada…");

    // 1) Abre do celular na hora (mesmo offline / API oscilando)
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
        if (t < 3) {
          toast(`Tentativa ${t}/3… aguarde`);
          await new Promise((r) => setTimeout(r, 1200 * t));
        }
      }
    }
    toast(ultimoErro?.message || "Não deu para continuar. Espere 10s e tente de novo.");
  } finally {
    btn.disabled = false;
  }
});

montarSeletorEstrelas();
bootAuth();
// Continua sync de lances/finalizar salvos neste celular
setTimeout(() => sincronizarJogoEmBackground(), 1200);

document.getElementById("form-nova-pelada").addEventListener("submit", async (e) => {
  e.preventDefault();
  try {
    const pelada = await PeladaAPI.criar({
      nome: document.getElementById("nome-pelada").value.trim(),
      quantidadeTimes: Number(document.getElementById("qtd-times").value),
      importarElenco: true,
    });
    estado.peladaId = pelada.id;
    localStorage.setItem(PELADA_KEY, String(pelada.id));
    const todos = await carregarCadastro();
    mostrarTela("tela-jogadores");
    if (todos.length) {
      toast(`Elenco carregado: ${todos.length} pessoa(s) da última pelada`);
    } else {
      toast("Pelada criada — cadastre os jogadores");
    }
  } catch (err) {
    toast(err.message);
  }
});

document.getElementById("form-jogador").addEventListener("submit", async (e) => {
  e.preventDefault();
  try {
    await PeladaAPI.adicionarJogador(estado.peladaId, {
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
    await PeladaAPI.adicionarJogador(estado.peladaId, {
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
      await alternarApto(Number(aptoBtn.dataset.aptoId), aptoBtn.dataset.apto === "true");
    } catch (err) {
      toast(err.message);
    }
    return;
  }
  const editar = e.target.closest("[data-editar-id]");
  if (editar) {
    try {
      await editarJogador(Number(editar.dataset.editarId));
    } catch (err) {
      toast(err.message);
    }
    return;
  }
  const btn = e.target.closest("[data-apagar-id]");
  if (!btn) return;
  try {
    await apagarJogador(Number(btn.dataset.apagarId));
  } catch (err) {
    toast(err.message);
  }
});

document.getElementById("lista-goleiros").addEventListener("click", async (e) => {
  const aptoBtn = e.target.closest("[data-apto-id]");
  if (aptoBtn) {
    try {
      await alternarApto(Number(aptoBtn.dataset.aptoId), aptoBtn.dataset.apto === "true");
    } catch (err) {
      toast(err.message);
    }
    return;
  }
  const editar = e.target.closest("[data-editar-id]");
  if (editar) {
    try {
      await editarJogador(Number(editar.dataset.editarId));
    } catch (err) {
      toast(err.message);
    }
    return;
  }
  const btn = e.target.closest("[data-apagar-id]");
  if (!btn) return;
  try {
    await apagarJogador(Number(btn.dataset.apagarId));
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

document.getElementById("btn-sortear").addEventListener("click", async () => {
  try {
    await sortearTimes();
  } catch (err) {
    toast(err.message);
  }
});

document.getElementById("btn-re-sortear").addEventListener("click", async () => {
  try {
    await sortearTimes();
  } catch (err) {
    toast(err.message);
  }
});

document.getElementById("grade-times").addEventListener("click", async (e) => {
  const btn = e.target.closest("[data-acao]");
  if (!btn) return;
  const timeId = Number(btn.dataset.timeId);
  try {
    if (btn.dataset.acao === "renomear") await renomearTime(timeId);
    if (btn.dataset.acao === "goleiro") await trocarGoleiroTime(timeId);
    if (btn.dataset.acao === "mover") {
      await escolherTimeParaMover(Number(btn.dataset.jogadorId), Number(btn.dataset.timeOrigem));
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
    await cancelarPartidaPorId(Number(btn.dataset.cancelarPartida));
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
    await PeladaAPI.removerObservacao(estado.peladaId, Number(btn.dataset.obsId));
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
    toast(err.message);
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
  await entrarNaHome();
});

document.getElementById("btn-whatsapp").addEventListener("click", async () => {
  if (!estado.resumoAtual) return;
  try {
    await compartilharWhatsApp(estado.resumoAtual);
  } catch (err) {
    toast(err.message);
  }
});

document.getElementById("btn-pdf").addEventListener("click", async () => {
  try {
    toast("Gerando PDF...");
    await baixarPdfResumo();
  } catch (err) {
    toast(err.message || "Não foi possível gerar o PDF");
  }
});

document.getElementById("btn-compartilhar").addEventListener("click", async () => {
  if (!estado.resumoAtual) return;
  try {
    await compartilharNativo(estado.resumoAtual);
  } catch (err) {
    if (err.name !== "AbortError") toast(err.message);
  }
});

document.getElementById("modal-fechar").addEventListener("click", fecharModal);
document.getElementById("modal-fundo").addEventListener("click", fecharModal);

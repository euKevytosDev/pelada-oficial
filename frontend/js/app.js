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
  estrelasSelecionadas: 5,
  times: [],
  goleiros: [],
  partidaAtual: null,
};

function mostrarTela(id) {
  document.querySelectorAll(".tela").forEach((tela) => tela.classList.remove("ativa"));
  document.getElementById(id).classList.add("ativa");

  const titulos = {
    "tela-inicio": "Controle da pelada no celular",
    "tela-jogadores": "Jogadores e goleiros",
    "tela-times": "Times sorteados",
    "tela-partida": "Partida ao vivo",
    "tela-classificacao": "Classificação",
    "tela-fim": "Resultado final",
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
  const linha = todos.filter((j) => !j.goleiro);
  const goleiros = todos.filter((j) => j.goleiro);
  estado.goleiros = goleiros;

  const listaJ = document.getElementById("lista-jogadores");
  const listaG = document.getElementById("lista-goleiros");

  listaJ.innerHTML = linha.length
    ? linha
        .map(
          (j) => `
      <li>
        <span>${j.nome}</span>
        <span class="meta-acoes">
          <span class="meta">${estrelasTexto(j.estrelas)}</span>
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
      <li>
        <span>${j.nome}</span>
        <span class="meta-acoes">
          <span class="meta">goleiro</span>
          <button type="button" class="btn-apagar" data-apagar-id="${j.id}" aria-label="Apagar ${j.nome}">Apagar</button>
        </span>
      </li>`
        )
        .join("")
    : `<li><span>Nenhum goleiro ainda</span><span class="meta">adicione acima</span></li>`;
}

async function apagarJogador(jogadorId) {
  const ok = confirm("Apagar esta pessoa da lista?");
  if (!ok) return;
  await PeladaAPI.removerJogador(estado.peladaId, jogadorId);
  await carregarCadastro();
  toast("Removido da lista");
}

function renderTimes(times) {
  estado.times = times;
  const comGoleiro = times.filter((t) => t.goleiro).length;
  const semGoleiro = times.length - comGoleiro;
  const grade = document.getElementById("grade-times");
  grade.innerHTML = `
    <p class="dica-times">
      Goleiros no 1º sorteio: vão para os primeiros times
      (ex.: 2 goleiros → Time A e Time B).
      ${semGoleiro > 0 ? `Os ${semGoleiro} sem goleiro emprestam na hora do gol.` : "Todos os times têm goleiro."}
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
        <ul>
          ${t.jogadores
            .map((j) => `<li>${j.nome} <span class="meta">${estrelasTexto(j.estrelas)}</span></li>`)
            .join("")}
        </ul>
      </article>`;
      })
      .join("")}
  `;
}

function renderPartida(partida) {
  estado.partidaAtual = partida;
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

  lista.innerHTML = [...partida.eventos]
    .reverse()
    .map((e) => {
      let texto = "";
      if (e.tipo === "GOL") {
        texto = `Gol de ${e.jogadorNome} (${e.timeNome}) · GK ${e.goleiroNome}`;
      } else if (e.tipo === "GOL_CONTRA") {
        texto = `Gol contra de ${e.jogadorNome} (${e.timeNome})`;
      } else if (e.tipo === "CARTAO_AMARELO") {
        texto = `Amarelo para ${e.jogadorNome}`;
      } else {
        texto = `Vermelho para ${e.jogadorNome}`;
      }
      return `<li><span>${texto}</span><span class="meta">${e.tipo.replaceAll("_", " ")}</span></li>`;
    })
    .join("");
}

function renderClassificacao(times, destinoId) {
  const ordenados = [...times].sort((a, b) => {
    if (b.pontos !== a.pontos) return b.pontos - a.pontos;
    return b.golsPro - b.golsContra - (a.golsPro - a.golsContra);
  });

  document.getElementById(destinoId).innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Time</th>
          <th class="num">P</th>
          <th class="num">V</th>
          <th class="num">E</th>
          <th class="num">D</th>
          <th class="num">GP</th>
        </tr>
      </thead>
      <tbody>
        ${ordenados
          .map(
            (t) => `
          <tr>
            <td><strong style="color:${t.cor}">${t.nome}</strong></td>
            <td class="num">${t.pontos}</td>
            <td class="num">${t.vitorias}</td>
            <td class="num">${t.empates}</td>
            <td class="num">${t.derrotas}</td>
            <td class="num">${t.golsPro}</td>
          </tr>`
          )
          .join("")}
      </tbody>
    </table>
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

  if (tipo === "GOL_CONTRA") {
    // Invertido: escolhe o time que SOFREU, depois o jogador desse time
    const timeId = await escolherOpcao("Time que sofreu o gol contra?", [
      { id: partida.timeA.id, label: partida.timeA.nome },
      { id: partida.timeB.id, label: partida.timeB.nome },
    ]);
    if (!timeId) return;

    const jogadoresDoTime =
      timeId === partida.timeA.id ? partida.jogadoresTimeA : partida.jogadoresTimeB;

    const jogadorId = await escolherOpcao(
      "Quem fez o gol contra?",
      jogadoresDoTime.map((j) => ({ id: j.id, label: j.nome }))
    );
    if (!jogadorId) return;

    await PeladaAPI.registrarEvento(partida.id, { tipo, timeId, jogadorId });
    const atualizada = await PeladaAPI.buscarPartida(partida.id);
    renderPartida(atualizada);
    toast("Gol contra! Placar para o adversário");
    return;
  }

  const timeId = await escolherOpcao("Qual time?", [
    { id: partida.timeA.id, label: partida.timeA.nome },
    { id: partida.timeB.id, label: partida.timeB.nome },
  ]);
  if (!timeId) return;

  const jogadoresDoTime =
    timeId === partida.timeA.id ? partida.jogadoresTimeA : partida.jogadoresTimeB;

  const jogadorId = await escolherOpcao(
    tipo === "GOL" ? "Quem fez o gol?" : "Qual jogador?",
    jogadoresDoTime.map((j) => ({ id: j.id, label: j.nome }))
  );
  if (!jogadorId) return;

  let goleiroId = null;
  if (tipo === "GOL") {
    const timeDefensorId = timeId === partida.timeA.id ? partida.timeB.id : partida.timeA.id;
    const goleiros = partida.goleirosPelada || [];

    if (!goleiros.length) {
      toast("Cadastre goleiros para marcar o gol");
      return;
    }

    // Prioriza goleiro do time defensor; mostra todos (empréstimo)
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
  }

  await PeladaAPI.registrarEvento(partida.id, { tipo, timeId, jogadorId, goleiroId });
  const atualizada = await PeladaAPI.buscarPartida(partida.id);
  renderPartida(atualizada);
  toast(tipo === "GOL" ? "Gol!" : "Cartão registrado");
}

async function finalizarPartidaAtual() {
  if (!estado.partidaAtual) return;
  await PeladaAPI.finalizarPartida(estado.partidaAtual.id);
  const times = await PeladaAPI.listarTimes(estado.peladaId);
  estado.times = times;
  renderClassificacao(times, "tabela-classificacao");
  mostrarTela("tela-classificacao");
  toast("Partida finalizada · pontos atualizados");
}

async function encerrarPelada() {
  const ok = confirm("Encerrar a pelada agora?");
  if (!ok) return;
  await PeladaAPI.encerrar(estado.peladaId);
  const times = await PeladaAPI.listarTimes(estado.peladaId);
  renderClassificacao(times, "ranking-final");
  mostrarTela("tela-fim");
}

/* ---------- eventos ---------- */

montarSeletorEstrelas();

document.getElementById("form-nova-pelada").addEventListener("submit", async (e) => {
  e.preventDefault();
  try {
    const pelada = await PeladaAPI.criar({
      nome: document.getElementById("nome-pelada").value.trim(),
      quantidadeTimes: Number(document.getElementById("qtd-times").value),
    });
    estado.peladaId = pelada.id;
    localStorage.setItem("peladaId", String(pelada.id));
    renderListasCadastro([]);
    mostrarTela("tela-jogadores");
    toast("Pelada criada!");
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
  const btn = e.target.closest("[data-apagar-id]");
  if (!btn) return;
  try {
    await apagarJogador(Number(btn.dataset.apagarId));
  } catch (err) {
    toast(err.message);
  }
});

document.getElementById("lista-goleiros").addEventListener("click", async (e) => {
  const btn = e.target.closest("[data-apagar-id]");
  if (!btn) return;
  try {
    await apagarJogador(Number(btn.dataset.apagarId));
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
    try {
      await registrarEventoAoVivo(btn.dataset.evento);
    } catch (err) {
      toast(err.message);
    }
  });
});

document.getElementById("btn-finalizar-partida").addEventListener("click", async () => {
  try {
    await finalizarPartidaAtual();
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

document.getElementById("btn-nova-pelada").addEventListener("click", () => {
  localStorage.removeItem("peladaId");
  estado.peladaId = null;
  estado.times = [];
  estado.goleiros = [];
  estado.partidaAtual = null;
  mostrarTela("tela-inicio");
});

document.getElementById("modal-fechar").addEventListener("click", fecharModal);
document.getElementById("modal-fundo").addEventListener("click", fecharModal);

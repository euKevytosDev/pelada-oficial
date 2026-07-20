/**
 * Pelada Oficial — lógica das telas no celular
 *
 * Fluxo:
 * 1) Criar pelada
 * 2) Adicionar jogadores + estrelas
 * 3) Sortear times equilibrados
 * 4) Jogar rodadas ao vivo (gol / cartões)
 * 5) Encerrar pelada
 */

const estado = {
  peladaId: null,
  estrelasSelecionadas: 3,
  times: [],
  partidaAtual: null,
  tipoEventoPendente: null,
};

/* ---------- helpers de tela ---------- */

function mostrarTela(id) {
  document.querySelectorAll(".tela").forEach((tela) => tela.classList.remove("ativa"));
  document.getElementById(id).classList.add("ativa");

  const titulos = {
    "tela-inicio": "Controle da pelada no celular",
    "tela-jogadores": "Cadastre os jogadores",
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
  return "★".repeat(n) + "☆".repeat(5 - n);
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
    const html = `
      <div class="opcoes">
        ${opcoes
          .map(
            (o) =>
              `<button type="button" class="opcao" data-id="${o.id}">${o.label}</button>`
          )
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

    const cancelar = () => {
      document.getElementById("modal-fechar").removeEventListener("click", onCancel);
      document.getElementById("modal-fundo").removeEventListener("click", onCancel);
      resolve(null);
    };
    const onCancel = () => {
      fecharModal();
      cancelar();
    };
    document.getElementById("modal-fechar").addEventListener("click", onCancel, { once: true });
    document.getElementById("modal-fundo").addEventListener("click", onCancel, { once: true });
  });
}

/* ---------- render ---------- */

function renderJogadores(jogadores) {
  const lista = document.getElementById("lista-jogadores");
  if (!jogadores.length) {
    lista.innerHTML = `<li><span>Nenhum jogador ainda</span><span class="meta">adicione acima</span></li>`;
    return;
  }
  lista.innerHTML = jogadores
    .map(
      (j) => `
      <li>
        <span>${j.nome}</span>
        <span class="meta">${estrelasTexto(j.estrelas)}</span>
      </li>`
    )
    .join("");
}

function renderTimes(times) {
  estado.times = times;
  const grade = document.getElementById("grade-times");
  grade.innerHTML = times
    .map(
      (t) => `
      <article class="time-card" style="border-left-color:${t.cor}">
        <h3>${t.nome}</h3>
        <p class="estrelas-total">${t.totalEstrelas} estrelas no total · ${t.jogadores.length} jogadores</p>
        <ul>
          ${t.jogadores
            .map((j) => `<li>${j.nome} <span class="meta">${estrelasTexto(j.estrelas)}</span></li>`)
            .join("")}
        </ul>
      </article>`
    )
    .join("");
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
        texto = `Gol de ${e.jogadorNome} (${e.timeNome}) · goleiro ${e.goleiroNome}`;
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

async function carregarJogadores() {
  const jogadores = await PeladaAPI.listarJogadores(estado.peladaId);
  renderJogadores(jogadores);
  return jogadores;
}

async function sortearTimes() {
  const times = await PeladaAPI.sortear(estado.peladaId);
  renderTimes(times);
  mostrarTela("tela-times");
  toast("Times sorteados!");
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
    const adversarios =
      timeId === partida.timeA.id ? partida.jogadoresTimeB : partida.jogadoresTimeA;
    goleiroId = await escolherOpcao(
      "Goleiro que sofreu?",
      adversarios.map((j) => ({ id: j.id, label: j.nome }))
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

/* ---------- eventos da página ---------- */

document.getElementById("form-nova-pelada").addEventListener("submit", async (e) => {
  e.preventDefault();
  try {
    const pelada = await PeladaAPI.criar({
      nome: document.getElementById("nome-pelada").value.trim(),
      quantidadeTimes: Number(document.getElementById("qtd-times").value),
    });
    estado.peladaId = pelada.id;
    localStorage.setItem("peladaId", String(pelada.id));
    renderJogadores([]);
    mostrarTela("tela-jogadores");
    toast("Pelada criada!");
  } catch (err) {
    toast(err.message);
  }
});

document.querySelectorAll("#seletor-estrelas .estrela").forEach((btn) => {
  btn.addEventListener("click", () => {
    estado.estrelasSelecionadas = Number(btn.dataset.estrela);
    document.querySelectorAll("#seletor-estrelas .estrela").forEach((b) => {
      b.classList.toggle("ativa", Number(b.dataset.estrela) <= estado.estrelasSelecionadas);
    });
  });
});

document.getElementById("form-jogador").addEventListener("submit", async (e) => {
  e.preventDefault();
  try {
    await PeladaAPI.adicionarJogador(estado.peladaId, {
      nome: document.getElementById("nome-jogador").value.trim(),
      estrelas: estado.estrelasSelecionadas,
    });
    document.getElementById("nome-jogador").value = "";
    await carregarJogadores();
    toast("Jogador adicionado");
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
  estado.partidaAtual = null;
  mostrarTela("tela-inicio");
});

document.getElementById("modal-fechar").addEventListener("click", fecharModal);
document.getElementById("modal-fundo").addEventListener("click", fecharModal);

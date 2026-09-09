/**
 * Desempate 1º x 2º nos pênaltis — altera só o prêmio de campeão (tabela fica igual).
 * Lista de batedores editável + escolha explícita do goleiro campeão na tela.
 */
const PenaltisApp = (() => {
  const COBRANCAS_INICIAIS = 5;
  const BOLA_SRC = "soccer-ball-svgrepo-com.svg";
  let sessao = null;
  let seqId = 0;

  function uid(prefix) {
    seqId += 1;
    return `${prefix}-${Date.now()}-${seqId}`;
  }

  function timesEmpatadosNoTopo(classificacao) {
    const lista = Array.isArray(classificacao) ? classificacao : [];
    if (lista.length < 2) return [];
    const maxPts = Number(lista[0]?.pontos) || 0;
    return lista.filter((t) => (Number(t.pontos) || 0) === maxPts);
  }

  function precisaDesempatar(resumo) {
    return timesEmpatadosNoTopo(resumo?.classificacao).length >= 2;
  }

  function jogadoresSugestao(resumo, nomeTime) {
    const time = (resumo?.times || []).find(
      (t) => String(t.nome).trim().toLowerCase() === String(nomeTime).trim().toLowerCase()
    );
    if (!time) return [];
    return (time.jogadores || [])
      .filter((j) => j?.nome)
      .map((j, i) => ({
        id: j.id || uid(`sug-${nomeTime}-${i}`),
        nome: String(j.nome).trim(),
      }));
  }

  function listarGoleirosAptos(resumo) {
    const mapa = new Map();
    const add = (nome, extra = {}) => {
      const n = String(nome || "").trim();
      if (!n) return;
      const key = n.toLowerCase();
      if (!mapa.has(key)) {
        mapa.set(key, {
          id: String(extra.id || `gk-${key}`),
          nome: n,
          time: extra.time || "",
        });
      } else if (extra.time && !mapa.get(key).time) {
        mapa.get(key).time = extra.time;
      }
    };

    (resumo?.times || []).forEach((t) => {
      if (t.goleiro?.nome) add(t.goleiro.nome, { id: t.goleiro.id, time: t.nome });
      (t.jogadores || []).forEach((j) => {
        if (j?.goleiro && j?.nome) add(j.nome, { id: j.id, time: t.nome });
      });
    });
    (resumo?.golsSofridos || []).forEach((g) => add(g.nome, { time: g.time || "" }));

    try {
      if (typeof LocalJogo !== "undefined") {
        (LocalJogo.listarJogadores() || [])
          .filter((j) => j.goleiro && j.apto !== false)
          .forEach((j) => add(j.nome, { id: j.id }));
      }
    } catch (_) {
      /* ignore */
    }

    return [...mapa.values()].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  }

  function montarLado(resumo, timeClassif) {
    const timeFull = (resumo?.times || []).find(
      (t) => String(t.nome).trim().toLowerCase() === String(timeClassif.nome).trim().toLowerCase()
    );
    const sugestao = jogadoresSugestao(resumo, timeClassif.nome);
    const batedores = sugestao.length
      ? sugestao.slice(0, COBRANCAS_INICIAIS).map((j) => ({ ...j }))
      : Array.from({ length: COBRANCAS_INICIAIS }, (_, i) => ({
          id: uid(`vazio-${timeClassif.nome}`),
          nome: `Batedor ${i + 1}`,
        }));
    while (batedores.length < COBRANCAS_INICIAIS) {
      batedores.push({ id: uid("extra"), nome: `Batedor ${batedores.length + 1}` });
    }
    return {
      nome: timeClassif.nome,
      cor: timeClassif.cor || timeFull?.cor || "#0B3D2E",
      pontos: timeClassif.pontos,
      batedores,
      cobrancas: Array.from({ length: COBRANCAS_INICIAIS }, () => null),
    };
  }

  function abrir(resumo) {
    const empatados = timesEmpatadosNoTopo(resumo?.classificacao);
    if (empatados.length < 2) {
      toast("Não há empate em pontos no topo da tabela");
      return;
    }
    sessao = {
      timeA: montarLado(resumo, empatados[0]),
      timeB: montarLado(resumo, empatados[1]),
      finalizado: false,
      goleiros: listarGoleirosAptos(resumo),
      goleiroCampeaoId: null,
      goleiroCampeaoNome: null,
      etapa: "cobrancas",
    };
    render();
    mostrarTela("tela-penaltis");
  }

  function cicloResultado(atual) {
    if (atual === null) return "gol";
    if (atual === "gol") return "erro";
    return null;
  }

  function marcarCobranca(ladoKey, index) {
    const lado = sessao?.[ladoKey];
    if (!lado || sessao.finalizado || sessao.etapa !== "cobrancas") return;
    lado.cobrancas[index] = cicloResultado(lado.cobrancas[index]);
    render();
  }

  function garantirBatedorParaIndice(lado, index) {
    while (lado.batedores.length <= index) {
      lado.batedores.push({
        id: uid("bat"),
        nome: `Batedor ${lado.batedores.length + 1}`,
      });
    }
  }

  function editarNome(ladoKey, index, nome) {
    const lado = sessao?.[ladoKey];
    if (!lado) return;
    garantirBatedorParaIndice(lado, index);
    lado.batedores[index].nome = String(nome || "").trim();
  }

  function adicionarBatedor(ladoKey) {
    const lado = sessao?.[ladoKey];
    if (!lado || sessao.finalizado) return;
    lado.batedores.push({
      id: uid("bat"),
      nome: `Batedor ${lado.batedores.length + 1}`,
    });
    render();
  }

  function removerBatedor(ladoKey, index) {
    const lado = sessao?.[ladoKey];
    if (!lado || sessao.finalizado) return;
    if (lado.batedores.length <= 1) {
      toast("Deixe pelo menos 1 batedor");
      return;
    }
    lado.batedores.splice(index, 1);
    render();
  }

  function moverBatedor(ladoKey, index, direcao) {
    const lado = sessao?.[ladoKey];
    if (!lado) return;
    const novo = index + direcao;
    if (novo < 0 || novo >= lado.batedores.length) return;
    const bats = [...lado.batedores];
    [bats[index], bats[novo]] = [bats[novo], bats[index]];
    lado.batedores = bats;
    render();
  }

  function inverterOrdem(ladoKey) {
    const lado = sessao?.[ladoKey];
    if (!lado) return;
    lado.batedores = [...lado.batedores].reverse();
    render();
  }

  function adicionarCobrancaSuddenDeath() {
    if (!sessao || sessao.finalizado || sessao.etapa !== "cobrancas") return;
    sessao.timeA.cobrancas.push(null);
    sessao.timeB.cobrancas.push(null);
    garantirBatedorParaIndice(sessao.timeA, sessao.timeA.cobrancas.length - 1);
    garantirBatedorParaIndice(sessao.timeB, sessao.timeB.cobrancas.length - 1);
    render();
    toast("Cobrança extra (morte súbita)");
  }

  function selecionarGoleiro(id, nome) {
    if (!sessao) return;
    sessao.goleiroCampeaoId = String(id);
    sessao.goleiroCampeaoNome = String(nome || "").trim();
    render();
  }

  function adicionarGoleiroManual() {
    if (!sessao) return;
    const input = document.getElementById("pen-gk-manual");
    const nome = String(input?.value || "").trim();
    if (!nome) {
      toast("Digite o nome do goleiro");
      return;
    }
    const id = uid("gk-manual");
    sessao.goleiros.push({ id, nome, time: "" });
    sessao.goleiroCampeaoId = id;
    sessao.goleiroCampeaoNome = nome;
    if (input) input.value = "";
    render();
    toast(`${nome} selecionado`);
  }

  function golsDe(lado) {
    return (lado.cobrancas || []).filter((r) => r === "gol").length;
  }

  function batidasFeitas(lado) {
    return (lado.cobrancas || []).filter((r) => r === "gol" || r === "erro").length;
  }

  function placarTexto() {
    if (!sessao) return "";
    return `${golsDe(sessao.timeA)} x ${golsDe(sessao.timeB)}`;
  }

  function simbolo(r) {
    if (r === "gol") return "●";
    if (r === "erro") return "✕";
    return "";
  }

  function classeSimbolo(r) {
    if (r === "gol") return "pen-ok";
    if (r === "erro") return "pen-erro";
    return "pen-vazio";
  }

  function escAttr(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;");
  }

  function imgBola(cls = "") {
    return `<img class="pen-bola-svg ${cls}" src="${BOLA_SRC}" alt="" width="22" height="22" aria-hidden="true" />`;
  }

  function renderQuadro(ladoKey, lado) {
    const bolas = (lado.cobrancas || [])
      .map((r, i) => {
        const nome = lado.batedores[i]?.nome || `Batedor ${i + 1}`;
        const disabled = sessao.etapa !== "cobrancas" ? "disabled" : "";
        return `
        <div class="pen-bola-item">
          <button type="button" class="pen-bola ${classeSimbolo(r)}" data-pen-acao="marca" data-lado="${ladoKey}" data-idx="${i}" aria-label="Cobrança ${i + 1}" ${disabled}>
            ${r === "gol" ? imgBola("pen-bola-svg-gol") : simbolo(r)}
          </button>
          <input class="pen-bola-nome" type="text" maxlength="40" value="${escAttr(nome)}" data-pen-input="nome-cobranca" data-lado="${ladoKey}" data-idx="${i}" aria-label="Quem bateu a ${i + 1}ª" ${disabled} />
        </div>`;
      })
      .join("");

    return `
      <div class="pen-quadro" style="--pen-cor:${lado.cor}">
        <div class="pen-quadro-topo">
          <strong class="pen-quadro-time">${imgBola("pen-bola-svg-titulo")}${lado.nome}</strong>
          <span class="pen-quadro-gols">${golsDe(lado)}</span>
        </div>
        <div class="pen-bolas">${bolas}</div>
      </div>`;
  }

  function renderLista(ladoKey, lado) {
    const linhas = (lado.batedores || [])
      .map((j, i) => {
        return `
        <li class="pen-jogador">
          <div class="pen-jogador-acoes">
            <button type="button" class="btn-mini pen-mover" data-pen-acao="up" data-lado="${ladoKey}" data-idx="${i}" aria-label="Subir">↑</button>
            <button type="button" class="btn-mini pen-mover" data-pen-acao="down" data-lado="${ladoKey}" data-idx="${i}" aria-label="Descer">↓</button>
          </div>
          <span class="pen-ordem">${i + 1}º</span>
          <input class="pen-nome-input" type="text" maxlength="40" value="${escAttr(j.nome)}" data-pen-input="nome-lista" data-lado="${ladoKey}" data-idx="${i}" />
          <button type="button" class="btn-mini btn-link-perigo" data-pen-acao="remover" data-lado="${ladoKey}" data-idx="${i}">Remover</button>
        </li>`;
      })
      .join("");

    return `
      <article class="pen-time" style="border-top-color:${lado.cor}">
        <header class="pen-time-topo">
          <h3>${lado.nome}</h3>
          <span class="dica">${lado.pontos} pts</span>
        </header>
        <p class="dica">Edite nomes, remova quem não bate ou adicione (goleiro emprestado, lesão, etc.).</p>
        <div class="pen-lista-acoes">
          <button type="button" class="btn btn-secundario" data-pen-acao="adicionar" data-lado="${ladoKey}">+ Jogador</button>
          <button type="button" class="btn btn-secundario" data-pen-acao="inverter" data-lado="${ladoKey}">Inverter</button>
        </div>
        <ul class="pen-lista">${linhas}</ul>
      </article>`;
  }

  function renderGoleiroPicker(timeVencedor) {
    const gks = sessao.goleiros || [];
    const selecionado = sessao.goleiroCampeaoId;
    const botoes = gks.length
      ? gks
          .map((g) => {
            const ativo = String(g.id) === String(selecionado) ? " pen-gk-ativo" : "";
            const label = g.time ? `${g.nome} · ${g.time}` : g.nome;
            return `<button type="button" class="btn pen-gk-btn${ativo}" data-pen-acao="gk" data-gk-id="${escAttr(g.id)}" data-gk-nome="${escAttr(g.nome)}">
              ${imgBola("pen-bola-svg-gk")}<span>${label}</span>
            </button>`;
          })
          .join("")
      : `<p class="dica">Nenhum goleiro na súmula — digite o nome abaixo.</p>`;

    return `
      <div class="pen-gk-box" id="pen-gk-box">
        <div class="pen-gk-topo">
          ${imgBola("pen-bola-svg-hero")}
          <div>
            <h3 class="lista-titulo" style="margin:0">Goleiro campeão dos pênaltis</h3>
            <p class="dica" style="margin:4px 0 0">Time campeão: <strong>${timeVencedor}</strong>. Toque no goleiro que defendeu (Luva de Ouro continua a mesma).</p>
          </div>
        </div>
        <div class="pen-gk-lista">${botoes}</div>
        <div class="pen-gk-manual">
          <input type="text" id="pen-gk-manual" maxlength="40" placeholder="Ou digite o nome do goleiro" />
          <button type="button" class="btn btn-secundario" data-pen-acao="gk-manual">Usar este</button>
        </div>
        ${
          sessao.goleiroCampeaoNome
            ? `<p class="pen-gk-escolhido">Selecionado: <strong>${sessao.goleiroCampeaoNome}</strong></p>`
            : `<p class="dica">Escolha um goleiro para liberar a confirmação.</p>`
        }
      </div>`;
  }

  function timeVencedorAtual() {
    if (!sessao) return null;
    const a = golsDe(sessao.timeA);
    const b = golsDe(sessao.timeB);
    if (a === b) return null;
    return a > b ? sessao.timeA.nome : sessao.timeB.nome;
  }

  function render() {
    const root = document.getElementById("penaltis-conteudo");
    const placar = document.getElementById("penaltis-placar");
    const btnConfirmar = document.getElementById("btn-penaltis-confirmar");
    if (!root || !sessao) return;
    if (placar) {
      placar.innerHTML = `${imgBola("pen-bola-svg-placar")}<span>${placarTexto()}</span>`;
    }

    const vencedor = timeVencedorAtual();
    const etapaGk = sessao.etapa === "goleiro";

    root.innerHTML = `
      <div class="pen-hero">
        ${imgBola("pen-bola-svg-hero-big")}
        <p class="pen-hero-txt">${etapaGk ? "Quase lá — escolha o goleiro campeão" : "Marque as cobranças nas bolinhas"}</p>
      </div>
      <div class="pen-placar-board">
        ${renderQuadro("timeA", sessao.timeA)}
        ${renderQuadro("timeB", sessao.timeB)}
      </div>
      ${
        etapaGk
          ? renderGoleiroPicker(vencedor || "—")
          : `<button type="button" class="btn btn-secundario btn-block" id="btn-pen-sudden" data-pen-acao="sudden">+ Cobrança (morte súbita)</button>
      <h3 class="lista-titulo">Ordem / nomes dos batedores</h3>
      <div class="penaltis-grade">
        ${renderLista("timeA", sessao.timeA)}
        ${renderLista("timeB", sessao.timeB)}
      </div>`
      }
    `;

    if (btnConfirmar) {
      if (etapaGk) {
        btnConfirmar.textContent = sessao.goleiroCampeaoNome
          ? `Confirmar — ${sessao.goleiroCampeaoNome}`
          : "Escolha o goleiro campeão";
        btnConfirmar.disabled = !sessao.goleiroCampeaoNome;
      } else {
        btnConfirmar.textContent = "Definir campeão";
        btnConfirmar.disabled = false;
      }
    }
  }

  function sincronizarNomeCobrancaComLista(ladoKey, index, nome) {
    const lado = sessao?.[ladoKey];
    if (!lado) return;
    garantirBatedorParaIndice(lado, index);
    lado.batedores[index].nome = String(nome || "").trim() || `Batedor ${index + 1}`;
  }

  function aplicarCampeao(vencedorNome, goleiroCampeaoNome) {
    const resumo = estado.resumoAtual;
    if (!resumo) return;
    const pts =
      (resumo.classificacao || []).find(
        (t) => String(t.nome).trim().toLowerCase() === String(vencedorNome).trim().toLowerCase()
      )?.pontos ?? "";
    const detalhe = pts !== "" ? `${pts} pts · campeão nos pênaltis` : "Campeão nos pênaltis";
    if (!resumo.premios) resumo.premios = {};
    resumo.premios.campeao = {
      nome: vencedorNome,
      nomes: [vencedorNome],
      empate: false,
      detalhe,
    };
    if (goleiroCampeaoNome) {
      resumo.premios.goleiroCampeaoPenaltis = {
        nome: goleiroCampeaoNome,
        nomes: [goleiroCampeaoNome],
        empate: false,
        detalhe: "campeão nos pênaltis",
      };
    }

    const mapBatidas = (lado) =>
      (lado.cobrancas || []).map((r, i) => ({
        nome: lado.batedores[i]?.nome || `Batedor ${i + 1}`,
        resultado: r,
      }));
    resumo.penaltis = {
      timeA: sessao.timeA.nome,
      timeB: sessao.timeB.nome,
      golsA: golsDe(sessao.timeA),
      golsB: golsDe(sessao.timeB),
      campeao: vencedorNome,
      goleiroCampeao: goleiroCampeaoNome || null,
      batidasA: mapBatidas(sessao.timeA),
      batidasB: mapBatidas(sessao.timeB),
    };
    estado.resumoAtual = resumo;
    renderResumoOficial(resumo);
    atualizarBotaoDesempate(resumo);
    mostrarTela("tela-fim");
    toast(
      goleiroCampeaoNome
        ? `${vencedorNome} campeão · GK ${goleiroCampeaoNome}`
        : `${vencedorNome} campeão nos pênaltis`
    );
  }

  function confirmar() {
    if (!sessao) return;
    const a = golsDe(sessao.timeA);
    const b = golsDe(sessao.timeB);
    const feitosA = batidasFeitas(sessao.timeA);
    const feitosB = batidasFeitas(sessao.timeB);

    if (sessao.etapa === "cobrancas") {
      if (!feitosA && !feitosB) {
        toast("Marque pelo menos uma cobrança nas bolinhas");
        return;
      }
      if (a === b) {
        toast("Ainda empatado — marque mais ou use + Cobrança");
        return;
      }
      sessao.etapa = "goleiro";
      // Recarrega lista de goleiros (pode ter mudado)
      sessao.goleiros = listarGoleirosAptos(estado.resumoAtual);
      render();
      document.getElementById("pen-gk-box")?.scrollIntoView({ behavior: "smooth", block: "start" });
      toast("Agora escolha o goleiro campeão");
      return;
    }

    if (!sessao.goleiroCampeaoNome) {
      toast("Toque no goleiro campeão dos pênaltis");
      document.getElementById("pen-gk-box")?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }

    const vencedor = a > b ? sessao.timeA.nome : sessao.timeB.nome;
    sessao.finalizado = true;
    aplicarCampeao(vencedor, sessao.goleiroCampeaoNome);
  }

  function atualizarBotaoDesempate(resumo) {
    const btn = document.getElementById("btn-desempatar-penaltis");
    const box = document.getElementById("box-desempatar-penaltis");
    if (!btn || !box) return;
    const mostra = precisaDesempatar(resumo) && !resumo?.penaltis?.campeao;
    box.classList.toggle("oculto", !mostra);
  }

  let bound = false;
  function init() {
    if (bound) return;
    bound = true;

    document.getElementById("btn-desempatar-penaltis")?.addEventListener("click", () => {
      if (!estado.resumoAtual) {
        toast("Abra a súmula primeiro");
        return;
      }
      abrir(estado.resumoAtual);
    });

    document.getElementById("btn-penaltis-voltar")?.addEventListener("click", () => {
      if (sessao?.etapa === "goleiro") {
        sessao.etapa = "cobrancas";
        render();
        return;
      }
      mostrarTela("tela-fim");
    });

    document.getElementById("btn-penaltis-confirmar")?.addEventListener("click", confirmar);

    const root = document.getElementById("penaltis-conteudo");
    if (!root) return;

    root.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-pen-acao]");
      if (!btn || !sessao) return;
      const acao = btn.dataset.penAcao;
      const lado = btn.dataset.lado;
      const idx = Number(btn.dataset.idx);
      if (acao === "marca") marcarCobranca(lado, idx);
      else if (acao === "up") moverBatedor(lado, idx, -1);
      else if (acao === "down") moverBatedor(lado, idx, 1);
      else if (acao === "inverter") inverterOrdem(lado);
      else if (acao === "adicionar") adicionarBatedor(lado);
      else if (acao === "remover") removerBatedor(lado, idx);
      else if (acao === "sudden") adicionarCobrancaSuddenDeath();
      else if (acao === "gk") selecionarGoleiro(btn.dataset.gkId, btn.dataset.gkNome);
      else if (acao === "gk-manual") adicionarGoleiroManual();
    });

    root.addEventListener("change", (e) => {
      const input = e.target.closest("[data-pen-input]");
      if (!input || !sessao) return;
      const lado = input.dataset.lado;
      const idx = Number(input.dataset.idx);
      const tipo = input.dataset.penInput;
      if (tipo === "nome-cobranca") {
        sincronizarNomeCobrancaComLista(lado, idx, input.value);
        const listaInput = root.querySelector(
          `input[data-pen-input="nome-lista"][data-lado="${lado}"][data-idx="${idx}"]`
        );
        if (listaInput) listaInput.value = sessao[lado].batedores[idx].nome;
      } else if (tipo === "nome-lista") {
        editarNome(lado, idx, input.value);
        const bolaInput = root.querySelector(
          `input[data-pen-input="nome-cobranca"][data-lado="${lado}"][data-idx="${idx}"]`
        );
        if (bolaInput) bolaInput.value = sessao[lado].batedores[idx].nome;
      }
    });

    root.addEventListener("input", (e) => {
      const input = e.target.closest("[data-pen-input]");
      if (!input || !sessao) return;
      const lado = input.dataset.lado;
      const idx = Number(input.dataset.idx);
      if (input.dataset.penInput === "nome-lista" || input.dataset.penInput === "nome-cobranca") {
        sincronizarNomeCobrancaComLista(lado, idx, input.value);
      }
    });
  }

  return {
    init,
    abrir,
    precisaDesempatar,
    atualizarBotaoDesempate,
    timesEmpatadosNoTopo,
  };
})();

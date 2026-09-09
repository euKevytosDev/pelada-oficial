/**
 * Desempate 1º x 2º nos pênaltis — altera só o prêmio de campeão (tabela fica igual).
 * Lista de batedores é 100% editável (goleiro emprestado, lesão, etc.).
 * Placar visual: 5 cobranças (bolinhas), com sudden death se empatar.
 * Ao confirmar: escolhe o goleiro campeão dos pênaltis (Luva de Ouro permanece).
 */
const PenaltisApp = (() => {
  const COBRANCAS_INICIAIS = 5;
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

  /** Só linha do time — goleiro não entra automático (costuma ser emprestado). */
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
      if (!mapa.has(key)) mapa.set(key, { id: extra.id || key, nome: n, time: extra.time || "" });
    };

    (resumo?.times || []).forEach((t) => {
      if (t.goleiro?.nome) add(t.goleiro.nome, { id: t.goleiro.id, time: t.nome });
    });
    (resumo?.golsSofridos || []).forEach((g) => {
      add(g.nome, { time: g.time || "" });
    });

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
    if (!lado || sessao.finalizado) return;
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
    if (!sessao || sessao.finalizado) return;
    sessao.timeA.cobrancas.push(null);
    sessao.timeB.cobrancas.push(null);
    garantirBatedorParaIndice(sessao.timeA, sessao.timeA.cobrancas.length - 1);
    garantirBatedorParaIndice(sessao.timeB, sessao.timeB.cobrancas.length - 1);
    render();
    toast("Cobrança extra (morte súbita)");
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

  function renderQuadro(ladoKey, lado) {
    const bolas = (lado.cobrancas || [])
      .map((r, i) => {
        const nome = lado.batedores[i]?.nome || `Batedor ${i + 1}`;
        return `
        <div class="pen-bola-item">
          <button type="button" class="pen-bola ${classeSimbolo(r)}" data-pen-acao="marca" data-lado="${ladoKey}" data-idx="${i}" aria-label="Cobrança ${i + 1}">
            ${simbolo(r)}
          </button>
          <input class="pen-bola-nome" type="text" maxlength="40" value="${escAttr(nome)}" data-pen-input="nome-cobranca" data-lado="${ladoKey}" data-idx="${i}" aria-label="Quem bateu a ${i + 1}ª" />
        </div>`;
      })
      .join("");

    return `
      <div class="pen-quadro" style="--pen-cor:${lado.cor}">
        <div class="pen-quadro-topo">
          <strong class="pen-quadro-time">${lado.nome}</strong>
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
        <p class="dica">Edite nomes, remova quem não bate (lesão) ou adicione (goleiro emprestado, etc.).</p>
        <div class="pen-lista-acoes">
          <button type="button" class="btn btn-secundario" data-pen-acao="adicionar" data-lado="${ladoKey}">+ Jogador</button>
          <button type="button" class="btn btn-secundario" data-pen-acao="inverter" data-lado="${ladoKey}">Inverter</button>
        </div>
        <ul class="pen-lista">${linhas}</ul>
      </article>`;
  }

  function render() {
    const root = document.getElementById("penaltis-conteudo");
    const placar = document.getElementById("penaltis-placar");
    if (!root || !sessao) return;
    if (placar) placar.textContent = placarTexto();
    root.innerHTML = `
      <div class="pen-placar-board">
        ${renderQuadro("timeA", sessao.timeA)}
        ${renderQuadro("timeB", sessao.timeB)}
      </div>
      <button type="button" class="btn btn-secundario btn-block" id="btn-pen-sudden" data-pen-acao="sudden">+ Cobrança (morte súbita)</button>
      <h3 class="lista-titulo">Ordem / nomes dos batedores</h3>
      <div class="penaltis-grade">
        ${renderLista("timeA", sessao.timeA)}
        ${renderLista("timeB", sessao.timeB)}
      </div>
    `;
  }

  function sincronizarNomeCobrancaComLista(ladoKey, index, nome) {
    const lado = sessao?.[ladoKey];
    if (!lado) return;
    garantirBatedorParaIndice(lado, index);
    lado.batedores[index].nome = String(nome || "").trim() || `Batedor ${index + 1}`;
  }

  async function escolherGoleiroCampeao(resumo, timeVencedor) {
    const gks = listarGoleirosAptos(resumo);
    if (!gks.length) {
      toast("Nenhum goleiro apto encontrado — só o time fica campeão");
      return null;
    }
    if (typeof escolherOpcao !== "function") return gks[0]?.nome || null;

    const opcoes = gks.map((g) => ({
      id: String(g.id),
      label: g.time ? `${g.nome} (${g.time})` : g.nome,
      goleiro: true,
    }));
    const id = await escolherOpcao(`Goleiro campeão — pênaltis (${timeVencedor})`, opcoes);
    if (!id) return null;
    return gks.find((g) => String(g.id) === String(id))?.nome || null;
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
    // Não mexe na Luva de Ouro (menos vazado). Prêmio à parte.
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

  async function confirmar() {
    if (!sessao) return;
    const a = golsDe(sessao.timeA);
    const b = golsDe(sessao.timeB);
    const feitosA = batidasFeitas(sessao.timeA);
    const feitosB = batidasFeitas(sessao.timeB);
    if (!feitosA && !feitosB) {
      toast("Marque pelo menos uma cobrança nas bolinhas");
      return;
    }
    if (a === b) {
      toast("Ainda empatado — marque mais ou use + Cobrança");
      return;
    }
    const vencedor = a > b ? sessao.timeA.nome : sessao.timeB.nome;
    const goleiro = await escolherGoleiroCampeao(estado.resumoAtual, vencedor);
    sessao.finalizado = true;
    aplicarCampeao(vencedor, goleiro);
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
      mostrarTela("tela-fim");
    });

    document.getElementById("btn-penaltis-confirmar")?.addEventListener("click", () => {
      confirmar().catch((err) => toast(err.message || "Não deu para definir o campeão"));
    });

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

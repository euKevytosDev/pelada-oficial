/**
 * Desempate 1º x 2º nos pênaltis — altera só o prêmio de campeão (tabela fica igual).
 */
const PenaltisApp = (() => {
  let sessao = null;

  function timesEmpatadosNoTopo(classificacao) {
    const lista = Array.isArray(classificacao) ? classificacao : [];
    if (lista.length < 2) return [];
    const maxPts = Number(lista[0]?.pontos) || 0;
    return lista.filter((t) => (Number(t.pontos) || 0) === maxPts);
  }

  function precisaDesempatar(resumo) {
    return timesEmpatadosNoTopo(resumo?.classificacao).length >= 2;
  }

  function jogadoresDoTime(resumo, nomeTime) {
    const time = (resumo?.times || []).find(
      (t) => String(t.nome).trim().toLowerCase() === String(nomeTime).trim().toLowerCase()
    );
    if (!time) return [];
    const linha = (time.jogadores || [])
      .filter((j) => j?.nome)
      .map((j, i) => ({
        id: j.id || `j-${nomeTime}-${i}`,
        nome: String(j.nome).trim(),
        goleiro: false,
      }));
    const gk = time.goleiro?.nome
      ? [{ id: time.goleiro.id || `gk-${nomeTime}`, nome: String(time.goleiro.nome).trim(), goleiro: true }]
      : [];
    return [...linha, ...gk];
  }

  function montarLado(resumo, timeClassif) {
    const timeFull = (resumo?.times || []).find(
      (t) => String(t.nome).trim().toLowerCase() === String(timeClassif.nome).trim().toLowerCase()
    );
    const batedores = jogadoresDoTime(resumo, timeClassif.nome);
    return {
      nome: timeClassif.nome,
      cor: timeClassif.cor || timeFull?.cor || "#0B3D2E",
      pontos: timeClassif.pontos,
      batedores,
      resultados: batedores.map(() => null),
    };
  }

  function abrir(resumo) {
    const empatados = timesEmpatadosNoTopo(resumo?.classificacao);
    if (empatados.length < 2) {
      toast("Não há empate em pontos no topo da tabela");
      return;
    }
    const a = montarLado(resumo, empatados[0]);
    const b = montarLado(resumo, empatados[1]);
    if (!a.batedores.length || !b.batedores.length) {
      toast("Faltam jogadores nos times empatados");
      return;
    }
    sessao = { timeA: a, timeB: b, finalizado: false };
    render();
    mostrarTela("tela-penaltis");
  }

  function moverBatedor(ladoKey, index, direcao) {
    const lado = sessao?.[ladoKey];
    if (!lado) return;
    const novo = index + direcao;
    if (novo < 0 || novo >= lado.batedores.length) return;
    const bats = [...lado.batedores];
    const ress = [...lado.resultados];
    [bats[index], bats[novo]] = [bats[novo], bats[index]];
    [ress[index], ress[novo]] = [ress[novo], ress[index]];
    lado.batedores = bats;
    lado.resultados = ress;
    render();
  }

  function inverterOrdem(ladoKey) {
    const lado = sessao?.[ladoKey];
    if (!lado) return;
    lado.batedores = [...lado.batedores].reverse();
    lado.resultados = [...lado.resultados].reverse();
    render();
  }

  function cicloResultado(atual) {
    if (atual === null) return "gol";
    if (atual === "gol") return "erro";
    return null;
  }

  function marcarBatida(ladoKey, index) {
    const lado = sessao?.[ladoKey];
    if (!lado || sessao.finalizado) return;
    lado.resultados[index] = cicloResultado(lado.resultados[index]);
    render();
  }

  function golsDe(lado) {
    return (lado.resultados || []).filter((r) => r === "gol").length;
  }

  function batidasFeitas(lado) {
    return (lado.resultados || []).filter((r) => r === "gol" || r === "erro").length;
  }

  function placarTexto() {
    if (!sessao) return "";
    return `${golsDe(sessao.timeA)} x ${golsDe(sessao.timeB)}`;
  }

  function simbolo(r) {
    if (r === "gol") return "O";
    if (r === "erro") return "X";
    return "·";
  }

  function classeSimbolo(r) {
    if (r === "gol") return "pen-ok";
    if (r === "erro") return "pen-erro";
    return "pen-vazio";
  }

  function renderLado(ladoKey, lado) {
    const linhas = (lado.batedores || [])
      .map((j, i) => {
        const r = lado.resultados[i];
        const meta = j.goleiro ? " · GK" : "";
        return `
        <li class="pen-jogador" data-lado="${ladoKey}" data-idx="${i}">
          <div class="pen-jogador-acoes">
            <button type="button" class="btn-mini pen-mover" data-pen-acao="up" data-lado="${ladoKey}" data-idx="${i}" aria-label="Subir">↑</button>
            <button type="button" class="btn-mini pen-mover" data-pen-acao="down" data-lado="${ladoKey}" data-idx="${i}" aria-label="Descer">↓</button>
          </div>
          <span class="pen-ordem">${i + 1}º</span>
          <span class="pen-nome">${j.nome}${meta}</span>
          <button type="button" class="pen-marca ${classeSimbolo(r)}" data-pen-acao="marca" data-lado="${ladoKey}" data-idx="${i}" aria-label="Marcar batida">
            ${simbolo(r)}
          </button>
        </li>`;
      })
      .join("");

    return `
      <article class="pen-time" style="border-top-color:${lado.cor}">
        <header class="pen-time-topo">
          <h3>${lado.nome}</h3>
          <strong class="pen-gols">${golsDe(lado)}</strong>
        </header>
        <p class="dica">${lado.pontos} pts na tabela · toque no círculo para O / X</p>
        <button type="button" class="btn btn-secundario btn-block" data-pen-acao="inverter" data-lado="${ladoKey}">Inverter ordem</button>
        <ul class="pen-lista">${linhas}</ul>
      </article>`;
  }

  function render() {
    const root = document.getElementById("penaltis-conteudo");
    const placar = document.getElementById("penaltis-placar");
    if (!root || !sessao) return;
    if (placar) placar.textContent = placarTexto();
    root.innerHTML = `
      ${renderLado("timeA", sessao.timeA)}
      ${renderLado("timeB", sessao.timeB)}
    `;
  }

  function aplicarCampeao(vencedorNome) {
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
    resumo.penaltis = {
      timeA: sessao.timeA.nome,
      timeB: sessao.timeB.nome,
      golsA: golsDe(sessao.timeA),
      golsB: golsDe(sessao.timeB),
      campeao: vencedorNome,
      batidasA: sessao.timeA.batedores.map((j, i) => ({
        nome: j.nome,
        resultado: sessao.timeA.resultados[i],
      })),
      batidasB: sessao.timeB.batedores.map((j, i) => ({
        nome: j.nome,
        resultado: sessao.timeB.resultados[i],
      })),
    };
    estado.resumoAtual = resumo;
    renderResumoOficial(resumo);
    atualizarBotaoDesempate(resumo);
    mostrarTela("tela-fim");
    toast(`${vencedorNome} campeão nos pênaltis`);
  }

  function confirmar() {
    if (!sessao) return;
    const a = golsDe(sessao.timeA);
    const b = golsDe(sessao.timeB);
    const feitosA = batidasFeitas(sessao.timeA);
    const feitosB = batidasFeitas(sessao.timeB);
    if (!feitosA && !feitosB) {
      toast("Marque pelo menos uma batida");
      return;
    }
    if (a === b) {
      toast("Ainda empatado — marque mais batidas ou escolha o vencedor");
      return;
    }
    const vencedor = a > b ? sessao.timeA.nome : sessao.timeB.nome;
    sessao.finalizado = true;
    aplicarCampeao(vencedor);
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

    document.getElementById("btn-penaltis-confirmar")?.addEventListener("click", confirmar);

    document.getElementById("penaltis-conteudo")?.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-pen-acao]");
      if (!btn || !sessao) return;
      const acao = btn.dataset.penAcao;
      const lado = btn.dataset.lado;
      const idx = Number(btn.dataset.idx);
      if (acao === "marca") marcarBatida(lado, idx);
      else if (acao === "up") moverBatedor(lado, idx, -1);
      else if (acao === "down") moverBatedor(lado, idx, 1);
      else if (acao === "inverter") inverterOrdem(lado);
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

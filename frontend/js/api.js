/**
 * Comunicação com o backend Spring Boot + token JWT.
 *
 * A sessão fica no celular. Só desloga se o token estiver de fato inválido
 * (não por Render acordando / rede instável).
 */
const API_BASE_PROD = "https://147.15.38.121.sslip.io/api";

function isAppNativo() {
  try {
    return !!(window.Capacitor && typeof window.Capacitor.isNativePlatform === "function"
      ? window.Capacitor.isNativePlatform()
      : false);
  } catch (_) {
    return false;
  }
}

const API_BASE =
  localStorage.getItem("pelada_api") ||
  (isAppNativo()
    ? API_BASE_PROD
    : ["localhost", "127.0.0.1"].includes(location.hostname)
      ? "http://localhost:8080/api"
      : API_BASE_PROD);
const TOKEN_KEY = "pelada_token";
const USER_KEY = "pelada_usuario";
const PELADA_KEY = "peladaId";

function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

function getUsuario() {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (_) {
    return null;
  }
}

function salvarSessao(token, usuario) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(usuario));
}

function limparSessao() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem(PELADA_KEY);
  localStorage.removeItem("pelada_usuario_id_ativo");
  // Backup legado compartilhado — nunca deve sobreviver a logout
  localStorage.removeItem("pelada_elenco_conta_local");
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function forcarLogout(mensagem) {
  limparSessao();
  if (typeof mostrarTela === "function") {
    mostrarTela("tela-auth");
  }
  if (typeof atualizarUserBar === "function") {
    atualizarUserBar();
  }
  throw new Error(mensagem || "Faça login para continuar");
}

function pareceServidorAcordando(resposta, corpoTexto) {
  if ([502, 503, 504].includes(resposta.status)) return true;
  if (resposta.status === 404) {
    const ct = resposta.headers.get("content-type") || "";
    if (!ct.includes("json") && (corpoTexto || "").trim() === "Not Found") return true;
  }
  return false;
}

/**
 * Confirma se o token ainda vale (chamada leve).
 * Rede/servidor dormindo → assume que ainda vale (não desloga).
 */
async function sessaoAindaValida() {
  const token = getToken();
  if (!token) return false;
  try {
    const resposta = await fetch(`${API_BASE}/peladas/ativa`, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });
    if (resposta.status === 401 || resposta.status === 403) {
      return false;
    }
    // 502/503/404 plain = Render reiniciando — mantém sessão
    if ([502, 503, 504, 404].includes(resposta.status)) {
      return true;
    }
    return true;
  } catch (_) {
    return true;
  }
}

async function lerMensagemErro(resposta) {
  const ct = resposta.headers.get("content-type") || "";
  if (ct.includes("json")) {
    try {
      const erro = await resposta.json();
      return erro.message || erro.error || `Erro HTTP ${resposta.status}`;
    } catch (_) {
      /* ignore */
    }
  }
  try {
    const texto = await resposta.text();
    if (texto && texto.length < 160) return texto;
  } catch (_) {
    /* ignore */
  }
  return `Erro HTTP ${resposta.status}`;
}

function ehRotaPublica(caminho) {
  const p = String(caminho || "");
  return (
    p.startsWith("/auth/") ||
    p === "/planos" ||
    p.startsWith("/assinatura/webhook") ||
    p === "/health" ||
    p === "/debug-auth"
  );
}

async function api(caminho, opcoes = {}) {
  const maxTentativas = opcoes.retry === false ? 1 : 6;
  let ultimoErro = null;
  const rotaPublica = ehRotaPublica(caminho);

  for (let tentativa = 1; tentativa <= maxTentativas; tentativa++) {
    let resposta;
    try {
      const headers = {
        "Content-Type": "application/json",
        ...(opcoes.headers || {}),
      };
      const token = getToken();
      if (token && !rotaPublica) {
        headers.Authorization = `Bearer ${token}`;
      }

      const fetchOpts = { ...opcoes, headers };
      delete fetchOpts.retry;

      resposta = await fetch(`${API_BASE}${caminho}`, fetchOpts);
    } catch (_) {
      ultimoErro = new Error("Sem conexão com o servidor");
      if (tentativa < maxTentativas) {
        await sleep(1200 * tentativa);
        continue;
      }
      throw ultimoErro;
    }

    if (resposta.status === 401 || resposta.status === 403) {
      const mensagem = await lerMensagemErro(resposta);
      if (rotaPublica || !getToken()) {
        throw new Error(mensagem);
      }
      const valida = await sessaoAindaValida();
      if (!valida) {
        forcarLogout("Sessão expirada. Entre de novo.");
      }
      throw new Error(mensagem || "Conexão oscilou. Toque de novo em Continuar.");
    }

    if ([502, 503, 504].includes(resposta.status) && tentativa < maxTentativas) {
      await sleep(2000 * tentativa);
      continue;
    }

    if (!resposta.ok) {
      const texto = await resposta.clone().text();
      if (pareceServidorAcordando(resposta, texto) && tentativa < maxTentativas) {
        await sleep(2000 * tentativa);
        continue;
      }
      let mensagem = `Erro HTTP ${resposta.status}`;
      try {
        const erro = JSON.parse(texto);
        mensagem = erro.message || erro.error || mensagem;
      } catch (_) {
        if (texto && texto.length < 120) mensagem = texto;
      }
      throw new Error(mensagem);
    }

    if (resposta.status === 204) {
      return null;
    }

    const texto = await resposta.text();
    if (!texto) {
      return null;
    }
    return JSON.parse(texto);
  }

  throw ultimoErro || new Error("Servidor indisponível. Tente de novo.");
}

const AuthAPI = {
  cadastro: (dados) => api("/auth/cadastro", { method: "POST", body: JSON.stringify(dados), retry: false }),
  login: (dados) => api("/auth/login", { method: "POST", body: JSON.stringify(dados), retry: false }),
  google: (dados) => api("/auth/google", { method: "POST", body: JSON.stringify(dados), retry: false }),
};

const PeladaAPI = {
  criar: (dados) => api("/peladas", { method: "POST", body: JSON.stringify(dados) }),
  listarMinhas: () => api("/peladas"),
  ativa: () => api("/peladas/ativa"),
  retomar: () => api("/peladas/ativa/retomar"),
  buscar: (id) => api(`/peladas/${id}`),
  adicionarJogador: (peladaId, dados) =>
    api(`/peladas/${peladaId}/jogadores`, { method: "POST", body: JSON.stringify(dados) }),
  atualizarJogador: (peladaId, jogadorId, dados) =>
    api(`/peladas/${peladaId}/jogadores/${jogadorId}`, {
      method: "PATCH",
      body: JSON.stringify(dados),
    }),
  listarJogadores: async (peladaId) => {
    try {
      return await api(`/peladas/${peladaId}/jogadores`);
    } catch (err) {
      // Fallback se /jogadores falhar (proxy/rota instável)
      return api(`/peladas/${peladaId}/atletas`);
    }
  },
  listarElenco: () => api("/peladas/elenco"),
  recuperarElenco: () => api("/peladas/elenco/recuperar", { method: "POST", body: "{}" }),
  salvarElenco: (itens) =>
    api("/peladas/elenco", { method: "POST", body: JSON.stringify(itens), retry: 3 }),
  removerJogador: (peladaId, jogadorId) =>
    api(`/peladas/${peladaId}/jogadores/${jogadorId}`, { method: "DELETE" }),
  sortear: (peladaId) => api(`/peladas/${peladaId}/sortear`, { method: "POST", body: "{}" }),
  listarTimes: (peladaId) => api(`/peladas/${peladaId}/times`),
  atualizarTime: (peladaId, timeId, dados) =>
    api(`/peladas/${peladaId}/times/${timeId}`, { method: "PATCH", body: JSON.stringify(dados) }),
  moverJogador: (peladaId, jogadorId, timeDestinoId) =>
    api(`/peladas/${peladaId}/jogadores/${jogadorId}/mover`, {
      method: "POST",
      body: JSON.stringify({ timeDestinoId }),
    }),
  listarGoleiros: (peladaId) => api(`/peladas/${peladaId}/goleiros`),
  encerrar: (peladaId) => api(`/peladas/${peladaId}/encerrar`, { method: "POST", body: "{}" }),
  encerrarAtivas: () => api(`/peladas/encerrar-ativas`, { method: "POST", body: "{}" }),
  sincronizarCompleta: (peladaId, dados) =>
    api(`/peladas/${peladaId}/sincronizar-completa`, {
      method: "POST",
      body: JSON.stringify(dados),
      retry: 4,
    }),
  reabrir: (peladaId) => api(`/peladas/${peladaId}/reabrir`, { method: "POST", body: "{}" }),
  apagar: (peladaId) =>
    api(`/peladas/${peladaId}`, { method: "DELETE", retry: 2 }),
  descartar: (peladaId) =>
    api(`/peladas/${peladaId}/descartar`, { method: "DELETE", retry: 2 }),
  retomarPorId: (peladaId) => api(`/peladas/${peladaId}/retomar`),
  resumo: async (peladaId) => {
    try {
      return await api(`/peladas/${peladaId}/sumula`);
    } catch (_) {
      try {
        return await api(`/peladas/${peladaId}/resumo`);
      } catch (_) {
        return api(`/peladas/${peladaId}/relatorio`);
      }
    }
  },
  iniciarPartida: (peladaId, dados) =>
    api(`/peladas/${peladaId}/partidas`, {
      method: "POST",
      body: JSON.stringify(dados),
      retry: 8,
    }),
  listarPartidas: (peladaId) => api(`/peladas/${peladaId}/partidas`),
  buscarPartida: async (partidaId) => {
    try {
      return await api(`/partidas/${partidaId}`);
    } catch (_) {
      return api(`/jogos/${partidaId}`);
    }
  },
  registrarEvento: async (partidaId, dados) => {
    // Uma rota só + clientLanceId: evita gravar o mesmo gol em /lances e de novo em /eventos
    const body = JSON.stringify(dados);
    return api(`/partidas/${partidaId}/lances`, { method: "POST", body, retry: 2 });
  },
  finalizarPartida: async (partidaId) => {
    const opts = { method: "POST", body: "{}", retry: 2 };
    const caminhos = [
      `/partidas/${partidaId}/fechar`,
      `/partidas/${partidaId}/encerrar-rodada`,
      `/jogos/${partidaId}/fechar`,
      `/partidas/${partidaId}/finalizar`,
      `/jogos/${partidaId}/finalizar`,
    ];
    let ultimoErro = null;
    for (const caminho of caminhos) {
      try {
        return await api(caminho, opts);
      } catch (err) {
        ultimoErro = err;
      }
    }
    throw ultimoErro || new Error("Não deu para finalizar a partida");
  },
  desfazerUltimoEvento: (partidaId) =>
    api(`/partidas/${partidaId}/desfazer-evento`, { method: "POST", body: "{}" }),
  cancelarPartida: (partidaId) => api(`/partidas/${partidaId}`, { method: "DELETE" }),
  adicionarObservacao: (peladaId, dados) =>
    api(`/peladas/${peladaId}/observacoes`, { method: "POST", body: JSON.stringify(dados) }),
  listarObservacoes: (peladaId) => api(`/peladas/${peladaId}/observacoes`),
  removerObservacao: (peladaId, observacaoId) =>
    api(`/peladas/${peladaId}/observacoes/${observacaoId}`, { method: "DELETE" }),
  me: () => api("/me"),
  planos: () => api("/planos"),
  checkoutAssinatura: (planoId) =>
    api("/assinatura/checkout", { method: "POST", body: JSON.stringify({ planoId }), retry: false }),
  relatorioMensal: (ano, mes, extras) => {
    const q = new URLSearchParams();
    if (ano != null) q.set("ano", String(ano));
    if (mes != null) q.set("mes", String(mes));
    if (extras && typeof extras === "object") {
      Object.entries(extras).forEach(([k, v]) => {
        if (v != null && v !== "") q.set(k, String(v));
      });
    }
    return api(`/relatorio-mensal?${q.toString()}`);
  },
  caixa: (ano, mes) => api(`/caixa?ano=${ano}&mes=${mes}`),
  caixaValores: (ano, mes, dados) =>
    api(`/caixa/valores?ano=${ano}&mes=${mes}`, { method: "PUT", body: JSON.stringify(dados) }),
  caixaModalidade: (id, ano, mes, modalidade) =>
    api(`/caixa/jogadores/${id}/modalidade?ano=${ano}&mes=${mes}`, {
      method: "PUT",
      body: JSON.stringify({ modalidade }),
    }),
  caixaCobrar: (id, ano, mes) =>
    api(`/caixa/jogadores/${id}/cobrar?ano=${ano}&mes=${mes}`, { method: "POST", body: "{}" }),
  caixaPagar: (id, ano, mes, valor) =>
    api(`/caixa/jogadores/${id}/pagar?ano=${ano}&mes=${mes}`, {
      method: "POST",
      body: JSON.stringify({ valor }),
    }),
  caixaQuitar: (id, ano, mes) =>
    api(`/caixa/jogadores/${id}/quitar?ano=${ano}&mes=${mes}`, { method: "POST", body: "{}" }),
  caixaDesfazer: (id, ano, mes) =>
    api(`/caixa/jogadores/${id}/desfazer?ano=${ano}&mes=${mes}`, { method: "POST", body: "{}" }),
  caixaDesfazerCobranca: (id, ano, mes) =>
    api(`/caixa/jogadores/${id}/desfazer-cobranca?ano=${ano}&mes=${mes}`, { method: "POST", body: "{}" }),
  caixaCobrarJogo: (ano, mes, dados) =>
    api(`/caixa/cobrar-jogo?ano=${ano}&mes=${mes}`, {
      method: "POST",
      body: JSON.stringify(dados || {}),
    }),
  caixaCancelarJogo: (ano, mes, peladaId) =>
    api(`/caixa/cancelar-jogo?ano=${ano}&mes=${mes}&peladaId=${peladaId}`, {
      method: "POST",
      body: "{}",
    }),
};

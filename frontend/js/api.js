/**
 * Comunicação com o backend Spring Boot + token JWT.
 *
 * A sessão fica no celular. Só desloga se o token estiver de fato inválido
 * (não por Render acordando / rede instável).
 */
const API_BASE_PROD = "https://pelada-oficial.onrender.com/api";
const API_BASE =
  localStorage.getItem("pelada_api") ||
  (["localhost", "127.0.0.1"].includes(location.hostname)
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

async function api(caminho, opcoes = {}) {
  const maxTentativas = opcoes.retry === false ? 1 : 6;
  let ultimoErro = null;

  for (let tentativa = 1; tentativa <= maxTentativas; tentativa++) {
    let resposta;
    try {
      const headers = {
        "Content-Type": "application/json",
        ...(opcoes.headers || {}),
      };
      const token = getToken();
      if (token) {
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
      // Render reiniciando / instável: tenta de novo ANTES de deslogar
      if (tentativa < maxTentativas) {
        await sleep(1500 * tentativa);
        continue;
      }
      // Só desloga se confirmar que o token morreu de verdade
      const valida = await sessaoAindaValida();
      if (!valida) {
        forcarLogout("Sessão expirada. Entre de novo.");
      }
      throw new Error("Servidor instável. Toque de novo em Continuar / tente outra vez.");
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
};

const PeladaAPI = {
  criar: (dados) => api("/peladas", { method: "POST", body: JSON.stringify(dados) }),
  listarMinhas: () => api("/peladas"),
  ativa: () => api("/peladas/ativa"),
  buscar: (id) => api(`/peladas/${id}`),
  adicionarJogador: (peladaId, dados) =>
    api(`/peladas/${peladaId}/jogadores`, { method: "POST", body: JSON.stringify(dados) }),
  atualizarJogador: (peladaId, jogadorId, dados) =>
    api(`/peladas/${peladaId}/jogadores/${jogadorId}`, {
      method: "PATCH",
      body: JSON.stringify(dados),
    }),
  listarJogadores: (peladaId) => api(`/peladas/${peladaId}/jogadores`),
  listarElenco: () => api("/peladas/elenco"),
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
  resumo: (peladaId) => api(`/peladas/${peladaId}/resumo`),
  iniciarPartida: (peladaId, dados) =>
    api(`/peladas/${peladaId}/partidas`, { method: "POST", body: JSON.stringify(dados) }),
  listarPartidas: (peladaId) => api(`/peladas/${peladaId}/partidas`),
  buscarPartida: (partidaId) => api(`/partidas/${partidaId}`),
  registrarEvento: (partidaId, dados) =>
    api(`/partidas/${partidaId}/eventos`, { method: "POST", body: JSON.stringify(dados) }),
  finalizarPartida: (partidaId) =>
    api(`/partidas/${partidaId}/finalizar`, { method: "POST", body: "{}" }),
  desfazerUltimoEvento: (partidaId) =>
    api(`/partidas/${partidaId}/desfazer-evento`, { method: "POST", body: "{}" }),
  cancelarPartida: (partidaId) => api(`/partidas/${partidaId}`, { method: "DELETE" }),
  adicionarObservacao: (peladaId, dados) =>
    api(`/peladas/${peladaId}/observacoes`, { method: "POST", body: JSON.stringify(dados) }),
  listarObservacoes: (peladaId) => api(`/peladas/${peladaId}/observacoes`),
  removerObservacao: (peladaId, observacaoId) =>
    api(`/peladas/${peladaId}/observacoes/${observacaoId}`, { method: "DELETE" }),
};

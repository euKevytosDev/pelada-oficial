/**
 * Comunicação com o backend Spring Boot + token JWT.
 */
const API_BASE = "http://localhost:8080/api";
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

async function api(caminho, opcoes = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(opcoes.headers || {}),
  };
  const token = getToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const resposta = await fetch(`${API_BASE}${caminho}`, {
    ...opcoes,
    headers,
  });

  // 401/403 = precisa logar de novo
  if (resposta.status === 401 || resposta.status === 403) {
    limparSessao();
    if (typeof mostrarTela === "function") {
      mostrarTela("tela-auth");
    }
    if (typeof atualizarUserBar === "function") {
      atualizarUserBar();
    }
    let mensagem = "Faça login para continuar";
    try {
      const erro = await resposta.json();
      mensagem = erro.message || mensagem;
    } catch (_) {
      /* ignore */
    }
    throw new Error(mensagem);
  }

  if (!resposta.ok) {
    let mensagem = "Erro na API";
    try {
      const erro = await resposta.json();
      mensagem = erro.message || erro.error || mensagem;
    } catch (_) {
      mensagem = `Erro HTTP ${resposta.status}`;
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

const AuthAPI = {
  cadastro: (dados) => api("/auth/cadastro", { method: "POST", body: JSON.stringify(dados) }),
  login: (dados) => api("/auth/login", { method: "POST", body: JSON.stringify(dados) }),
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

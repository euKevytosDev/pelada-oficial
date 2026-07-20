/**
 * Comunicação com o backend Spring Boot.
 * Backend precisa estar rodando em http://localhost:8080
 */
const API_BASE = "http://localhost:8080/api";

async function api(caminho, opcoes = {}) {
  const resposta = await fetch(`${API_BASE}${caminho}`, {
    headers: {
      "Content-Type": "application/json",
      ...(opcoes.headers || {}),
    },
    ...opcoes,
  });

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

  return resposta.json();
}

const PeladaAPI = {
  criar: (dados) => api("/peladas", { method: "POST", body: JSON.stringify(dados) }),
  buscar: (id) => api(`/peladas/${id}`),
  adicionarJogador: (peladaId, dados) =>
    api(`/peladas/${peladaId}/jogadores`, { method: "POST", body: JSON.stringify(dados) }),
  listarJogadores: (peladaId) => api(`/peladas/${peladaId}/jogadores`),
  sortear: (peladaId) => api(`/peladas/${peladaId}/sortear`, { method: "POST", body: "{}" }),
  listarTimes: (peladaId) => api(`/peladas/${peladaId}/times`),
  encerrar: (peladaId) => api(`/peladas/${peladaId}/encerrar`, { method: "POST", body: "{}" }),
  iniciarPartida: (peladaId, dados) =>
    api(`/peladas/${peladaId}/partidas`, { method: "POST", body: JSON.stringify(dados) }),
  buscarPartida: (partidaId) => api(`/partidas/${partidaId}`),
  registrarEvento: (partidaId, dados) =>
    api(`/partidas/${partidaId}/eventos`, { method: "POST", body: JSON.stringify(dados) }),
  finalizarPartida: (partidaId) =>
    api(`/partidas/${partidaId}/finalizar`, { method: "POST", body: "{}" }),
};

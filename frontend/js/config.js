/**
 * Preferências do app (tema, pelada padrão) — salvas no celular.
 */
const ConfigApp = (() => {
  const THEME_KEY = "pelada_tema";
  const PREFS_KEY = "pelada_prefs";

  const prefsPadrao = {
    nomePelada: "Pelada Oficial",
    qtdTimes: 2,
  };

  function lerPrefs() {
    try {
      const raw = localStorage.getItem(PREFS_KEY);
      if (!raw) return { ...prefsPadrao };
      return { ...prefsPadrao, ...JSON.parse(raw) };
    } catch (_) {
      return { ...prefsPadrao };
    }
  }

  function salvarPrefs(partial) {
    const atual = lerPrefs();
    const next = { ...atual, ...partial };
    localStorage.setItem(PREFS_KEY, JSON.stringify(next));
    aplicarPrefsFormulario(next);
    return next;
  }

  function lerTema() {
    const t = localStorage.getItem(THEME_KEY);
    return t === "dark" || t === "light" || t === "system" ? t : "system";
  }

  function temaEfetivo(modo) {
    const m = modo || lerTema();
    if (m === "dark") return "dark";
    if (m === "light") return "light";
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }

  function aplicarTema(modo) {
    const efetivo = temaEfetivo(modo);
    document.documentElement.setAttribute("data-theme", efetivo);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", efetivo === "dark" ? "#071a14" : "#0B3D2E");
    document.querySelectorAll("[data-tema-opt]").forEach((btn) => {
      btn.classList.toggle("ativa", btn.dataset.temaOpt === (modo || lerTema()));
    });
  }

  function definirTema(modo) {
    localStorage.setItem(THEME_KEY, modo);
    aplicarTema(modo);
  }

  function aplicarPrefsFormulario(prefs) {
    const p = prefs || lerPrefs();
    const nome = document.getElementById("nome-pelada");
    const qtd = document.getElementById("qtd-times");
    const cfgNome = document.getElementById("cfg-nome-pelada");
    const cfgQtd = document.getElementById("cfg-qtd-times");
    if (nome) nome.value = p.nomePelada || prefsPadrao.nomePelada;
    if (qtd) qtd.value = String(p.qtdTimes || prefsPadrao.qtdTimes);
    if (cfgNome) cfgNome.value = p.nomePelada || prefsPadrao.nomePelada;
    if (cfgQtd) cfgQtd.value = String(p.qtdTimes || prefsPadrao.qtdTimes);
  }

  function sincronizarTelaConfig() {
    aplicarTema(lerTema());
    aplicarPrefsFormulario();
    const usuario = typeof getUsuario === "function" ? getUsuario() : null;
    const emailEl = document.getElementById("cfg-conta-email");
    const blocoConta = document.getElementById("cfg-conta-bloco");
    if (emailEl) {
      emailEl.textContent = usuario ? `${usuario.nome} · ${usuario.email || ""}` : "Entre na conta para salvar peladas na nuvem.";
    }
    if (blocoConta) blocoConta.classList.toggle("oculto", !usuario);
    const histBtn = document.getElementById("cfg-historico");
    if (histBtn) histBtn.classList.toggle("oculto", !usuario);
  }

  function init() {
    aplicarTema(lerTema());
    aplicarPrefsFormulario();
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
      if (lerTema() === "system") aplicarTema("system");
    });
  }

  return {
    lerPrefs,
    salvarPrefs,
    lerTema,
    definirTema,
    aplicarTema,
    sincronizarTelaConfig,
    init,
  };
})();

/**
 * Preferências do app (pelada padrão, cronômetros) — salvas no celular.
 * Tema fixo claro (escuro/automático desligados por contraste no celular).
 */
const ConfigApp = (() => {
  const THEME_KEY = "pelada_tema";
  const PREFS_KEY = "pelada_prefs";

  const prefsPadrao = {
    nomePelada: "Pelada Oficial",
    qtdTimes: 2,
    crono1Minutos: 7,
    crono2Minutos: 7,
    crono2Ativo: false,
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
    return "light";
  }

  function aplicarTema() {
    document.documentElement.removeAttribute("data-theme");
    try {
      localStorage.setItem(THEME_KEY, "light");
    } catch (_) {
      /* ignore */
    }
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", "#0B3D2E");
  }

  function definirTema() {
    aplicarTema();
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

    const cfgCrono1 = document.getElementById("cfg-crono1-min");
    const cfgCrono2 = document.getElementById("cfg-crono2-min");
    if (cfgCrono1) cfgCrono1.value = String(p.crono1Minutos ?? prefsPadrao.crono1Minutos);
    if (cfgCrono2) cfgCrono2.value = String(p.crono2Minutos ?? prefsPadrao.crono2Minutos);

    const dois = !!p.crono2Ativo;
    const tog = document.getElementById("cfg-crono2-ativo");
    if (tog) {
      tog.classList.toggle("ligada", dois);
      tog.setAttribute("aria-checked", dois ? "true" : "false");
    }
    const lab = document.getElementById("cfg-crono2-label");
    if (lab) lab.textContent = dois ? "On" : "Off";
    document.getElementById("cfg-crono2-min-wrap")?.classList.toggle("oculto", !dois);
  }

  function sincronizarTelaConfig() {
    aplicarTema();
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
    if (typeof PlanoApp !== "undefined") PlanoApp.pintar();
  }

  function init() {
    aplicarTema();
    aplicarPrefsFormulario();
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

/**
 * Pelada Pro — status na conta + paywall na web.
 * No app nativo (Play) não abre checkout (regra da loja).
 */
const PlanoApp = (() => {
  function assinatura() {
    return getUsuario()?.assinatura || {};
  }

  function temPro() {
    return !!assinatura().proAtivo;
  }

  function pintar() {
    const a = assinatura();
    const pro = !!a.proAtivo;
    document.getElementById("selo-pro")?.classList.toggle("oculto", !pro);
    document.querySelector(".topo")?.classList.toggle("topo-com-pro", pro);

    const status = document.getElementById("cfg-plano-status");
    const nativo = typeof isAppNativo === "function" && isAppNativo();
    document.querySelectorAll("[data-checkout-web]").forEach((el) => {
      el.classList.toggle("oculto", nativo || !!a.cortesia);
    });
    document.getElementById("plano-aviso-android")?.classList.toggle("oculto", !nativo);
    document.getElementById("plano-aviso-cortesia")?.classList.toggle("oculto", !a.cortesia);

    if (!status) return;
    if (a.proAtivo) {
      if (a.cortesia) {
        status.textContent = "Pelada Pro ativo nesta conta.";
      } else {
        const tipo = a.trial ? "Teste Pro" : "Pelada Pro";
        const ate = a.expiraEmTexto ? ` até ${a.expiraEmTexto}` : "";
        status.textContent = `${tipo} ativo${ate}.`;
      }
    } else {
        status.textContent = "Plano grátis — até 3 times, sorteio, placar e 1 cronômetro.";
    }
  }

  function abrir(origem) {
    if (typeof estado !== "undefined") {
      estado.telaAntesPlanos = origem || "tela-configuracoes";
    }
    pintar();
    mostrarTela("tela-planos");
  }

  function exigirPro(mensagem) {
    if (temPro()) return true;
    abrir(document.querySelector(".tela.ativa")?.id || "tela-inicio");
    toast(mensagem || "Isso faz parte do Pelada Pro");
    return false;
  }

  async function sincronizar() {
    if (typeof getToken !== "function" || !getToken()) return;
    try {
      const me = await PeladaAPI.me();
      const atual = getUsuario() || {};
      salvarSessao(getToken(), {
        ...atual,
        id: me.id || atual.id,
        nome: me.nome || atual.nome,
        email: me.email || atual.email,
        assinatura: me.assinatura || atual.assinatura,
      });
      pintar();
    } catch (_) {
      pintar();
    }
  }

  async function assinar(planoId) {
    if (typeof isAppNativo === "function" && isAppNativo()) {
      toast("No Android a cobrança entra pela Play Store. O teste Pro de 7 dias já vale nesta conta.");
      return;
    }
    if (!getToken()) {
      mostrarTela("tela-auth");
      toast("Entre na conta para assinar");
      return;
    }
    try {
      await comLoading(async () => {
        const r = await PeladaAPI.checkoutAssinatura(planoId);
        if (!r?.initPoint) throw new Error("Não veio o link de pagamento");
        window.location.href = r.initPoint;
      }, "Abrindo pagamento...");
    } catch (err) {
      toast(err.message || "Não deu para abrir o pagamento");
    }
  }

  function tratarRetornoUrl() {
    const q = new URLSearchParams(location.search);
    const pago = q.get("pago");
    if (!pago) return;
    if (pago === "ok") toast("Pagamento recebido. Atualizando seu plano...");
    if (pago === "falhou") toast("Pagamento não concluído");
    const url = new URL(location.href);
    url.searchParams.delete("pago");
    url.searchParams.delete("status");
    url.searchParams.delete("payment_id");
    url.searchParams.delete("collection_id");
    url.searchParams.delete("collection_status");
    url.searchParams.delete("external_reference");
    url.searchParams.delete("merchant_order_id");
    url.searchParams.delete("preference_id");
    url.searchParams.delete("site_id");
    url.searchParams.delete("processing_mode");
    url.searchParams.delete("merchant_account_id");
    history.replaceState({}, "", url.pathname + url.search + url.hash);
  }

  function init() {
    tratarRetornoUrl();
    document.getElementById("btn-voltar-planos")?.addEventListener("click", () => {
      mostrarTela(estado.telaAntesPlanos || "tela-configuracoes");
    });
    document.getElementById("btn-abrir-planos")?.addEventListener("click", () => abrir("tela-configuracoes"));
    document.getElementById("btn-plano-mensal")?.addEventListener("click", () => assinar("pro_mensal"));
    document.getElementById("btn-plano-anual")?.addEventListener("click", () => assinar("pro_anual"));
    pintar();
  }

  return { temPro, exigirPro, pintar, abrir, sincronizar, init };
})();

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
        status.textContent = "Pelada Pro ativo nesta conta (desenvolvimento, sem cobrança).";
      } else {
        const tipo = a.trial ? "Teste Pro" : "Pelada Pro";
        const ate = a.expiraEmTexto ? ` até ${a.expiraEmTexto}` : "";
        status.textContent = `${tipo} ativo${ate}.`;
      }
    } else {
        status.textContent = "Plano grátis — até 3 times, sorteio, placar, gol e ver a súmula.";
    }
  }

  function abrir(origem) {
    if (typeof estado !== "undefined") {
      estado.telaAntesPlanos = origem || "tela-configuracoes";
    }
    pintar();
    mostrarTela("tela-planos");
  }

  function escaparHtml(texto) {
    return String(texto || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function mostrarPaywallPro(mensagem) {
    const a = assinatura();
    if (a.cortesia) {
      toast("Sua conta já tem o Pelada Pro liberado.");
      return;
    }

    const nativo = typeof isAppNativo === "function" && isAppNativo();
    const msg = mensagem || "Esse recurso faz parte do Pelada Pro.";
    const corpo = nativo
      ? `<div class="paywall">
           <p class="paywall-selo">Pelada Pro</p>
           <p class="paywall-lead">Faça o upgrade da conta</p>
           <p class="paywall-msg">${escaparHtml(msg)}</p>
           <p class="dica">No app Android a assinatura entra pela Play Store. O teste de 7 dias já vale nesta conta.</p>
         </div>`
      : `<div class="paywall">
           <p class="paywall-selo">Pelada Pro</p>
           <p class="paywall-lead">Faça o upgrade da conta</p>
           <p class="paywall-msg">${escaparHtml(msg)}</p>
           <ul class="paywall-lista">
             <li>4 e 5 times no sorteio</li>
             <li>Cartões amarelo e vermelho</li>
             <li>PDF e WhatsApp da súmula</li>
             <li>Caixa da pelada e relatório do mês</li>
           </ul>
           <div class="paywall-ofertas">
             <article class="paywall-oferta paywall-oferta-destaque">
               <p class="paywall-tag">Mais vantajoso</p>
               <strong>Anual</strong>
               <p class="paywall-preco">R$ 349,90<span>/ano</span></p>
               <p class="paywall-equiv">~R$ 29,15/mês · Pix ou cartão</p>
               <button type="button" class="btn btn-principal" id="paywall-btn-anual">Assinar anual</button>
             </article>
             <article class="paywall-oferta">
               <strong>Mensal</strong>
               <p class="paywall-preco">R$ 49,90<span>/mês</span></p>
               <p class="paywall-equiv">Pix ou cartão · cancela quando quiser</p>
               <button type="button" class="btn btn-secundario" id="paywall-btn-mensal">Assinar mensal</button>
             </article>
           </div>
           <button type="button" class="btn btn-secundario paywall-ver-planos" id="paywall-ver-planos">Ver todos os planos</button>
         </div>`;

    if (typeof abrirModal !== "function") {
      abrir(document.querySelector(".tela.ativa")?.id || "tela-inicio");
      toast(msg);
      return;
    }

    abrirModal("Upgrade para Pro", corpo);
    document.getElementById("modal")?.classList.add("modal-paywall");
    document.getElementById("paywall-btn-anual")?.addEventListener("click", () => {
      if (typeof fecharModal === "function") fecharModal();
      assinar("pro_anual");
    });
    document.getElementById("paywall-btn-mensal")?.addEventListener("click", () => {
      if (typeof fecharModal === "function") fecharModal();
      assinar("pro_mensal");
    });
    document.getElementById("paywall-ver-planos")?.addEventListener("click", () => {
      if (typeof fecharModal === "function") fecharModal();
      abrir(document.querySelector(".tela.ativa")?.id || "tela-inicio");
    });
  }

  function exigirPro(mensagem) {
    if (temPro()) return true;
    mostrarPaywallPro(mensagem);
    return false;
  }

  /** Ao escolher 4 ou 5 times sem Pro: abre o modal e volta o select para 3. */
  function protegerSelectQtdTimes(selectEl) {
    if (!selectEl) return;
    selectEl.addEventListener("change", () => {
      const n = Number(selectEl.value) || 2;
      if (n <= 3) return;
      if (temPro()) return;
      selectEl.value = "3";
      mostrarPaywallPro("4 e 5 times fazem parte do Pelada Pro. Faça o upgrade para liberar.");
    });
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
    protegerSelectQtdTimes(document.getElementById("qtd-times"));
    protegerSelectQtdTimes(document.getElementById("cfg-qtd-times"));
    pintar();
  }

  return { temPro, exigirPro, mostrarPaywallPro, pintar, abrir, sincronizar, init };
})();

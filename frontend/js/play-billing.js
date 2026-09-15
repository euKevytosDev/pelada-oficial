/**
 * Google Play Billing (assinaturas) — só no app nativo Android.
 * Produto: reidapelada_pro · planos base: mensal | anual
 */
const PlayBillingApp = (() => {
  const PACKAGE = "com.rkds.reidapelada";
  const PRODUCT_ID = "reidapelada_pro";
  const PLANOS = {
    mensal: { planId: "mensal", label: "Mensal", preco: "R$ 49,90" },
    anual: { planId: "anual", label: "Anual", preco: "R$ 349,90" },
  };

  function plugin() {
    return window.Capacitor?.Plugins?.NativePurchases || null;
  }

  function disponivel() {
    return typeof isAppNativo === "function" && isAppNativo() && !!plugin();
  }

  async function comprar(planKey) {
    const np = plugin();
    if (!np) throw new Error("Compras na Play indisponíveis neste aparelho");
    const plano = PLANOS[planKey];
    if (!plano) throw new Error("Plano inválido");
    if (!getToken()) {
      mostrarTela("tela-auth");
      throw new Error("Entre na conta para assinar");
    }

    const tx = await np.purchaseProduct({
      productIdentifier: PRODUCT_ID,
      planIdentifier: plano.planId,
      productType: "subs",
      autoAcknowledgePurchases: false,
    });

    const purchaseToken = tx?.purchaseToken || tx?.transactionId;
    if (!purchaseToken) throw new Error("A Play não devolveu o token da compra");

    await PeladaAPI.verificarCompraPlay({
      packageName: PACKAGE,
      productId: PRODUCT_ID,
      planId: plano.planId,
      purchaseToken,
      orderId: tx?.transactionId || null,
    });

    try {
      await np.acknowledgePurchase({ purchaseToken });
    } catch (_) {
      /* backend já ativou; acknowledge pode falhar se a Play já reconheceu */
    }

    if (typeof PlanoApp !== "undefined") await PlanoApp.sincronizar();
    return tx;
  }

  async function restaurar() {
    const np = plugin();
    if (!np) throw new Error("Compras na Play indisponíveis neste aparelho");
    if (!getToken()) {
      mostrarTela("tela-auth");
      throw new Error("Entre na conta para restaurar");
    }

    await np.restorePurchases();
    const { purchases } = await np.getPurchases({ productType: "subs" });
    const lista = Array.isArray(purchases) ? purchases : [];
    const ativas = lista.filter(
      (p) =>
        p &&
        (p.productIdentifier === PRODUCT_ID || p.productId === PRODUCT_ID) &&
        p.purchaseToken &&
        (p.isActive === true || p.purchaseState === "1" || p.purchaseState === 1)
    );

    if (!ativas.length) {
      throw new Error("Nenhuma assinatura ativa encontrada nesta conta Google Play");
    }

    let ok = 0;
    for (const p of ativas) {
      try {
        await PeladaAPI.verificarCompraPlay({
          packageName: PACKAGE,
          productId: PRODUCT_ID,
          planId: null,
          purchaseToken: p.purchaseToken,
          orderId: p.transactionId || null,
        });
        try {
          await np.acknowledgePurchase({ purchaseToken: p.purchaseToken });
        } catch (_) {
          /* ignore */
        }
        ok += 1;
      } catch (_) {
        /* tenta a próxima */
      }
    }
    if (!ok) throw new Error("Não foi possível validar a assinatura no servidor");
    if (typeof PlanoApp !== "undefined") await PlanoApp.sincronizar();
    return ok;
  }

  return {
    PRODUCT_ID,
    PLANOS,
    disponivel,
    comprar,
    restaurar,
  };
})();

/** Salva PDF no app nativo (WebView não baixa via .save() do html2pdf). */

function blobParaBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const raw = String(reader.result || "");
      resolve(raw.includes(",") ? raw.split(",")[1] : raw);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/** Nome que o usuário colocou na pelada + .pdf (sem "resumo"/"súmula"). */
function nomeArquivoPdfDaPelada(nome) {
  let limpo = String(nome || "")
    .trim()
    .replace(/\.pdf$/i, "")
    .trim();
  limpo = limpo.replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, " ").trim();
  if (!limpo) limpo = "Pelada";
  return `${limpo}.pdf`;
}

function nomePdfSeguro(filename) {
  return nomeArquivoPdfDaPelada(filename);
}

async function salvarPdfBlob(blob, filename) {
  const safe = nomeArquivoPdfDaPelada(filename);
  const file = new File([blob], safe, { type: "application/pdf" });

  try {
    if (navigator.share && typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: safe });
      if (typeof toast === "function") toast("PDF pronto — escolha onde salvar");
      return;
    }
  } catch (err) {
    if (err?.name === "AbortError") return;
  }

  const cap = window.Capacitor;
  const fs = cap?.Plugins?.Filesystem;
  const share = cap?.Plugins?.Share;
  if (fs && share && typeof cap.isNativePlatform === "function" && cap.isNativePlatform()) {
    const data = await blobParaBase64(blob);
    const path = safe.replace(/\//g, "_");
    const written = await fs.writeFile({
      path,
      data,
      directory: "CACHE",
      recursive: true,
    });
    let uri = written?.uri;
    if (!uri) {
      const got = await fs.getUri({ path, directory: "CACHE" });
      uri = got?.uri;
    }
    if (uri) {
      await share.share({
        files: [uri],
        dialogTitle: "Salvar PDF",
        title: safe,
      });
      if (typeof toast === "function") toast("PDF pronto — escolha onde salvar");
      return;
    }
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = safe;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 8000);
  if (typeof toast === "function") toast("PDF baixado");
}

function opcoesPdfPadrao(filename) {
  return {
    margin: [10, 10, 10, 10],
    filename: filename || "documento.pdf",
    image: { type: "jpeg", quality: 0.98 },
    html2canvas: { scale: 4, useCORS: true, logging: false, scrollY: 0 },
    jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
    pagebreak: {
      mode: ["css", "legacy"],
      avoid: [
        ".premios-par",
        ".premio-com-foto",
        ".campeao-foto-hero",
        ".time-resumo",
        ".time-resumo-campeao",
        ".partida-resumo-item",
      ],
    },
  };
}

async function html2pdfBlob(element, opt) {
  if (typeof html2pdf === "undefined") {
    throw new Error("Gerador de PDF indisponível");
  }
  element.classList.add("pdf-export");
  const estiloEl = element.getAttribute("style");
  const relatorio = !!element.querySelector(".rel-folha");
  const larguraMm = relatorio ? 180 : 190;
  element.style.setProperty("width", `${larguraMm}mm`, "important");
  element.style.setProperty("max-width", `${larguraMm}mm`, "important");
  element.style.setProperty("min-width", "0", "important");
  element.style.setProperty("box-sizing", "border-box", "important");
  if (relatorio) {
    element.style.setProperty("overflow", "hidden", "important");
    element.style.setProperty("margin-left", "auto", "important");
    element.style.setProperty("margin-right", "auto", "important");
  }
  const soltarFotos = await encaixarFotosNosCards(element);
  ajustarRelatorioParaCaber(element);
  const optPdf = relatorio
    ? {
        ...opt,
        margin: [10, 12, 10, 12],
        html2canvas: {
          ...(opt.html2canvas || {}),
          scrollX: 0,
          scrollY: 0,
          windowWidth: Math.max(window.innerWidth || 0, Math.ceil(element.scrollWidth || 0), 800),
        },
      }
    : opt;
  try {
    return await html2pdf().set(optPdf).from(element).outputPdf("blob");
  } finally {
    element.querySelector(".rel-folha")?.style.removeProperty("font-size");
    const listaPeladas = element.querySelector(".rel-peladas");
    if (listaPeladas) {
      listaPeladas.style.removeProperty("break-before");
      listaPeladas.style.removeProperty("page-break-before");
    }
    soltarFotos();
    if (estiloEl == null) element.removeAttribute("style");
    else element.setAttribute("style", estiloEl);
    element.classList.remove("pdf-export");
  }
}

/**
 * Coloca a foto no card com zoom uniforme.
 * Se não couber, corta laterais e a parte de baixo — nunca estica.
 */
async function encaixarFotosNosCards(element) {
  const restaurar = [];
  const soltarPremios = expandirPremiosNaFolha(element);

  element.querySelectorAll(".premio-foto-wrap").forEach((wrap) => {
    const img = wrap.querySelector("img.premio-foto");
    aplicarFotoNoCard(img, wrap, true, restaurar);
  });

  element.querySelectorAll(".campeao-foto-wrap").forEach((wrap) => {
    const img = wrap.querySelector("img.campeao-foto-img");
    aplicarFotoCampeao(img, wrap, restaurar);
  });

  return () => {
    restaurar.forEach((voltar) => voltar());
    soltarPremios();
  };
}

/** A premiação ocupa o que sobra da folha, para a foto não ficar na metade. */
function expandirPremiosNaFolha(element) {
  const capa = element.querySelector(".resumo-capa-pdf");
  const bloco = capa?.querySelector(".premios-grid--fotos");
  if (!capa || !bloco) return () => {};
  const grade = bloco.querySelector(".premios");
  const pares = [...bloco.querySelectorAll(".premios-par")];
  const cards = [...bloco.querySelectorAll(".premio-com-foto")];
  const estilo = guardarEstilo(bloco);
  const estiloGrade = guardarEstilo(grade);
  const estilosPares = pares.map((par) => guardarEstilo(par));
  const estilosCards = cards.map((card) => guardarEstilo(card));
  bloco.querySelectorAll("img.premio-foto").forEach((img) => {
    img.style.setProperty("position", "absolute", "important");
  });
  const acima = bloco.getBoundingClientRect().top - capa.getBoundingClientRect().top;
  const sobra = Math.max(160, Math.round(capa.clientHeight - acima - 4));
  bloco.style.setProperty("height", `${sobra}px`, "important");
  bloco.style.setProperty("min-height", `${sobra}px`, "important");
  bloco.style.setProperty("max-height", `${sobra}px`, "important");
  bloco.style.setProperty("display", "flex", "important");
  bloco.style.setProperty("flex-direction", "column", "important");
  bloco.style.setProperty("overflow", "hidden", "important");
  bloco.style.setProperty("box-sizing", "border-box", "important");
  if (grade) {
    grade.style.setProperty("flex", "1 1 auto", "important");
    grade.style.setProperty("height", "100%", "important");
    grade.style.setProperty("min-height", "0", "important");
    grade.style.setProperty("display", "flex", "important");
    grade.style.setProperty("flex-direction", "column", "important");
  }
  pares.forEach((par) => {
    par.style.setProperty("flex", "1 1 0", "important");
    par.style.setProperty("min-height", "0", "important");
    par.style.setProperty("height", "auto", "important");
    par.style.setProperty("grid-template-rows", "1fr", "important");
    par.style.setProperty("align-items", "stretch", "important");
  });
  cards.forEach((card) => {
    card.style.setProperty("height", "100%", "important");
    card.style.setProperty("min-height", "0", "important");
    card.style.setProperty("max-height", "none", "important");
  });
  bloco.offsetHeight;
  return () => {
    restaurarEstilo(bloco, estilo);
    restaurarEstilo(grade, estiloGrade);
    pares.forEach((par, i) => restaurarEstilo(par, estilosPares[i]));
    cards.forEach((card, i) => restaurarEstilo(card, estilosCards[i]));
  };
}

/** Mensal ocupa 1 folha. Anual e período tentam 1 e, se não couber, passam a lista de peladas para a 2ª. */
function ajustarRelatorioParaCaber(element) {
  const folha = element.querySelector(".rel-folha");
  if (!folha) return;
  const modo = folha.dataset.modo || "mes";
  const larguraMm = parseFloat(element.style.width) || 180;
  const pxPorMm = (element.clientWidth || 1) / larguraMm;
  const uma = 272 * pxPorMm;
  const duas = 540 * pxPorMm;
  const peladas = folha.querySelector(".rel-peladas");
  let size = modo === "mes" ? 12.5 : 11;
  const aplicar = (n) => {
    size = Math.round(n * 100) / 100;
    folha.style.fontSize = `${size}px`;
  };
  aplicar(size);

  if (modo === "mes") {
    while (element.scrollHeight > uma + 2 && size > 8) aplicar(size - 0.25);
    while (size < 17 && element.scrollHeight < uma * 0.9) {
      const antes = element.scrollHeight;
      aplicar(size + 0.25);
      if (element.scrollHeight > uma) {
        aplicar(size - 0.25);
        break;
      }
      if (element.scrollHeight <= antes) break;
    }
    return;
  }

  while (element.scrollHeight > uma + 2 && size > 8.6) aplicar(size - 0.2);
  if (element.scrollHeight <= uma + 2) return;

  aplicar(10.5);
  if (peladas) {
    peladas.style.breakBefore = "page";
    peladas.style.pageBreakBefore = "always";
  }
  const antesDaLista = () => {
    if (!peladas) return element.scrollHeight;
    return peladas.getBoundingClientRect().top - element.getBoundingClientRect().top;
  };
  while (antesDaLista() > uma + 2 && size > 7.4) aplicar(size - 0.2);
  while (element.scrollHeight > duas + 2 && size > 7.2) aplicar(size - 0.2);
}

function guardarEstilo(el) {
  return el ? el.getAttribute("style") : null;
}

function restaurarEstilo(el, estilo) {
  if (!el) return;
  if (estilo == null) el.removeAttribute("style");
  else el.setAttribute("style", estilo);
}

function aplicarFotoNoCard(img, wrap, fadeTopo, restaurar) {
  if (!img || !img.naturalWidth || !img.naturalHeight) return;
  const card = wrap.closest(".premio-com-foto") || wrap;
  card.style.setProperty("width", "100%", "important");
  card.style.setProperty("max-width", "none", "important");
  card.style.setProperty("justify-self", "stretch", "important");
  soltarImagemDoFluxo(wrap, img);
  const cssW = Math.round(card.getBoundingClientRect().width);
  const cssH = Math.round(card.getBoundingClientRect().height);
  if (cssW < 8 || cssH < 8) return;
  colocarCanvasZoom(img, wrap, cssW, cssH, fadeTopo, restaurar, card);
}

function aplicarFotoCampeao(img, wrap, restaurar) {
  if (!img || !img.naturalWidth || !img.naturalHeight) return;
  const hero = wrap.closest(".campeao-foto-hero") || wrap.parentElement || wrap;
  const cssW = Math.round(hero.clientWidth || wrap.clientWidth || 0);
  if (cssW < 8) return;
  const alturaNatural = Math.round(cssW * (img.naturalHeight / img.naturalWidth));
  const cssH = Math.max(1, Math.min(alturaNatural, alturaQueCabeNaFolha(wrap, cssW, restaurar)));
  colocarCanvasZoom(img, wrap, cssW, cssH, false, restaurar, wrap);
  apararFotoSeAindaCortar(img, wrap, cssW, cssH, restaurar);
}

/** Deixa a foto do campeão só um pouco menor, para os nomes dos times caberem. */
function alturaQueCabeNaFolha(wrap, cssW, restaurar) {
  const pagina = wrap.closest(".resumo-pagina-campeao-pdf");
  if (!pagina) return cssW;
  const times = pagina.querySelector(".resumo-times");
  if (times) {
    const estiloTimes = guardarEstilo(times);
    const grade = times.querySelector(".times-resumo-grid");
    const estiloGrade = guardarEstilo(grade);
    const cards = [...times.querySelectorAll(".time-resumo")];
    const estilosCards = cards.map((card) => guardarEstilo(card));
    times.style.setProperty("flex", "none", "important");
    times.style.setProperty("height", "auto", "important");
    times.style.setProperty("overflow", "visible", "important");
    cards.forEach((card) => {
      card.style.setProperty("height", "auto", "important");
      card.style.setProperty("max-height", "none", "important");
      card.style.setProperty("overflow", "visible", "important");
    });
    if (grade) {
      grade.style.setProperty("height", "auto", "important");
      grade.style.setProperty("grid-auto-rows", "auto", "important");
    }
    restaurar.push(() => {
      restaurarEstilo(times, estiloTimes);
      restaurarEstilo(grade, estiloGrade);
      cards.forEach((card, i) => restaurarEstilo(card, estilosCards[i]));
    });
  }
  const titulo = pagina.querySelector(".campeao-foto-titulo");
  const tituloH = titulo ? titulo.offsetHeight : 0;
  const timesH = times ? times.offsetHeight : 0;
  const estiloPagina = getComputedStyle(pagina);
  const padTop = parseFloat(estiloPagina.paddingTop) || 0;
  const padBot = parseFloat(estiloPagina.paddingBottom) || 0;
  const hero = wrap.closest(".campeao-foto-hero");
  const estiloHero = hero ? getComputedStyle(hero) : null;
  const heroMb = estiloHero ? parseFloat(estiloHero.marginBottom) || 0 : 0;
  const heroGap = estiloHero ? parseFloat(estiloHero.rowGap || estiloHero.gap) || 0 : 0;
  const timesMt = times ? parseFloat(getComputedStyle(times).marginTop) || 0 : 0;
  const folga = 36;
  return Math.max(
    140,
    pagina.clientHeight - padTop - padBot - tituloH - heroGap - heroMb - timesH - timesMt - folga
  );
}

function apararFotoSeAindaCortar(img, wrap, cssW, cssH, restaurar) {
  const pagina = wrap.closest(".resumo-pagina-campeao-pdf");
  if (!pagina) return;
  const estouro = pagina.scrollHeight - pagina.clientHeight;
  if (estouro <= 1) return;
  wrap.querySelector("canvas")?.remove();
  const novoH = Math.max(120, Math.round(cssH - estouro - 20));
  const canvas = criarCanvasZoom(img, cssW, novoH, false);
  if (!canvas) return;
  wrap.appendChild(canvas);
  travarCaixaPx(wrap, cssW, novoH);
  restaurar.push(() => canvas.remove());
}

function soltarImagemDoFluxo(wrap, img) {
  wrap.style.setProperty("width", "100%", "important");
  wrap.style.setProperty("height", "100%", "important");
  wrap.style.setProperty("flex", "1 1 auto", "important");
  wrap.style.setProperty("min-height", "0", "important");
  wrap.style.setProperty("position", "relative", "important");
  img.style.setProperty("position", "absolute", "important");
}

/**
 * Desenha a foto numa escala só. O que sobra nas laterais e embaixo é cortado.
 * O canvas entra no PDF já no tamanho do card, para o gerador não esticar.
 */
function colocarCanvasZoom(img, wrap, cssW, cssH, fadeTopo, restaurar, caixa) {
  const canvas = criarCanvasZoom(img, cssW, cssH, fadeTopo);
  if (!canvas) return;
  const estiloImg = guardarEstilo(img);
  const estiloWrap = guardarEstilo(wrap);
  const estiloCaixa = caixa !== wrap ? guardarEstilo(caixa) : null;
  img.style.setProperty("display", "none", "important");
  wrap.appendChild(canvas);
  travarCaixaPx(wrap, cssW, cssH);
  if (caixa !== wrap) travarCaixaPx(caixa, cssW, cssH);
  restaurar.push(() => {
    canvas.remove();
    restaurarEstilo(img, estiloImg);
    restaurarEstilo(wrap, estiloWrap);
    if (caixa !== wrap) restaurarEstilo(caixa, estiloCaixa);
  });
}

function travarCaixaPx(el, cssW, cssH) {
  const w = `${cssW}px`;
  const h = `${cssH}px`;
  el.style.setProperty("width", w, "important");
  el.style.setProperty("height", h, "important");
  el.style.setProperty("min-width", w, "important");
  el.style.setProperty("min-height", h, "important");
  el.style.setProperty("max-width", w, "important");
  el.style.setProperty("max-height", h, "important");
  el.style.setProperty("flex", "none", "important");
  el.style.setProperty("aspect-ratio", "auto", "important");
  el.style.position = "relative";
  el.style.overflow = "hidden";
  el.style.background = "transparent";
}

function criarCanvasZoom(img, cssW, cssH, fadeTopo) {
  const dpr = 4;
  const dw = Math.max(1, Math.round(cssW * dpr));
  const dh = Math.max(1, Math.round(cssH * dpr));
  const canvas = document.createElement("canvas");
  canvas.width = dw;
  canvas.height = dh;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const nw = img.naturalWidth;
  const nh = img.naturalHeight;
  const escala = Math.max(dw / nw, dh / nh);
  const sw = dw / escala;
  const sh = dh / escala;
  const sx = Math.max(0, (nw - sw) / 2);
  const sy = 0;

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, dw, dh);
  pintarFadeTopo(ctx, dw, dh, fadeTopo);

  canvas.style.setProperty("position", "absolute", "important");
  canvas.style.setProperty("left", "0", "important");
  canvas.style.setProperty("top", "0", "important");
  canvas.style.setProperty("width", `${cssW}px`, "important");
  canvas.style.setProperty("height", `${cssH}px`, "important");
  canvas.style.setProperty("max-width", "none", "important");
  canvas.style.setProperty("max-height", "none", "important");
  canvas.style.setProperty("display", "block", "important");
  return canvas;
}

function pintarFadeTopo(ctx, dw, dh, fadeTopo) {
  if (!fadeTopo) return;
  const alturaFade = dh * 0.2;
  const g = ctx.createLinearGradient(0, 0, 0, alturaFade);
  g.addColorStop(0, "rgba(5, 22, 16, 0.62)");
  g.addColorStop(1, "rgba(5, 22, 16, 0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, dw, Math.round(alturaFade));
}

async function baixarPdfHtml(element, opt) {
  const blob = await html2pdfBlob(element, opt);
  await salvarPdfBlob(blob, opt.filename || "documento.pdf");
}

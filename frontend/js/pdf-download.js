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

function nomePdfSeguro(filename) {
  const base = String(filename || "documento.pdf").trim() || "documento.pdf";
  return base.endsWith(".pdf") ? base : `${base}.pdf`;
}

async function salvarPdfBlob(blob, filename) {
  const safe = nomePdfSeguro(filename).replace(/[^\w.\-]+/g, "_");
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
  const soltarFotos = await encaixarFotosNosCards(element);
  try {
    return await html2pdf().set(opt).from(element).outputPdf("blob");
  } finally {
    soltarFotos();
    element.classList.remove("pdf-export");
  }
}

/**
 * Premiação: foto na proporção original, cortando o que sobra embaixo.
 * Time campeão: mais alta, cortando as laterais, para não ficar uma faixa fina.
 */
async function encaixarFotosNosCards(element) {
  const restaurar = [];
  const esperas = [];

  element.querySelectorAll(".premio-foto-wrap").forEach((wrap) => {
    const img = wrap.querySelector("img.premio-foto");
    aplicarFotoNoCard(img, wrap, true, restaurar, esperas);
  });

  element.querySelectorAll(".campeao-foto-wrap").forEach((wrap) => {
    const img = wrap.querySelector("img.campeao-foto-img");
    aplicarFotoCampeao(img, wrap, restaurar, esperas);
  });

  await Promise.all(esperas);
  return () => {
    restaurar.forEach((voltar) => voltar());
  };
}

function guardarEstilo(el) {
  return el ? el.getAttribute("style") : null;
}

function restaurarEstilo(el, estilo) {
  if (!el) return;
  if (estilo == null) el.removeAttribute("style");
  else el.setAttribute("style", estilo);
}

function aplicarFotoNoCard(img, wrap, fadeTopo, restaurar, esperas) {
  if (!img || !img.naturalWidth || !img.naturalHeight) return;
  ocuparCardInteiro(wrap, img);
  const card = wrap.closest(".premio-com-foto") || wrap;
  const cssW = Math.round(card.clientWidth);
  const cssH = Math.round(card.clientHeight);
  if (cssW < 8 || cssH < 8) return;
  const url = fotoOriginalCortandoBaixo(img, cssW, cssH, fadeTopo);
  if (!url) return;
  const src = img.getAttribute("src");
  const estiloImg = guardarEstilo(img);
  const estiloWrap = guardarEstilo(wrap);
  img.setAttribute("src", url);
  preencherCard(wrap, img, cssH);
  esperas.push(esperarImagem(img));
  restaurar.push(() => {
    if (src == null) img.removeAttribute("src");
    else img.setAttribute("src", src);
    restaurarEstilo(img, estiloImg);
    restaurarEstilo(wrap, estiloWrap);
  });
}

function aplicarFotoCampeao(img, wrap, restaurar, esperas) {
  if (!img || !img.naturalWidth || !img.naturalHeight) return;
  const hero = wrap.closest(".campeao-foto-hero") || wrap.parentElement || wrap;
  const cssW = Math.round(hero.clientWidth || wrap.clientWidth || 0);
  if (cssW < 8) return;
  const nw = img.naturalWidth;
  const nh = img.naturalHeight;
  const alvo = 1;
  let sx = 0;
  let sw = nw;
  if (nw / nh > alvo) {
    sw = nh * alvo;
    sx = (nw - sw) / 2;
  }
  const cssH = Math.max(1, Math.round(cssW * (nh / sw)));
  const url = fotoCampeaoCortandoLados(img, cssW, cssH, sx, sw);
  if (!url) return;
  const src = img.getAttribute("src");
  const estiloImg = guardarEstilo(img);
  const estiloWrap = guardarEstilo(wrap);
  img.setAttribute("src", url);
  preencherCard(wrap, img, cssH);
  esperas.push(esperarImagem(img));
  restaurar.push(() => {
    if (src == null) img.removeAttribute("src");
    else img.setAttribute("src", src);
    restaurarEstilo(img, estiloImg);
    restaurarEstilo(wrap, estiloWrap);
  });
}

function esperarImagem(img) {
  if (typeof img.decode === "function") return img.decode().catch(() => {});
  return new Promise((resolve) => {
    if (img.complete && img.naturalWidth) resolve();
    else {
      img.onload = () => resolve();
      img.onerror = () => resolve();
    }
  });
}

/** Faz a caixa ocupar o card antes de medir, para a foto não nascer pela metade. */
function ocuparCardInteiro(wrap, img) {
  wrap.style.setProperty("width", "100%", "important");
  wrap.style.setProperty("height", "100%", "important");
  wrap.style.setProperty("flex", "1 1 auto", "important");
  wrap.style.setProperty("min-height", "0", "important");
  wrap.style.setProperty("position", "relative", "important");
  img.style.setProperty("position", "absolute", "important");
  img.style.setProperty("inset", "0", "important");
  img.style.setProperty("width", "100%", "important");
  img.style.setProperty("height", "100%", "important");
}

/** Foto cobre o card inteiro. O recorte já está na proporção da caixa, então não estica. */
function preencherCard(wrap, img, cssH) {
  const h = `${cssH}px`;
  wrap.style.setProperty("width", "100%", "important");
  wrap.style.setProperty("height", h, "important");
  wrap.style.setProperty("min-height", h, "important");
  wrap.style.setProperty("flex", "1 1 auto", "important");
  wrap.style.setProperty("aspect-ratio", "auto", "important");
  wrap.style.background = "transparent";
  wrap.style.overflow = "hidden";
  wrap.style.position = "relative";

  img.style.setProperty("position", "absolute", "important");
  img.style.setProperty("inset", "0", "important");
  img.style.setProperty("display", "block", "important");
  img.style.setProperty("width", "100%", "important");
  img.style.setProperty("height", "100%", "important");
  img.style.setProperty("min-width", "100%", "important");
  img.style.setProperty("min-height", "100%", "important");
  img.style.setProperty("max-width", "none", "important");
  img.style.setProperty("max-height", "none", "important");
  img.style.setProperty("object-fit", "fill", "important");
  img.removeAttribute("width");
  img.removeAttribute("height");
}

/** Largura inteira da foto, mesma proporção, corta o excesso embaixo. */
function fotoOriginalCortandoBaixo(img, cssW, cssH, fadeTopo) {
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
  const extraY = Math.max(0, nh - sh);
  const sy = Math.min(nh * 0.04, extraY);
  const sx = Math.max(0, (nw - sw) / 2);

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, dw, dh);
  pintarFadeTopo(ctx, dw, dh, fadeTopo);
  return canvas.toDataURL("image/png");
}

/** Time campeão: corta só as laterais e amplia na mesma proporção. */
function fotoCampeaoCortandoLados(img, cssW, cssH, sx, sw) {
  const dpr = 4;
  const dw = Math.max(1, Math.round(cssW * dpr));
  const dh = Math.max(1, Math.round(cssH * dpr));
  const canvas = document.createElement("canvas");
  canvas.width = dw;
  canvas.height = dh;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, sx, 0, sw, img.naturalHeight, 0, 0, dw, dh);
  return canvas.toDataURL("image/png");
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

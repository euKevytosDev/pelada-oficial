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
    image: { type: "jpeg", quality: 0.94 },
    html2canvas: { scale: 3, useCORS: true, logging: false, scrollY: 0 },
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
  const soltarFotos = encaixarFotosNosCards(element);
  try {
    return await html2pdf().set(opt).from(element).outputPdf("blob");
  } finally {
    soltarFotos();
    element.classList.remove("pdf-export");
  }
}

/**
 * Corta só um pouco em cima e um pouco mais embaixo, sem achatar o jogador.
 * O escurecido do nome vai na própria imagem para não virar linha preta no celular.
 */
function encaixarFotosNosCards(element) {
  const restaurar = [];

  element.querySelectorAll(".premio-foto-wrap").forEach((wrap) => {
    const img = wrap.querySelector("img.premio-foto");
    aplicarRecorteLeve(img, wrap.clientWidth, true, restaurar);
  });

  element.querySelectorAll(".campeao-foto-wrap").forEach((wrap) => {
    const img = wrap.querySelector("img.campeao-foto-img");
    aplicarRecorteLeve(img, wrap.clientWidth, false, restaurar);
  });

  return () => {
    restaurar.forEach((voltar) => voltar());
  };
}

function aplicarRecorteLeve(img, cssW, fadeTopo, restaurar) {
  if (!img || !img.naturalWidth || !img.naturalHeight || cssW < 8) return;
  const preparado = fotoRecorteLeve(img, cssW, fadeTopo);
  if (!preparado) return;
  const src = img.getAttribute("src");
  const estilo = img.getAttribute("style");
  img.setAttribute("src", preparado.url);
  img.style.position = "static";
  img.style.width = "100%";
  img.style.height = `${preparado.cssH}px`;
  img.style.maxHeight = "none";
  img.style.objectFit = "contain";
  restaurar.push(() => {
    if (src == null) img.removeAttribute("src");
    else img.setAttribute("src", src);
    if (estilo == null) img.removeAttribute("style");
    else img.setAttribute("style", estilo);
  });
}

function fotoRecorteLeve(img, cssW, fadeTopo) {
  const dpr = 3;
  const corteTopo = 0.05;
  const corteBaixo = 0.11;
  const sw = img.naturalWidth;
  const sh = img.naturalHeight * (1 - corteTopo - corteBaixo);
  const sy = img.naturalHeight * corteTopo;
  const dw = Math.max(1, Math.round(cssW * dpr));
  const dh = Math.max(1, Math.round(dw * (sh / sw)));
  const canvas = document.createElement("canvas");
  canvas.width = dw;
  canvas.height = dh;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, sy, sw, sh, 0, 0, dw, dh);

  if (fadeTopo) {
    const alturaFade = dh * 0.2;
    const g = ctx.createLinearGradient(0, 0, 0, alturaFade);
    g.addColorStop(0, "rgba(5, 22, 16, 0.62)");
    g.addColorStop(1, "rgba(5, 22, 16, 0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, dw, Math.round(alturaFade));
  }

  return {
    url: canvas.toDataURL("image/png"),
    cssH: Math.max(1, Math.round(cssW * (sh / sw))),
  };
}

async function baixarPdfHtml(element, opt) {
  const blob = await html2pdfBlob(element, opt);
  await salvarPdfBlob(blob, opt.filename || "documento.pdf");
}

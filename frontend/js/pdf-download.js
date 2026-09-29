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
    image: { type: "jpeg", quality: 0.86 },
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
 * Recorta a foto no tamanho do card (sem esticar) e desenha o escurecido
 * atrás do nome direto na imagem. O degradê em CSS vira linha preta no celular.
 */
function encaixarFotosNosCards(element) {
  const restaurar = [];

  element.querySelectorAll(".premio-foto-wrap").forEach((wrap) => {
    const img = wrap.querySelector("img.premio-foto");
    aplicarCover(img, wrap.clientWidth, wrap.clientHeight, true, restaurar);
  });

  element.querySelectorAll(".campeao-foto-wrap").forEach((wrap) => {
    const img = wrap.querySelector("img.campeao-foto-img");
    aplicarCover(img, wrap.clientWidth, wrap.clientHeight, false, restaurar);
  });

  return () => {
    restaurar.forEach(([img, src]) => img.setAttribute("src", src));
  };
}

function aplicarCover(img, w, h, fadeTopo, restaurar) {
  if (!img || !img.naturalWidth || !img.naturalHeight || w < 8 || h < 8) return;
  const anterior = img.getAttribute("src");
  const url = fotoCoverDataUrl(img, w, h, fadeTopo);
  if (!url) return;
  img.setAttribute("src", url);
  restaurar.push([img, anterior]);
}

function fotoCoverDataUrl(img, cssW, cssH, fadeTopo) {
  const dpr = 2;
  const dw = Math.max(1, Math.round(cssW * dpr));
  const dh = Math.max(1, Math.round(cssH * dpr));
  const canvas = document.createElement("canvas");
  canvas.width = dw;
  canvas.height = dh;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const ir = img.naturalWidth / img.naturalHeight;
  const dr = dw / dh;
  let sx = 0;
  let sy = 0;
  let sw = img.naturalWidth;
  let sh = img.naturalHeight;
  if (ir > dr) {
    sw = sh * dr;
    sx = (img.naturalWidth - sw) / 2;
  } else {
    sh = sw / dr;
    sy = (img.naturalHeight - sh) * 0.28;
  }

  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, dw, dh);

  if (fadeTopo) {
    const g = ctx.createLinearGradient(0, 0, 0, dh * 0.46);
    g.addColorStop(0, "rgba(5, 22, 16, 0.92)");
    g.addColorStop(0.55, "rgba(5, 22, 16, 0.55)");
    g.addColorStop(1, "rgba(5, 22, 16, 0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, dw, Math.round(dh * 0.46));
  }

  return canvas.toDataURL("image/jpeg", 0.92);
}

async function baixarPdfHtml(element, opt) {
  const blob = await html2pdfBlob(element, opt);
  await salvarPdfBlob(blob, opt.filename || "documento.pdf");
}

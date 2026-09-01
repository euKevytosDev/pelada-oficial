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
    html2canvas: { scale: 2, useCORS: true, logging: false, scrollY: 0 },
    jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
    pagebreak: {
      mode: ["css", "legacy"],
      before: [".resumo-pagina-campeao-pdf", ".resumo-pagina-stats-pdf"],
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
  try {
    return await html2pdf().set(opt).from(element).outputPdf("blob");
  } finally {
    element.classList.remove("pdf-export");
  }
}

async function baixarPdfHtml(element, opt) {
  const blob = await html2pdfBlob(element, opt);
  await salvarPdfBlob(blob, opt.filename || "documento.pdf");
}

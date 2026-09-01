/**
 * Fotos dos destaques na súmula (Pro) — galeria/câmera, aparecem no PDF.
 */
const FotosPremios = (() => {
  const SLOTS = [
    { key: "artilheiro", titulo: "Artilheiro", get: (p) => p.artilheiro || p.bolaDeOuro },
    { key: "craque", titulo: "Craque", get: (p) => p.craque },
    { key: "garcom", titulo: "Garçom", get: (p) => p.garcom },
    { key: "luvaDeOuro", titulo: "Luva de Ouro", get: (p) => p.luvaDeOuro },
  ];

  let fotos = {};
  let peladaId = null;

  function temPro() {
    return typeof PlanoApp !== "undefined" && PlanoApp.temPro();
  }

  function get(chave) {
    return fotos[chave] || null;
  }

  function limpar(novoPeladaId) {
    if (novoPeladaId != null && peladaId != null && String(novoPeladaId) !== String(peladaId)) {
      fotos = {};
    }
    if (novoPeladaId != null) peladaId = novoPeladaId;
  }

  function comprimirImagem(file, maxPx = 560, quality = 0.88) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        const targetRatio = 4 / 5;
        let sx = 0;
        let sy = 0;
        let sWidth = img.width;
        let sHeight = img.height;
        const imgRatio = sWidth / sHeight;

        if (imgRatio > targetRatio) {
          sWidth = sHeight * targetRatio;
          sx = (img.width - sWidth) / 2;
        } else {
          sHeight = sWidth / targetRatio;
          sy = Math.max(0, Math.min(img.height * 0.06, img.height - sHeight));
        }

        const outW = Math.min(maxPx, Math.round(sWidth));
        const outH = Math.round(outW / targetRatio);
        const canvas = document.createElement("canvas");
        canvas.width = outW;
        canvas.height = outH;
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "#0b3d2e";
        ctx.fillRect(0, 0, outW, outH);
        ctx.drawImage(img, sx, sy, sWidth, sHeight, 0, 0, outW, outH);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("Não foi possível ler a imagem"));
      };
      img.src = url;
    });
  }

  function escolherArquivo(origem) {
    return new Promise((resolve) => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "image/*";
      if (origem === "camera") input.capture = "environment";
      input.style.display = "none";
      document.body.appendChild(input);
      input.addEventListener(
        "change",
        () => {
          const file = input.files?.[0] || null;
          input.remove();
          resolve(file);
        },
        { once: true }
      );
      input.click();
    });
  }

  async function definirFoto(chave, origem) {
    const file = await escolherArquivo(origem);
    if (!file) return false;
    if (!file.type.startsWith("image/")) {
      toast("Escolha uma imagem");
      return false;
    }
    try {
      fotos[chave] = await comprimirImagem(file);
      return true;
    } catch (err) {
      toast(err.message || "Erro ao processar foto");
      return false;
    }
  }

  function removerFoto(chave) {
    delete fotos[chave];
  }

  function slotsAtivos(premios) {
    return SLOTS.filter((s) => s.get(premios || {}));
  }

  function renderPainel(premios) {
    const box = document.getElementById("box-fotos-premios");
    const lista = document.getElementById("lista-fotos-premios");
    if (!box || !lista) return;

    if (!temPro()) {
      box.classList.add("oculto");
      lista.innerHTML = "";
      return;
    }

    const ativos = slotsAtivos(premios);
    if (!ativos.length) {
      box.classList.add("oculto");
      lista.innerHTML = "";
      return;
    }

    box.classList.remove("oculto");
    lista.innerHTML = ativos
      .map((s) => {
        const premio = s.get(premios);
        const nome = premio?.nome || (premio?.nomes || [])[0] || "—";
        const foto = get(s.key);
        const preview = foto
          ? `<img class="foto-premio-thumb" src="${foto}" alt="" />`
          : `<span class="foto-premio-vazio" aria-hidden="true">📷</span>`;
        return `
        <div class="foto-premio-item" data-foto-key="${s.key}">
          ${preview}
          <div class="foto-premio-info">
            <strong>${s.titulo}</strong>
            <span>${nome}</span>
          </div>
          <div class="foto-premio-acoes">
            <button type="button" class="btn-mini" data-foto-acao="galeria" data-foto-key="${s.key}">Galeria</button>
            <button type="button" class="btn-mini" data-foto-acao="camera" data-foto-key="${s.key}">Foto</button>
            ${foto ? `<button type="button" class="btn-mini btn-link-perigo" data-foto-acao="remover" data-foto-key="${s.key}">Remover</button>` : ""}
          </div>
        </div>`;
      })
      .join("");
  }

  function syncPainel(resumo) {
    if (!resumo) return;
    limpar(resumo.pelada?.id ?? null);
    renderPainel(resumo.premios || {});
  }

  async function aguardarImagensResumo(el) {
    if (!el) return;
    const imgs = [...el.querySelectorAll("img.premio-foto")];
    await Promise.all(
      imgs.map(
        (img) =>
          new Promise((resolve) => {
            if (img.complete) resolve();
            else {
              img.onload = resolve;
              img.onerror = resolve;
            }
          })
      )
    );
  }

  let bound = false;
  function init() {
    if (bound) return;
    bound = true;
    const lista = document.getElementById("lista-fotos-premios");
    if (!lista) return;
    lista.addEventListener("click", async (e) => {
      const btn = e.target.closest("[data-foto-acao]");
      if (!btn) return;
      if (!temPro()) {
        PlanoApp.exigirPro("Fotos nos destaques do PDF fazem parte do Rei da Pelada Pro.");
        return;
      }
      const key = btn.dataset.fotoKey;
      const acao = btn.dataset.fotoAcao;
      if (acao === "remover") {
        removerFoto(key);
        if (estado.resumoAtual) {
          renderResumoOficial(estado.resumoAtual);
          syncPainel(estado.resumoAtual);
        }
        toast("Foto removida");
        return;
      }
      const ok = await definirFoto(key, acao === "camera" ? "camera" : "galeria");
      if (ok && estado.resumoAtual) {
        renderResumoOficial(estado.resumoAtual);
        syncPainel(estado.resumoAtual);
        toast("Foto adicionada — aparece no PDF");
      }
    });
  }

  return {
    SLOTS,
    get,
    limpar,
    syncPainel,
    aguardarImagensResumo,
    init,
    temPro,
  };
})();

/**
 * Fotos dos destaques na súmula (Pro) — galeria/câmera, aparecem no PDF.
 */
const FotosPremios = (() => {
  const SLOTS = [
    { key: "artilheiro", titulo: "Artilheiro", get: (p) => p.artilheiro || p.bolaDeOuro },
    { key: "craque", titulo: "Craque", get: (p) => p.craque },
    { key: "garcom", titulo: "Garçom", get: (p) => p.garcom },
    { key: "luvaDeOuro", titulo: "Luva de Ouro", get: (p) => p.goleiroCampeaoPenaltis || p.luvaDeOuro },
  ];

  const SLOT_CAMPEAO = {
    key: "campeao",
    titulo: "Time campeão",
    get: (p) => p.campeao,
    horizontal: true,
  };

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

  function prepararImagem(file, maxLado = 2400) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        const maior = Math.max(img.width, img.height) || 1;
        const escala = maior > maxLado ? maxLado / maior : 1;
        const outW = Math.max(1, Math.round(img.width * escala));
        const outH = Math.max(1, Math.round(img.height * escala));
        const canvas = document.createElement("canvas");
        canvas.width = outW;
        canvas.height = outH;
        const ctx = canvas.getContext("2d");
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(img, 0, 0, outW, outH);
        resolve(canvas.toDataURL("image/jpeg", 1));
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
      fotos[chave] = await prepararImagem(file, chave === "campeao" ? 3200 : 2400);
      if (origem === "camera") {
        try {
          return (await salvarNaGaleria(file)) ? "galeria" : "pdf";
        } catch (_) {
          return "pdf";
        }
      }
      return "pdf";
    } catch (err) {
      toast(err.message || "Erro ao processar foto");
      return false;
    }
  }

  function arquivoParaDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error("Não foi possível ler a foto"));
      reader.readAsDataURL(file);
    });
  }

  function baixarNoCelular(file) {
    const nome = `ReiDaPelada_${Date.now()}.jpg`;
    const url = URL.createObjectURL(file);
    const a = document.createElement("a");
    a.href = url;
    a.download = nome;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  async function albumReiDaPelada(media) {
    const achar = (lista) => (lista?.albums || []).find((a) => a.name === "Rei da Pelada");
    let achou = achar(await media.getAlbums());
    if (achou?.identifier) return achou.identifier;
    try {
      await media.createAlbum({ name: "Rei da Pelada" });
    } catch (_) {
      // a pasta já pode existir
    }
    achou = achar(await media.getAlbums());
    if (achou?.identifier) return achou.identifier;
    if (media.getAlbumsPath) {
      const caminho = await media.getAlbumsPath();
      if (caminho?.path) return `${String(caminho.path).replace(/\/$/, "")}/Rei da Pelada`;
    }
    return null;
  }

  async function salvarNaGaleria(file) {
    const cap = window.Capacitor;
    const media = cap?.Plugins?.Media;
    const nativo = typeof cap?.isNativePlatform === "function" && cap.isNativePlatform();
    if (nativo && media?.savePhoto && media?.getAlbums) {
      const dataUrl = await arquivoParaDataUrl(file);
      const albumIdentifier = await albumReiDaPelada(media);
      if (!albumIdentifier) throw new Error("sem album");
      await media.savePhoto({
        path: dataUrl,
        albumIdentifier,
        fileName: `ReiDaPelada_${Date.now()}`,
      });
      return true;
    }
    baixarNoCelular(file);
    return true;
  }

  function removerFoto(chave) {
    delete fotos[chave];
  }

  function temAlgumaFotoPremiacao() {
    return SLOTS.some((s) => !!fotos[s.key]);
  }

  function slotsAtivos(premios) {
    const slots = [];
    if (premios?.campeao?.nome) slots.push(SLOT_CAMPEAO);
    SLOTS.forEach((s) => {
      if (s.get(premios || {})) slots.push(s);
    });
    return slots;
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
          ? `<img class="foto-premio-thumb${s.horizontal ? " foto-premio-thumb-horizontal" : ""}" src="${foto}" alt="" />`
          : `<span class="foto-premio-vazio${s.horizontal ? " foto-premio-vazio-horizontal" : ""}" aria-hidden="true">📷</span>`;
        const dica = s.horizontal ? '<span class="foto-premio-formato">Página 2 do PDF</span>' : "";
        return `
        <div class="foto-premio-item${s.horizontal ? " foto-premio-item-horizontal" : ""}" data-foto-key="${s.key}">
          ${preview}
          <div class="foto-premio-info">
            <strong>${s.titulo}</strong>
            <span>${nome}</span>
            ${dica}
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
    const imgs = [...el.querySelectorAll("img.premio-foto, img.campeao-foto-img")];
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
      const resultado = await definirFoto(key, acao === "camera" ? "camera" : "galeria");
      if (resultado && estado.resumoAtual) {
        renderResumoOficial(estado.resumoAtual);
        syncPainel(estado.resumoAtual);
        toast(
          resultado === "galeria"
            ? "Foto adicionada e salva na galeria"
            : "Foto adicionada — aparece no PDF"
        );
      }
    });
  }

  return {
    SLOTS,
    SLOT_CAMPEAO,
    get,
    limpar,
    temAlgumaFotoPremiacao,
    syncPainel,
    aguardarImagensResumo,
    init,
    temPro,
  };
})();

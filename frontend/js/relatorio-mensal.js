/**
 * Relatório mensal da pelada (Pelada Pro).
 * Times mudam a cada jogo — o ranking é por jogador.
 */
function mesesRelatorioOpcoes() {
  const agora = new Date();
  const opts = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(agora.getFullYear(), agora.getMonth() - i, 1);
    const ano = d.getFullYear();
    const mes = d.getMonth() + 1;
    const label = d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
    opts.push({ ano, mes, label: label.charAt(0).toUpperCase() + label.slice(1) });
  }
  return opts;
}

function preencherSelectMesRelatorio() {
  const sel = document.getElementById("relatorio-mes");
  if (!sel || sel.options.length) return;
  mesesRelatorioOpcoes().forEach((o, i) => {
    const opt = document.createElement("option");
    opt.value = `${o.ano}-${String(o.mes).padStart(2, "0")}`;
    opt.textContent = o.label;
    if (i === 0) opt.selected = true;
    sel.appendChild(opt);
  });
}

function mesSelecionadoRelatorio() {
  const v = document.getElementById("relatorio-mes")?.value || "";
  const [ano, mes] = v.split("-").map((n) => parseInt(n, 10));
  const agora = new Date();
  return {
    ano: Number.isFinite(ano) ? ano : agora.getFullYear(),
    mes: Number.isFinite(mes) ? mes : agora.getMonth() + 1,
  };
}

function textoRelatorioMensalWhatsApp(rel) {
  const linhas = [];
  linhas.push(`*${rel.titulo || "Relatório do mês"}*`);
  linhas.push(`${rel.peladasNoMes || 0} pelada(s) · ${rel.partidasNoMes || 0} partida(s) · ${rel.totalGols || 0} gols`);
  linhas.push("");
  const p = rel.premios || {};
  linhas.push("*Destaques*");
  if (p.artilheiro) linhas.push(`⚽ Artilheiro: ${p.artilheiro.nome} (${p.artilheiro.detalhe})`);
  if (p.garcom) linhas.push(`🎯 Garçom: ${p.garcom.nome} (${p.garcom.detalhe})`);
  if (p.craque) linhas.push(`⭐ Craque: ${p.craque.nome} (${p.craque.detalhe})`);
  if (p.luvaDeOuro) linhas.push(`🧤 Luva: ${p.luvaDeOuro.nome} (${p.luvaDeOuro.detalhe})`);
  if (p.cartolaAmarela) linhas.push(`🟨 Amarelos: ${p.cartolaAmarela.nome} (${p.cartolaAmarela.detalhe})`);
  if (p.expulsoes) linhas.push(`🟥 Vermelhos: ${p.expulsoes.nome} (${p.expulsoes.detalhe})`);
  if (p.fairPlay) linhas.push(`🤝 Fair play: ${(p.fairPlay.nomes || [p.fairPlay.nome]).join(", ")}`);
  const top = (lista, titulo, campo) => {
    const arr = (lista || []).slice(0, 8);
    if (!arr.length) return;
    linhas.push("");
    linhas.push(`*${titulo}*`);
    arr.forEach((i) => linhas.push(`• ${i.nome}: ${i[campo] ?? i.quantidade}`));
  };
  top(rel.artilharia, "Artilharia", "gols");
  top(rel.garcons, "Assistências", "quantidade");
  top(rel.goleiros, "Goleiros (sofridos)", "quantidade");
  top(rel.amarelos, "Amarelos", "quantidade");
  top(rel.vermelhos, "Vermelhos", "quantidade");
  linhas.push("");
  linhas.push("_Pelada Oficial — relatório do mês_");
  return linhas.join("\n");
}

function renderRelatorioMensal(rel) {
  const el = document.getElementById("resumo-mensal-oficial");
  if (!el || !rel) return;
  const p = rel.premios || {};
  const gkLista = (rel.goleiros || []).map((g) => ({
    nome: g.nome,
    quantidade: `${g.quantidade} sofr. · ${g.peladas || 0} pel. · méd ${g.media ?? "-"}`,
  }));
  el.innerHTML = `
    <header class="resumo-topo">
      <div>
        <p class="eyebrow">Resumo do mês</p>
        <h2>${rel.titulo || "Relatório mensal"}</h2>
      </div>
      <p class="resumo-data">${rel.peladasNoMes || 0} pelada(s)</p>
    </header>
    <section class="resumo-bloco">
      <h3>Números</h3>
      <ul class="lista-resumo">
        <li><span>Peladas</span><strong>${rel.peladasNoMes || 0}</strong></li>
        <li><span>Partidas</span><strong>${rel.partidasNoMes || 0}</strong></li>
        <li><span>Gols</span><strong>${rel.totalGols || 0}</strong></li>
        <li><span>Assistências</span><strong>${rel.totalAssistencias || 0}</strong></li>
        <li><span>Amarelos</span><strong>${rel.totalAmarelos || 0}</strong></li>
        <li><span>Vermelhos</span><strong>${rel.totalVermelhos || 0}</strong></li>
      </ul>
    </section>
    <section class="resumo-bloco premios-grid">
      <h3>Destaques do mês</h3>
      <div class="premios">
        ${premioCard("Artilheiro", p.artilheiro)}
        ${premioCard("Garçom", p.garcom)}
        ${premioCard("Craque", p.craque)}
        ${premioCard("Luva de Ouro", p.luvaDeOuro)}
        ${premioCard("Amarelos", p.cartolaAmarela)}
        ${premioCard("Vermelhos", p.expulsoes)}
      </div>
      <p class="dica" style="margin-top:10px">Times mudam a cada pelada — o ranking é por jogador.</p>
    </section>
    <section class="resumo-bloco">
      <h3>Artilharia</h3>
      ${listaSimples(rel.artilharia, "Nenhum gol no mês.")}
    </section>
    <section class="resumo-bloco">
      <h3>Assistências</h3>
      ${listaSimples(rel.garcons, "Nenhuma assistência no mês.")}
    </section>
    <section class="resumo-bloco">
      <h3>Goleiros (menos vazado)</h3>
      ${listaSimples(gkLista, "Nenhum goleiro no mês.")}
    </section>
    <section class="resumo-bloco">
      <h3>Cartões amarelos</h3>
      ${listaSimples(rel.amarelos, "Nenhum amarelo.")}
    </section>
    <section class="resumo-bloco">
      <h3>Cartões vermelhos</h3>
      ${listaSimples(rel.vermelhos, "Nenhum vermelho.")}
    </section>
    ${(rel.golsContra || []).length ? `<section class="resumo-bloco"><h3>Gols contra</h3>${listaSimples(rel.golsContra, "")}</section>` : ""}
    <section class="resumo-bloco">
      <h3>Peladas do mês</h3>
      ${
        (rel.peladas || []).length
          ? `<ul class="lista-resumo">${rel.peladas
              .map((x) => `<li><span>${x.data ? `${x.data} · ` : ""}${x.nome}</span><strong>${x.partidas || 0} jog.</strong></li>`)
              .join("")}</ul>`
          : `<p class="vazio">Nenhuma pelada encerrada neste mês.</p>`
      }
    </section>
    <footer class="resumo-rodape">Gerado por Pelada Oficial</footer>
  `;
}

async function abrirRelatorioMensal() {
  if (typeof PlanoApp !== "undefined" && !PlanoApp.exigirPro("O relatório do mês faz parte do Pelada Pro")) {
    return;
  }
  estado.telaAntesRelatorio = document.querySelector(".tela.ativa")?.id || "tela-inicio";
  preencherSelectMesRelatorio();
  mostrarTela("tela-relatorio-mensal");
  await carregarRelatorioMensalNaTela();
}

async function carregarRelatorioMensalNaTela() {
  const { ano, mes } = mesSelecionadoRelatorio();
  try {
    await comLoading(async () => {
      const rel = await PeladaAPI.relatorioMensal(ano, mes);
      estado.relatorioMensalAtual = rel;
      renderRelatorioMensal(rel);
    }, "Montando o mês...");
  } catch (err) {
    toast(err.message || "Não deu para montar o relatório");
  }
}

function initRelatorioMensal() {
  document.getElementById("btn-relatorio-mensal")?.addEventListener("click", () => abrirRelatorioMensal());
  document.getElementById("btn-relatorio-inicio")?.addEventListener("click", () => abrirRelatorioMensal());
  document.getElementById("cfg-relatorio-mensal")?.addEventListener("click", () => abrirRelatorioMensal());
  document.getElementById("btn-voltar-relatorio")?.addEventListener("click", () => {
    mostrarTela(estado.telaAntesRelatorio || "tela-inicio");
  });
  document.getElementById("relatorio-mes")?.addEventListener("change", () => carregarRelatorioMensalNaTela());
  document.getElementById("btn-pdf-mensal")?.addEventListener("click", async () => {
    const nome = (estado.relatorioMensalAtual?.titulo || "relatorio-mes").replace(/\s+/g, "-").toLowerCase();
    try {
      await baixarPdfElemento("resumo-mensal-oficial", `${nome}.pdf`);
    } catch (err) {
      toast(err.message || "Não foi possível gerar o PDF");
    }
  });
  document.getElementById("btn-whats-mensal")?.addEventListener("click", () => {
    const rel = estado.relatorioMensalAtual;
    if (!rel) return;
    const texto = textoRelatorioMensalWhatsApp(rel);
    window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, "_blank");
  });
}

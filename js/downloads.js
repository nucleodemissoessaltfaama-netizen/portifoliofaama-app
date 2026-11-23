// Página pública de downloads: abas Atualizações e Versões.
import { db, urlPublica } from "./supa.js";
import { $, $$, esc, fmtData, tamanho } from "./ui.js";

let itens = [], aba = "atualizacoes";
try { aba = new URLSearchParams(location.search).get("aba") === "versoes" ? "versoes" : "atualizacoes"; } catch { /* */ }

function desenhar() {
  $$("#abas button").forEach((b) => b.classList.toggle("ativa", b.dataset.aba === aba));
  $$(".explica").forEach((p) => (p.hidden = p.dataset.aba !== aba));
  const lista = itens.filter((i) => i.aba === aba);
  $("#lista-downloads").innerHTML = lista.length ? lista.map((i, k) => `
    <div class="cartao item-download">
      <div class="item-download-info">
        <h2>${esc(i.titulo)} ${k === 0 ? '<span class="selo-p">mais recente</span>' : ""}</h2>
        ${i.descricao ? `<p>${esc(i.descricao).replace(/\n/g, "<br>")}</p>` : ""}
        <small class="leve">${fmtData(i.criado_em)}${i.nome_arquivo ? " · " + esc(i.nome_arquivo) : ""}${i.tamanho ? " · " + tamanho(i.tamanho) : ""}</small>
      </div>
      <a class="botao primario" href="${esc(i.caminho ? urlPublica(i.caminho, i.nome_arquivo) : i.link)}" ${i.link ? 'target="_blank" rel="noopener"' : "download"}>⬇ Baixar</a>
    </div>`).join("")
    : `<div class="cartao vazio">Nada publicado em ${aba === "versoes" ? "Versões" : "Atualizações"} ainda.</div>`;
}

$$("#abas button").forEach((b) => (b.onclick = () => { aba = b.dataset.aba; desenhar(); }));

db.sel("downloads", { publicado: "eq.true", order: "criado_em.desc" })
  .then((r) => { itens = r; desenhar(); })
  .catch(() => { $("#lista-downloads").innerHTML = '<div class="cartao vazio">Não foi possível carregar a lista. Confira a internet e recarregue a página.</div>'; });

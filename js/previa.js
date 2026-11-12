// Prévia em folhas A4 e cálculo das páginas (usado também pelo sumário do Word).
import { $, $$, el, esc, erro } from "./ui.js";
import { montar } from "./documento.js";

export const CM = 96 / 2.54;               // px por cm na tela
export const PT = 96 / 72;                 // px por ponto
export const PAG = { w: 21, h: 29.7, top: 3, left: 3, bottom: 2, right: 2 };
export const UTIL = { w: PAG.w - PAG.left - PAG.right, h: PAG.h - PAG.top - PAG.bottom };
export const LINHA_15 = 1.725;             // entrelinha 1,5 do Word para Times 12 (1,5 × 1,15)

// Medidas das imagens (cm), iguais na prévia e no Word
export function tamanhoImagem(w, h, maxW, maxH) {
  const k = Math.min(maxW / w, maxH / h, 1e9);
  return { w: w * k, h: h * k };
}
export const LIMITES = { fig: [14, 10], dupla: [7.8, 8], org: [16, 20] };

const CSS = `
.pv-folha-caixa { margin: 0 auto 18px; }
.pv-folha { width: ${PAG.w}cm; height: ${PAG.h}cm; background: #fff; position: relative; box-shadow: 0 4px 18px rgba(0,0,0,.35); transform-origin: top left; overflow: hidden; }
.pv-janela { position: absolute; top: ${PAG.top}cm; left: ${PAG.left}cm; width: ${UTIL.w}cm; overflow: hidden; }
.pv-num { position: absolute; top: 1.6cm; right: ${PAG.right}cm; font: 10pt "Times New Roman", Tinos, "Liberation Serif", Times, serif; color: #000; }
.pv-notas { position: absolute; left: ${PAG.left}cm; width: ${UTIL.w}cm; }
.pv-fluxo, .pv-notas, .pv-regua, .pv-janela { font-family: "Times New Roman", Tinos, "Liberation Serif", Times, serif; font-size: 12pt; color: #000; }
.pv-fluxo { width: ${UTIL.w}cm; position: relative; }
.pv-fluxo > * { margin: 0; }
.pv-p { text-align: justify; line-height: ${LINHA_15}; hyphens: manual; overflow-wrap: anywhere; }
.pv-corpo { text-indent: 1.25cm; }
.pv-ref { text-align: left; line-height: 1.15; margin-bottom: 12pt !important; }
.pv-h { font-weight: bold; line-height: ${LINHA_15}; margin-top: 12pt !important; text-align: left; }
.pv-fluxo > .pv-h:first-child { margin-top: 0 !important; }
.pv-fig { text-align: center; margin-top: 6pt !important; margin-bottom: 6pt !important; line-height: 1.15; }
.pv-leg { font-size: 10pt; font-style: italic; line-height: 1.15; padding: 2pt 0; }
.pv-fig img, .pv-img img { display: inline-block; vertical-align: top; }
.pv-img { text-align: center; padding: 6pt 0; line-height: 1; }
.pv-quadro { width: 100%; border-collapse: collapse; font-size: 11pt; line-height: 1.15; margin-top: 6pt !important; }
.pv-quadro th { background: #1f3864; color: #fff; font-weight: bold; padding: 4pt 5pt; border: 0.75pt solid #808080; text-align: center; }
.pv-quadro td { padding: 4pt 5pt; border: 0.75pt solid #808080; vertical-align: middle; }
.pv-quadro tbody tr:nth-child(even) td { background: #f2f2f2; }
.pv-quadro td.c { text-align: center; }
.pv-quadro tr.pv-total td { font-weight: bold; text-align: center; background: #fff; }
.pv-qleg { text-align: center; font-weight: bold; font-size: 10pt; line-height: 1.15; padding-top: 6pt; }
.pv-sup { font-size: 8pt; vertical-align: super; line-height: 0; }
.pv-nota { font-size: 10pt; line-height: 1.15; text-align: justify; margin: 0 0 2pt; }
.pv-sep { width: 5cm; border-top: 0.75pt solid #000; margin: 0 0 3pt; }
.pv-titulo-lista { text-align: center; font-weight: bold; line-height: ${LINHA_15}; margin-bottom: 12pt !important; }
.pv-ent { display: flex; align-items: flex-end; line-height: 1.15; margin-bottom: 4pt !important; }
.pv-ent .t { flex: 1; overflow: hidden; position: relative; }
.pv-ent .t::after { content: ""; position: absolute; left: 0; right: 0; bottom: 3px; border-bottom: 1.5px dotted #000; }
.pv-ent .t span { position: relative; z-index: 1; background: #fff; padding-right: 3pt; }
.pv-ent .pg { min-width: 1.2em; text-align: right; padding-left: 3pt; background: #fff; }
.pv-ent .num { display: inline-block; }
.pv-ent.n1 { font-weight: bold; }
.pv-capa { position: absolute; inset: 0; text-align: center; font-weight: bold; line-height: ${LINHA_15}; }
.pv-capa .base { position: absolute; bottom: 0; left: 0; right: 0; }
.pv-natureza { margin-left: 8cm; text-align: justify; font-weight: normal; line-height: 1.15; }
.pv-regua { position: absolute; left: -100000px; top: 0; visibility: hidden; }
`;

function estilo() {
  if (!document.getElementById("pv-css")) document.head.append(el(`<style id="pv-css">${CSS}</style>`));
}

// ------------------------------------------------------------------ blocos → HTML
function htmlRuns(runs, notas) {
  return runs.map((r) => {
    if (r.nota !== undefined) { notas.push(r.nota); return `<span class="pv-sup" data-nota="${notas.length}">${notas.length}</span>`; }
    let t = esc(r.tx);
    if (r.b) t = `<b>${t}</b>`;
    if (r.i) t = `<i>${t}</i>`;
    return t;
  }).join("");
}

async function dimensoes(urls) {
  const mapa = new Map();
  await Promise.all([...new Set(urls)].map((u) => new Promise((ok) => {
    const i = new Image();
    i.crossOrigin = "anonymous";
    i.onload = () => { mapa.set(u, { w: i.naturalWidth, h: i.naturalHeight }); ok(); };
    i.onerror = () => { mapa.set(u, { w: 4, h: 3, erro: true }); ok(); };
    i.src = u;
  })));
  return mapa;
}

export function medidasFigura(b, dims) {
  if (b.imgs.length === 2) {
    const [a, c] = b.imgs.map((u) => dims.get(u) || { w: 4, h: 3 });
    // mesma altura, somando no máximo 15,6 cm de largura
    const ra = a.w / a.h, rc = c.w / c.h;
    const h = Math.min(LIMITES.dupla[1], (2 * LIMITES.dupla[0]) / (ra + rc));
    return [{ w: h * ra, h }, { w: h * rc, h }];
  }
  const d = dims.get(b.imgs[0]) || { w: 4, h: 3 };
  return [tamanhoImagem(d.w, d.h, ...LIMITES.fig)];
}

function htmlBloco(b, notas, dims) {
  if (b.t === "h") return `<p class="pv-h" data-id="${b.id}">${esc(b.numero)} ${esc(b.texto)}</p>`;
  if (b.t === "p") return `<p class="pv-p pv-${b.estilo}">${htmlRuns(b.runs, notas) || "&nbsp;"}</p>`;
  if (b.t === "fig") {
    const med = medidasFigura(b, dims);
    return `<div class="pv-fig" data-id="${b.id}"><div class="pv-leg">${esc(b.sup)}</div>
      <div>${b.imgs.map((u, i) => `<img src="${esc(u)}" style="width:${med[i].w}cm;height:${med[i].h}cm;${i ? "margin-left:0.2cm" : ""}">`).join("")}</div>
      <div class="pv-leg">${esc(b.inf)}</div></div>`;
  }
  if (b.t === "img") {
    const d = dims.get(b.url) || { w: 4, h: 3 }, m = tamanhoImagem(d.w, d.h, ...LIMITES.org);
    return `<div class="pv-img"><img src="${esc(b.url)}" style="width:${m.w}cm;height:${m.h}cm"></div>`;
  }
  if (b.t === "quadro") {
    return `<table class="pv-quadro" data-id="${b.id}"><colgroup><col style="width:52%"><col style="width:32.5%"><col style="width:15.5%"></colgroup>
      <thead><tr><th>Atividade</th><th>Período</th><th>Horas</th></tr></thead><tbody>
      ${b.linhas.map((l) => `<tr><td>${esc(l.atividade)}</td><td class="c">${esc(l.periodo)}</td><td class="c">${esc(l.horas)}</td></tr>`).join("")}
      <tr class="pv-total"><td colspan="2">Total de horas da Extensão Curricular Supervisionada</td><td class="c">${esc(b.total)}</td></tr></tbody></table>
      <p class="pv-qleg">${esc(b.legenda)}</p>`;
  }
  return "";
}

// ------------------------------------------------------------------ capa e folha de rosto
export const CAPA = { antesInst: 60, antesTitulo: 150, antesAutor: 80 };   // pontos
function htmlCapa(c) {
  return `<div class="pv-capa"><div style="padding-top:${CAPA.antesInst}pt">${c.instituicao.map(esc).join("<br>")}</div>
    <div style="padding-top:${CAPA.antesTitulo}pt;font-size:14pt">${esc(c.titulo)}</div><div style="font-style:italic">${esc(c.subtitulo)}</div>
    <div style="padding-top:${CAPA.antesAutor}pt">${esc(c.autor)}</div>
    <div class="base">${esc(c.cidade)}<br>${esc(c.ano)}</div></div>`;
}
export const ROSTO = { antesTitulo: 150, antesNatureza: 60 };
function htmlRosto(c) {
  return `<div class="pv-capa"><div>${esc(c.autor)}</div>
    <div style="padding-top:${ROSTO.antesTitulo}pt;font-size:14pt">${esc(c.titulo)}</div><div style="font-style:italic">${esc(c.subtitulo)}</div>
    <div class="pv-natureza" style="padding-top:${ROSTO.antesNatureza}pt">${esc(c.natureza)}</div>
    <div class="pv-natureza" style="padding-top:12pt;text-align:left">Docente Orientador:<br>${esc(c.orientador)}</div>
    <div class="base">${esc(c.cidade)}<br>${esc(c.ano)}</div></div>`;
}

function htmlLista(titulo, entradas, paginas) {
  return `<p class="pv-titulo-lista">${esc(titulo)}</p>` + entradas.map((e) =>
    `<div class="pv-ent n${e.nivel || 0}" style="padding-left:${((e.nivel || 1) - 1) * 0.5}cm"><span class="t"><span>${esc(e.texto)}</span></span><span class="pg">${paginas?.get(e.id) ?? "00"}</span></div>`).join("");
}

// ------------------------------------------------------------------ paginação
const esperarImagens = (raiz) => Promise.all($$("img", raiz).map((i) => (i.complete ? null : new Promise((ok) => { i.onload = i.onerror = ok; }))));

// Devolve os cortes [início, fim) em px de um fluxo já montado na régua
function cortar(fluxo, alturaPag) {
  const topo = fluxo.getBoundingClientRect().top;
  const filhos = [...fluxo.children];
  const cand = [];   // { y, pode }
  filhos.forEach((f, i) => {
    const r = f.getBoundingClientRect();
    const y0 = r.top - topo;
    const depoisDeTitulo = i > 0 && filhos[i - 1].classList.contains("pv-h");
    cand.push({ y: y0, pode: !depoisDeTitulo });
    if (f.matches("p.pv-p")) {
      const rg = document.createRange(); rg.selectNodeContents(f);
      const tops = [...new Set([...rg.getClientRects()].map((q) => Math.round(q.top - topo)))].sort((a, b) => a - b);
      tops.slice(1).forEach((y) => { if (y > y0 + 2) cand.push({ y, pode: true }); });
    }
    if (f.matches("table")) $$("tbody tr", f).slice(1).forEach((tr) => cand.push({ y: tr.getBoundingClientRect().top - topo, pode: true }));
  });
  const total = fluxo.scrollHeight;
  cand.push({ y: total, pode: true });
  // notas de rodapé: posição e altura de cada uma
  const notas = $$(".pv-sup", fluxo).map((s) => ({ y: s.getBoundingClientRect().top - topo, n: +s.dataset.nota, h: +s.dataset.alt || 0 }));
  const altNotas = (s, c) => { const h = notas.filter((x) => x.y >= s && x.y < c).reduce((t, x) => t + x.h, 0); return h ? h + 8 * PT : 0; };
  const pags = [];
  let s = 0;
  while (s < total - 1) {
    const ok = cand.filter((c) => c.pode && c.y > s + 1 && c.y - s + altNotas(s, c.y) <= alturaPag + 0.5);
    const c = ok.length ? ok[ok.length - 1].y : Math.min(total, s + alturaPag);
    pags.push([s, c, notas.filter((x) => x.y >= s && x.y < c).map((x) => x.n)]);
    s = c;
  }
  if (!pags.length) pags.push([0, 0, []]);
  return pags;
}

// Monta todo o documento em segmentos (cada um começa em página nova) e pagina
export async function paginar(dados, { paginasConhecidas } = {}) {
  estilo();
  const doc = montar(dados);
  const dims = await dimensoes([
    ...doc.corpo.filter((b) => b.t === "fig").flatMap((b) => b.imgs),
    ...doc.corpo.filter((b) => b.t === "img").map((b) => b.url),
  ]);
  const notas = [];
  // corpo em segmentos: quebra antes dos títulos com "novaPagina"
  const segCorpo = [[]];
  for (const b of doc.corpo) { if (b.novaPagina && segCorpo[segCorpo.length - 1].length) segCorpo.push([]); segCorpo[segCorpo.length - 1].push(b); }
  const htmlCorpo = segCorpo.map((seg) => seg.map((b) => htmlBloco(b, notas, dims)).join(""));

  const regua = el(`<div class="pv-regua"></div>`);
  document.body.append(regua);
  try {
    // altura de cada nota de rodapé
    const caixaNotas = el(`<div class="pv-notas" style="position:static">${notas.map((t, i) => `<p class="pv-nota"><span class="pv-sup">${i + 1}</span> ${esc(t)}</p>`).join("")}</div>`);
    regua.append(caixaNotas);
    const altNota = $$(".pv-nota", caixaNotas).map((p) => p.getBoundingClientRect().height + 2 * PT);

    const H = UTIL.h * CM;
    const entradasFig = doc.figuras.map((f) => ({ id: f.id, texto: f.sup }));
    const entradasQua = doc.quadros.map((q) => ({ id: q.id, texto: q.entrada }));
    const entradasSum = doc.titulos.map((t) => ({ id: t.id, nivel: t.nivel, texto: `${t.numero} ${t.texto}` }));

    const montarFluxo = (html) => {
      const f = el(`<div class="pv-fluxo">${html}</div>`);
      regua.append(f);
      $$(".pv-sup", f).forEach((s) => (s.dataset.alt = altNota[+s.dataset.nota - 1] || 0));
      return f;
    };
    const segmentos = [];
    segmentos.push({ tipo: "capa" });
    segmentos.push({ tipo: "rosto" });
    if (entradasFig.length) segmentos.push({ tipo: "lista", titulo: "LISTA DE FIGURAS", entradas: entradasFig });
    segmentos.push({ tipo: "lista", titulo: "LISTA DE QUADROS", entradas: entradasQua });
    segmentos.push({ tipo: "lista", titulo: "SUMÁRIO", entradas: entradasSum });
    htmlCorpo.forEach((h) => segmentos.push({ tipo: "corpo", html: h }));

    const montarSeg = async (sg, paginas) => {
      if (sg.tipo === "capa" || sg.tipo === "rosto") { sg.cortes = [[0, H, []]]; return; }
      sg.fluxo?.remove();
      sg.fluxo = montarFluxo(sg.tipo === "lista" ? htmlLista(sg.titulo, sg.entradas, paginas) : sg.html);
      await esperarImagens(sg.fluxo);
      sg.cortes = cortar(sg.fluxo, H);
    };
    for (const sg of segmentos) await montarSeg(sg, paginasConhecidas);

    // página de cada título, figura e quadro
    const calcular = () => {
      const pag = new Map();
      let n = 0;
      for (const sg of segmentos) {
        sg.primeira = n + 1;
        if (sg.tipo === "corpo") {
          const topo = sg.fluxo.getBoundingClientRect().top;
          $$("[data-id]", sg.fluxo).forEach((e) => {
            const y = e.getBoundingClientRect().top - topo;
            const k = sg.cortes.findIndex(([s, c]) => y >= s - 1 && y < c - 1);
            pag.set(e.dataset.id, n + 1 + Math.max(0, k));
          });
        }
        n += sg.cortes.length;
      }
      return { pag, total: n };
    };
    let { pag, total } = calcular();
    // listas e sumário com os números de verdade (se mudarem de tamanho, recalcula)
    for (let volta = 0; volta < 2; volta++) {
      const antes = segmentos.map((s) => s.cortes.length).join();
      for (const sg of segmentos) if (sg.tipo === "lista") await montarSeg(sg, pag);
      ({ pag, total } = calcular());
      if (segmentos.map((s) => s.cortes.length).join() === antes) break;
    }
    const inicioCorpo = segmentos.find((s) => s.tipo === "corpo").primeira;
    return { doc, segmentos, pag, total, inicioCorpo, notas, regua, dims };
  } catch (e) { regua.remove(); throw e; }
}

// Só os números de página (para o Word)
export async function calcularPaginas(dados) {
  const r = await paginar(dados);
  r.regua.remove();
  return { pag: r.pag, doc: r.doc, dims: r.dims };
}

// ------------------------------------------------------------------ janela da prévia
// Monta as folhas A4 (sem escala) a partir da paginação. Usado pela prévia e pelo PDF.
export function montarFolhas(r) {
  const folhas = [];
  let n = 0;
  for (const sg of r.segmentos) {
    for (const [s, c, notasPag] of sg.cortes) {
      n++;
      const folha = el(`<div class="pv-folha"></div>`);
      if (sg.tipo === "capa") folha.append(el(`<div class="pv-janela" style="height:${UTIL.h}cm">${htmlCapa(r.doc.capa)}</div>`));
      else if (sg.tipo === "rosto") folha.append(el(`<div class="pv-janela" style="height:${UTIL.h}cm">${htmlRosto(r.doc.capa)}</div>`));
      else {
        const jan = el(`<div class="pv-janela" style="height:${c - s}px"></div>`);
        const fl = el(`<div class="pv-fluxo" style="position:relative"></div>`);
        const topo = sg.fluxo.getBoundingClientRect().top;
        for (const f of sg.fluxo.children) {
          const q = f.getBoundingClientRect(), y0 = q.top - topo, y1 = q.bottom - topo;
          if (y1 <= s || y0 >= c) continue;
          const k = f.cloneNode(true);
          k.style.position = "absolute"; k.style.top = (y0 - s) + "px"; k.style.left = 0; k.style.right = 0;
          k.style.setProperty("margin", "0", "important");
          fl.append(k);
        }
        jan.append(fl);
        folha.append(jan);
        if (notasPag.length) {
          folha.append(el(`<div class="pv-notas" style="bottom:${PAG.bottom}cm"><div class="pv-sep"></div>${notasPag.map((k) => `<p class="pv-nota"><span class="pv-sup">${k}</span> ${esc(r.notas[k - 1])}</p>`).join("")}</div>`));
        }
      }
      if (n >= r.inicioCorpo) folha.append(el(`<div class="pv-num">${n}</div>`));
      folhas.push(folha);
    }
  }
  return folhas;
}

export async function abrirPrevia(dados, { aoGerar }) {
  estilo();
  const tela = el(`<div class="previa-fundo"><div class="previa-barra"><h3>Visualizar portfólio</h3>
    <small id="pv-info">Montando as páginas…</small>
    <button class="botao pequeno primario" data-a="gerar">📄 Gerar portfólio</button><button class="fechar-x" data-a="fechar" title="Fechar" aria-label="Fechar">✕</button></div>
    <div class="previa-folhas"><p class="previa-aguarde">Montando as páginas…</p></div></div>`);
  document.body.append(tela);
  const fechar = () => { tela.remove(); document.removeEventListener("keydown", tecla); };
  const tecla = (e) => { if (e.key === "Escape") fechar(); };
  document.addEventListener("keydown", tecla);
  $('[data-a="fechar"]', tela).onclick = fechar;
  $('[data-a="gerar"]', tela).onclick = () => aoGerar();
  let r;
  try { r = await paginar(dados); }
  catch (e) { erro(e); fechar(); return; }
  const area = $(".previa-folhas", tela);
  area.innerHTML = "";
  const escala = Math.min(1, (area.clientWidth - 20) / (PAG.w * CM));
  for (const folha of montarFolhas(r)) {
    folha.style.transform = `scale(${escala})`;
    const caixa = el(`<div class="pv-folha-caixa" style="width:${PAG.w * CM * escala}px;height:${PAG.h * CM * escala}px"></div>`);
    caixa.append(folha);
    area.append(caixa);
  }
  r.regua.remove();
  $("#pv-info", tela).textContent = `${r.total} páginas · os números de página podem variar um pouco no Word`;
}

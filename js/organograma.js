// Editor de organograma: caixas de título (bloco de cima + bloco de baixo), texto livre, linha, seta e seta dupla.
// Salva o desenho (JSON, para editar de novo) e um PNG recortado só da parte usada.
import { $, $$, el, esc, aviso, erro, janela, confirmar } from "./ui.js";

const LARG = 1800, ALT = 1200;
const COR = "#4472c4", COR_LINHA = "#2f4f8f";
const FONTE = "Arial, Helvetica, sans-serif";
const NS = "http://www.w3.org/2000/svg";

const regua = document.createElement("canvas").getContext("2d");
function largura(txt, tam, negrito) { regua.font = `${negrito ? "bold " : ""}${tam}px ${FONTE}`; return regua.measureText(txt).width; }

// Texto livre escrito no quadro branco (título ou texto normal)
const TAM_TXT = { titulo: 22, normal: 16 };
function medirTexto(t) {
  const tam = TAM_TXT[t.tam] || 22, linhas = String(t.texto || " ").split("\n");
  const w = Math.max(20, ...linhas.map((l) => largura(l, tam, t.tam !== "normal")));
  return { w, h: linhas.length * tam * 1.3, linhas, tam };
}
const medida = (item) => (item.texto !== undefined ? medirTexto(item) : medir(item));

function medir(n) {
  const l1 = String(n.titulo || "").split("\n"), l2 = String(n.sub || "").split("\n").filter((x) => x.trim());
  const w = Math.max(130, ...l1.map((t) => largura(t, 15, true) + 28), ...l2.map((t) => largura(t, 13, false) + 24));
  const h1 = 14 + l1.length * 19, h2 = l2.length ? 10 + l2.length * 17 : 0;
  return { w, h1, h2, l1, l2, h: h1 + h2 };
}

export function abrirEditor({ json, aoSalvar }) {
  const est = json && Array.isArray(json.nos) ? structuredClone(json) : { nos: [], lig: [] };
  if (!Array.isArray(est.textos)) est.textos = [];
  let ferramenta = "sel", sel = null, origem = null, zoom = window.innerWidth < 700 ? 0.6 : 0.85, alterado = false;
  const historico = [];
  const guardar = () => { historico.push(JSON.stringify(est)); if (historico.length > 40) historico.shift(); alterado = true; };

  const tela = el(`<div class="org-fundo">
    <div class="org-barra"><h3>Organograma da igreja</h3>
      <button class="botao pequeno" data-z="-">－</button><button class="botao pequeno" data-z="+">＋</button>
      <button class="botao pequeno" data-a="fechar">Fechar</button></div>
    <div class="org-area">
      <div class="org-ferr">
        <button class="botao primario" data-a="salvar">💾 Salvar</button>
        <div class="sep"></div>
        <button class="botao" data-f="sel">🖱 Selecionar / mover</button>
        <button class="botao" data-f="no">▭ Caixa de título</button>
        <button class="botao" data-f="txt">𝐓 Texto</button>
        <button class="botao" data-f="linha">— Linha</button>
        <button class="botao" data-f="seta">→ Seta</button>
        <button class="botao" data-f="dupla">↔ Seta dupla</button>
        <div class="sep"></div>
        <button class="botao" data-a="editar">✏️ Editar texto</button>
        <button class="botao" data-a="excluir">🗑 Excluir</button>
        <button class="botao" data-a="desfazer">↶ Desfazer</button>
        <div class="sep"></div>
        <p class="ajuda" id="org-ajuda"></p>
      </div>
      <div class="org-tela"><svg xmlns="${NS}"></svg></div>
    </div></div>`);
  document.body.append(tela);
  const svg = $("svg", tela), area = $(".org-tela", tela), ajuda = $("#org-ajuda", tela);

  const AJUDAS = {
    sel: "Toque numa caixa de título, num texto ou numa linha para selecionar. Arraste para mover. Toque duas vezes para editar o texto. Arraste o fundo para rolar.",
    no: "Toque no quadro branco onde a caixa de título deve ficar.",
    txt: "Toque no quadro branco onde o texto deve ficar (por exemplo, o título do organograma).",
    linha: "Arraste de uma caixa de título até outra (ou toque na primeira e depois na segunda) para ligá-las com uma linha.",
    seta: "Arraste da caixa de título de origem até a de destino (ou toque numa e depois na outra): a seta aponta para a segunda.",
    dupla: "Arraste de uma caixa de título até outra (ou toque numa e depois na outra) para ligá-las com uma seta de duas pontas.",
  };

  function escolherFerramenta(f) {
    ferramenta = f; origem = null;
    $$("[data-f]", tela).forEach((b) => b.classList.toggle("ativa", b.dataset.f === f));
    ajuda.textContent = AJUDAS[f];
    desenhar();
  }

  // ---------------------------------------------------------- desenho
  function pontoBorda(n, alvoX, alvoY) {
    const m = medir(n), cx = n.x + m.w / 2, cy = n.y + m.h / 2;
    const dx = alvoX - cx, dy = alvoY - cy;
    if (!dx && !dy) return [cx, cy];
    const k = Math.min(Math.abs((m.w / 2) / (dx || 1e-9)), Math.abs((m.h / 2) / (dy || 1e-9)));
    return [cx + dx * k, cy + dy * k];
  }

  function caminho(l) {
    const a = est.nos.find((n) => n.id === l.de), b = est.nos.find((n) => n.id === l.para);
    if (!a || !b) return null;
    const ma = medir(a), mb = medir(b);
    const ax = a.x + ma.w / 2, bx = b.x + mb.w / 2;
    // Um embaixo do outro: linha em cotovelo (como num organograma)
    if (b.y >= a.y + ma.h + 12) {
      const y1 = a.y + ma.h, y2 = b.y, ym = (y1 + y2) / 2;
      return { d: Math.abs(ax - bx) < 2 ? `M${ax},${y1} V${y2}` : `M${ax},${y1} V${ym} H${bx} V${y2}` };
    }
    if (a.y >= b.y + mb.h + 12) {
      const y1 = a.y, y2 = b.y + mb.h, ym = (y1 + y2) / 2;
      return { d: Math.abs(ax - bx) < 2 ? `M${ax},${y1} V${y2}` : `M${ax},${y1} V${ym} H${bx} V${y2}` };
    }
    const [x1, y1] = pontoBorda(a, bx, b.y + mb.h / 2), [x2, y2] = pontoBorda(b, ax, a.y + ma.h / 2);
    return { d: `M${x1},${y1} L${x2},${y2}` };
  }

  function svgDesenho(paraExportar = false) {
    const defs = `<defs>
      <marker id="ponta" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="9" markerHeight="9" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="${COR_LINHA}"/></marker></defs>`;
    const ligs = est.lig.map((l) => {
      const c = caminho(l);
      if (!c) return "";
      const fim = l.tipo === "seta" || l.tipo === "dupla" ? 'marker-end="url(#ponta)"' : "";
      const ini = l.tipo === "dupla" ? 'marker-start="url(#ponta)"' : "";
      const marcado = !paraExportar && sel?.tipo === "lig" && sel.id === l.id;
      return `<g data-lig="${l.id}">${paraExportar ? "" : `<path d="${c.d}" stroke="transparent" stroke-width="16" fill="none"/>`}
        <path d="${c.d}" stroke="${marcado ? "#e53935" : COR_LINHA}" stroke-width="${marcado ? 3 : 2}" fill="none" ${ini} ${fim}/></g>`;
    }).join("");
    const nos = est.nos.map((n) => {
      const m = medir(n);
      const marcado = !paraExportar && ((sel?.tipo === "no" && sel.id === n.id) || origem === n.id);
      const t1 = m.l1.map((t, i) => `<text x="${n.x + m.w / 2}" y="${n.y + 22 + i * 19}" text-anchor="middle" font-family="${FONTE}" font-size="15" font-weight="bold" fill="#fff">${esc(t)}</text>`).join("");
      const t2 = m.l2.map((t, i) => `<text x="${n.x + m.w / 2}" y="${n.y + m.h1 + 19 + i * 17}" text-anchor="middle" font-family="${FONTE}" font-size="13" fill="#1d2440">${esc(t)}</text>`).join("");
      return `<g data-no="${n.id}" style="cursor:${paraExportar ? "default" : "move"}">
        <rect x="${n.x}" y="${n.y}" width="${m.w}" height="${m.h1}" rx="4" fill="${COR}"/>
        ${m.h2 ? `<rect x="${n.x + 0.5}" y="${n.y + m.h1}" width="${m.w - 1}" height="${m.h2 - 0.5}" fill="#fff" stroke="${COR}" stroke-width="1"/>` : ""}
        ${t1}${t2}
        ${marcado ? `<rect x="${n.x - 5}" y="${n.y - 5}" width="${m.w + 10}" height="${m.h + 10}" fill="none" stroke="#e53935" stroke-width="2" stroke-dasharray="6 4" rx="6"/>` : ""}</g>`;
    }).join("");
    const textos = est.textos.map((t) => {
      const m = medirTexto(t);
      const marcado = !paraExportar && sel?.tipo === "txt" && sel.id === t.id;
      return `<g data-txt="${t.id}" style="cursor:${paraExportar ? "default" : "move"}">
        ${paraExportar ? "" : `<rect x="${t.x - 4}" y="${t.y - 4}" width="${m.w + 8}" height="${m.h + 8}" fill="transparent"/>`}
        ${m.linhas.map((l, i) => `<text x="${t.x}" y="${t.y + m.tam * (1.05 + i * 1.3)}" font-family="${FONTE}" font-size="${m.tam}" ${t.tam !== "normal" ? 'font-weight="bold"' : ""} fill="#1d2440">${esc(l)}</text>`).join("")}
        ${marcado ? `<rect x="${t.x - 6}" y="${t.y - 6}" width="${m.w + 12}" height="${m.h + 12}" fill="none" stroke="#e53935" stroke-width="2" stroke-dasharray="6 4" rx="6"/>` : ""}</g>`;
    }).join("");
    return defs + ligs + nos + textos;
  }

  function desenhar() {
    svg.setAttribute("viewBox", `0 0 ${LARG} ${ALT}`);
    svg.setAttribute("width", LARG * zoom);
    svg.setAttribute("height", ALT * zoom);
    svg.innerHTML = svgDesenho() + (est.nos.length || est.textos.length ? "" : `<text x="${LARG / 2}" y="${ALT / 2}" text-anchor="middle" font-family="${FONTE}" font-size="22" fill="#b5b6c8">Quadro branco: use “Cabeçalho” para começar</text>`)
      + `<path id="org-previa" d="" stroke="#e53935" stroke-width="2.5" stroke-dasharray="7 5" fill="none" pointer-events="none"/>`;
    desenharPrevia();
  }

  // Linha provisória que sai da caixa de título de origem e segue o dedo/mouse
  let mira = null;
  function desenharPrevia() {
    const pv = svg.querySelector("#org-previa");
    if (!pv) return;
    const n = origem && est.nos.find((k) => k.id === origem);
    if (!n || !mira) { pv.setAttribute("d", ""); return; }
    const [x1, y1] = pontoBorda(n, mira[0], mira[1]);
    pv.setAttribute("d", `M${x1},${y1} L${mira[0]},${mira[1]}`);
    pv.setAttribute("marker-end", ferramenta === "linha" ? "" : "url(#ponta)");
    pv.setAttribute("marker-start", ferramenta === "dupla" ? "url(#ponta)" : "");
  }
  function ligar(para) {
    if (!origem || !para || para === origem) return false;
    if (est.lig.some((l) => (l.de === origem && l.para === para) || (l.de === para && l.para === origem))) {
      aviso("Essas duas caixas de título já estão ligadas.", "erro"); origem = null; mira = null; desenhar(); return true;
    }
    guardar();
    est.lig.push({ id: "l" + Date.now().toString(36), de: origem, para, tipo: ferramenta });
    origem = null; mira = null; ajuda.textContent = AJUDAS[ferramenta]; desenhar();
    return true;
  }

  // ---------------------------------------------------------- interação
  const ponto = (ev) => {
    const r = svg.getBoundingClientRect();
    return [(ev.clientX - r.left) / zoom, (ev.clientY - r.top) / zoom];
  };
  let arrasto = null, ultimoToque = { id: null, t: 0 };

  svg.addEventListener("pointerdown", (ev) => {
    const gNo = ev.target.closest("[data-no]"), gLig = ev.target.closest("[data-lig]"), gTxt = ev.target.closest("[data-txt]");
    const [x, y] = ponto(ev);
    if (ferramenta === "txt") {
      if (gTxt || gNo) return;
      const t = { id: "t" + Date.now().toString(36), x: Math.max(0, x), y: Math.max(0, y - 14), texto: "", tam: "titulo" };
      sel = { tipo: "txt", id: t.id };
      escolherFerramenta("sel");
      editarTextoLivre(t, true);
      return;
    }
    if (ferramenta === "no") {
      if (gNo) return;
      guardar();
      const n = { id: "n" + Date.now().toString(36), x: Math.max(0, x - 80), y: Math.max(0, y - 20), titulo: "Cargo", sub: "Nome" };
      est.nos.push(n); sel = { tipo: "no", id: n.id };
      escolherFerramenta("sel");
      editarTexto(n);
      return;
    }
    if (["linha", "seta", "dupla"].includes(ferramenta)) {
      if (est.nos.length < 2) { aviso("Coloque pelo menos duas caixas de título antes de ligar.", "erro"); return; }
      if (!gNo) { origem = null; mira = null; ajuda.textContent = AJUDAS[ferramenta]; desenhar(); return; }
      const id = gNo.dataset.no;
      if (origem && origem !== id) { ligar(id); return; }
      origem = id; mira = [x, y];
      arrasto = { ligando: true, sx: ev.clientX, sy: ev.clientY };
      svg.setPointerCapture(ev.pointerId);
      ajuda.textContent = "Arraste até a outra caixa de título e solte (ou toque nela).";
      desenhar();
      return;
    }
    // selecionar / mover
    if (gNo) {
      const n = est.nos.find((k) => k.id === gNo.dataset.no);
      const agora = Date.now();
      if (ultimoToque.id === n.id && agora - ultimoToque.t < 400) { editarTexto(n); ultimoToque = { id: null, t: 0 }; return; }
      ultimoToque = { id: n.id, t: agora };
      sel = { tipo: "no", id: n.id };
      arrasto = { n, dx: x - n.x, dy: y - n.y, moveu: false };
      svg.setPointerCapture(ev.pointerId);
      desenhar();
    } else if (gTxt) {
      const t = est.textos.find((k) => k.id === gTxt.dataset.txt);
      const agora = Date.now();
      if (ultimoToque.id === t.id && agora - ultimoToque.t < 400) { editarTextoLivre(t); ultimoToque = { id: null, t: 0 }; return; }
      ultimoToque = { id: t.id, t: agora };
      sel = { tipo: "txt", id: t.id };
      arrasto = { n: t, dx: x - t.x, dy: y - t.y, moveu: false };
      svg.setPointerCapture(ev.pointerId);
      desenhar();
    } else if (gLig) {
      sel = { tipo: "lig", id: gLig.dataset.lig }; desenhar();
    } else {
      sel = null; desenhar();
      arrasto = { rolar: true, sx: ev.clientX, sy: ev.clientY, sl: area.scrollLeft, st: area.scrollTop };
      svg.setPointerCapture(ev.pointerId);
    }
  });
  svg.addEventListener("pointermove", (ev) => {
    if (origem && ["linha", "seta", "dupla"].includes(ferramenta)) { mira = ponto(ev); desenharPrevia(); }
    if (!arrasto || arrasto.ligando) return;
    if (arrasto.rolar) { area.scrollLeft = arrasto.sl - (ev.clientX - arrasto.sx); area.scrollTop = arrasto.st - (ev.clientY - arrasto.sy); return; }
    const [x, y] = ponto(ev), m = medida(arrasto.n);
    if (!arrasto.moveu) { guardar(); arrasto.moveu = true; }
    arrasto.n.x = Math.round(Math.min(LARG - m.w, Math.max(0, x - arrasto.dx)) / 5) * 5;
    arrasto.n.y = Math.round(Math.min(ALT - m.h, Math.max(0, y - arrasto.dy)) / 5) * 5;
    desenhar();
  });
  const soltar = (ev) => {
    if (arrasto?.ligando) {
      const andou = Math.hypot(ev.clientX - arrasto.sx, ev.clientY - arrasto.sy) > 8;
      const alvo = document.elementFromPoint(ev.clientX, ev.clientY)?.closest?.("[data-no]");
      if (andou) {
        if (!ligar(alvo?.dataset.no)) { origem = null; mira = null; ajuda.textContent = AJUDAS[ferramenta]; desenhar(); }
      }
      // sem arrastar: fica esperando o toque na segunda caixa de título
    }
    arrasto = null;
  };
  svg.addEventListener("pointerup", soltar);
  svg.addEventListener("pointercancel", () => { arrasto = null; });
  svg.addEventListener("dblclick", (ev) => {
    const g = ev.target.closest("[data-no]"), gt = ev.target.closest("[data-txt]");
    if (g && ferramenta === "sel") editarTexto(est.nos.find((k) => k.id === g.dataset.no));
    if (gt && ferramenta === "sel") editarTextoLivre(est.textos.find((k) => k.id === gt.dataset.txt));
  });

  async function editarTextoLivre(t, novo = false) {
    const corpo = el(`<div><label class="rotulo">Texto</label><textarea class="campo tx" rows="2" placeholder="Ex.: Organograma da Igreja Central de Cordeiro"></textarea>
      <label class="rotulo">Tamanho</label><select class="campo tm"><option value="titulo">Título (grande, em negrito)</option><option value="normal">Texto normal</option></select>
      <p class="dica-campo">Enter faz uma nova linha.</p></div>`);
    $(".tx", corpo).value = t.texto; $(".tm", corpo).value = t.tam || "titulo";
    const r = await janela({
      titulo: novo ? "Novo texto" : "Editar texto", corpo,
      botoes: [{ rotulo: "Cancelar", valor: null }, { rotulo: "OK", classe: "primario", acao: () => ({ tx: $(".tx", corpo).value.trim(), tm: $(".tm", corpo).value }) }],
    });
    if (!r || !r.tx) { if (novo) sel = null; desenhar(); return; }
    guardar();
    t.texto = r.tx; t.tam = r.tm;
    if (novo) est.textos.push(t);
    desenhar();
  }

  async function editarTexto(n) {
    if (!n) return aviso("Selecione uma caixa de título.", "erro");
    const corpo = el(`<div><label class="rotulo">Texto do bloco de cima (cargo, departamento)</label><textarea class="campo t1" rows="2"></textarea>
      <label class="rotulo">Texto do bloco de baixo (nome) — opcional</label><textarea class="campo t2" rows="2"></textarea>
      <p class="dica-campo">Enter faz uma nova linha dentro do bloco.</p></div>`);
    $(".t1", corpo).value = n.titulo; $(".t2", corpo).value = n.sub;
    const r = await janela({
      titulo: "Texto da caixa de título", corpo,
      botoes: [{ rotulo: "Cancelar", valor: null }, { rotulo: "OK", classe: "primario", acao: () => ({ t1: $(".t1", corpo).value.trim(), t2: $(".t2", corpo).value.trim() }) }],
    });
    if (!r) { desenhar(); return; }
    guardar();
    n.titulo = r.t1 || " "; n.sub = r.t2;
    desenhar();
  }

  function excluirSel() {
    if (!sel) return aviso("Selecione uma caixa de título ou uma linha.", "erro");
    guardar();
    if (sel.tipo === "txt") est.textos = est.textos.filter((t) => t.id !== sel.id);
    else if (sel.tipo === "no") {
      est.nos = est.nos.filter((n) => n.id !== sel.id);
      est.lig = est.lig.filter((l) => l.de !== sel.id && l.para !== sel.id);
    } else est.lig = est.lig.filter((l) => l.id !== sel.id);
    sel = null; desenhar();
  }

  const tecla = (ev) => {
    if (ev.target.closest("input, textarea")) return;
    if (ev.key === "Delete" || ev.key === "Backspace") { ev.preventDefault(); excluirSel(); }
    if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === "z") { ev.preventDefault(); desfazer(); }
  };
  document.addEventListener("keydown", tecla);

  function desfazer() {
    const ant = historico.pop();
    if (!ant) return aviso("Nada para desfazer.");
    Object.assign(est, JSON.parse(ant)); sel = null; desenhar();
  }

  async function fechar() {
    if (alterado && !(await confirmar("Fechar sem salvar? As mudanças no organograma serão perdidas.", "Fechar sem salvar", true))) return;
    document.removeEventListener("keydown", tecla);
    tela.remove();
  }

  async function salvar() {
    if (!est.nos.length && !est.textos.length) return aviso("O organograma está vazio.", "erro");
    const bt = $('[data-a="salvar"]', tela);
    bt.disabled = true; bt.textContent = "Salvando…";
    try {
      const png = await exportarPng(est, svgDesenho);
      await aoSalvar(structuredClone(est), png);
      alterado = false;
      aviso("Organograma salvo.");
      document.removeEventListener("keydown", tecla);
      tela.remove();
    } catch (e) { erro(e); bt.disabled = false; bt.textContent = "💾 Salvar"; }
  }

  $$("[data-f]", tela).forEach((b) => (b.onclick = () => escolherFerramenta(b.dataset.f)));
  $('[data-a="salvar"]', tela).onclick = salvar;
  $('[data-a="fechar"]', tela).onclick = fechar;
  $('[data-a="excluir"]', tela).onclick = excluirSel;
  $('[data-a="desfazer"]', tela).onclick = desfazer;
  $('[data-a="editar"]', tela).onclick = () => (sel?.tipo === "txt"
    ? editarTextoLivre(est.textos.find((t) => t.id === sel.id))
    : editarTexto(sel?.tipo === "no" ? est.nos.find((n) => n.id === sel.id) : null));
  $$("[data-z]", tela).forEach((b) => (b.onclick = () => { zoom = Math.min(2, Math.max(0.3, zoom + (b.dataset.z === "+" ? 0.15 : -0.15))); desenhar(); }));
  escolherFerramenta("sel");
}

// Recorte só da parte desenhada, em PNG com o dobro da resolução
async function exportarPng(est, svgDesenho) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const n of [...est.nos, ...(est.textos || [])]) {
    const m = medida(n);
    x0 = Math.min(x0, n.x); y0 = Math.min(y0, n.y); x1 = Math.max(x1, n.x + m.w); y1 = Math.max(y1, n.y + m.h);
  }
  const pad = 16;
  x0 -= pad; y0 -= pad; x1 += pad; y1 += pad;
  const w = x1 - x0, h = y1 - y0, k = 2;
  const texto = `<svg xmlns="${NS}" width="${w * k}" height="${h * k}" viewBox="${x0} ${y0} ${w} ${h}"><rect x="${x0}" y="${y0}" width="${w}" height="${h}" fill="#fff"/>${svgDesenho(true)}</svg>`;
  const url = URL.createObjectURL(new Blob([texto], { type: "image/svg+xml;charset=utf-8" }));
  try {
    const img = await new Promise((ok, falha) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => falha(new Error("Não foi possível gerar a imagem.")); i.src = url; });
    const c = document.createElement("canvas");
    c.width = Math.round(w * k); c.height = Math.round(h * k);
    const g = c.getContext("2d");
    g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height);
    g.drawImage(img, 0, 0, c.width, c.height);
    return await new Promise((ok) => c.toBlob(ok, "image/png"));
  } finally { URL.revokeObjectURL(url); }
}

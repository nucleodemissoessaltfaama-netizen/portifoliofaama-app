// Utilidades de tela: avisos, janelas, datas, imagens, barra do topo, notificações.
import { db, sair, usuarioId } from "./supa.js";

export const $ = (sel, raiz = document) => raiz.querySelector(sel);
export const $$ = (sel, raiz = document) => [...raiz.querySelectorAll(sel)];

export function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

export function el(html) {
  const t = document.createElement("template");
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

// ---------------------------------------------------------------- avisos
export function aviso(msg, tipo = "ok") {
  let caixa = $("#avisos");
  if (!caixa) { caixa = el('<div id="avisos" aria-live="polite"></div>'); document.body.append(caixa); }
  const a = el(`<div class="aviso aviso-${tipo}">${esc(msg)}</div>`);
  caixa.append(a);
  while (caixa.children.length > 3) caixa.firstElementChild.remove();
  setTimeout(() => a.classList.add("saindo"), tipo === "erro" ? 5000 : 2800);
  setTimeout(() => a.remove(), tipo === "erro" ? 5400 : 3200);
}
export const erro = (e) => { console.warn(e); aviso(e?.message || String(e), "erro"); };

// ---------------------------------------------------------------- janelas
// botoes: [{ rotulo, classe, valor, fica, acao: async (janela) => valor|undefined }]
export function janela({ titulo, corpo, botoes = [{ rotulo: "Fechar", valor: null }], larga = false, fixa = false }) {
  return new Promise((resolve) => {
    const fundo = el(`<div class="janela-fundo"><div class="janela ${larga ? "larga" : ""}" role="dialog" aria-modal="true">
      <div class="janela-topo"><h3>${esc(titulo)}</h3><button class="icone fechar" aria-label="Fechar">✕</button></div>
      <div class="janela-corpo"></div><div class="janela-pe"></div></div></div>`);
    const corpoEl = $(".janela-corpo", fundo);
    if (typeof corpo === "string") corpoEl.innerHTML = corpo; else if (corpo) corpoEl.append(corpo);
    const fechar = (v) => { fundo.remove(); document.removeEventListener("keydown", tecla); resolve(v); };
    const tecla = (ev) => { if (ev.key === "Escape" && !fixa) fechar(null); };
    document.addEventListener("keydown", tecla);
    $(".fechar", fundo).onclick = () => fechar(null);
    if (!fixa) fundo.addEventListener("mousedown", (ev) => { if (ev.target === fundo) fechar(null); });
    for (const b of botoes) {
      const bt = el(`<button class="botao ${b.classe || ""}">${esc(b.rotulo)}</button>`);
      bt.onclick = async () => {
        if (b.acao) {
          bt.disabled = true;
          try {
            const v = await b.acao(fundo);
            if (v === false) { bt.disabled = false; return; }
            if (!b.fica) fechar(v === undefined ? b.valor ?? true : v);
          } catch (e) { erro(e); }
          bt.disabled = false;
        } else if (!b.fica) fechar(b.valor ?? null);
      };
      $(".janela-pe", fundo).append(bt);
    }
    document.body.append(fundo);
    const foco = $("input, textarea, select", corpoEl);
    if (foco) setTimeout(() => foco.focus(), 30);
  });
}

export function confirmar(msg, rotulo = "Confirmar", perigo = false) {
  return janela({
    titulo: "Confirmação", corpo: `<p>${esc(msg)}</p>`,
    botoes: [{ rotulo: "Cancelar", valor: false }, { rotulo, classe: perigo ? "perigo" : "primario", valor: true }],
  });
}

// Exclusão definitiva: pede o nome digitado
export function confirmarDigitando(msg, nome) {
  const corpo = el(`<div><p>${esc(msg)}</p><p class="leve">Para confirmar, digite <b>${esc(nome)}</b>:</p>
    <input class="campo" autocomplete="off"></div>`);
  return janela({
    titulo: "Excluir definitivamente", corpo,
    botoes: [{ rotulo: "Cancelar", valor: false }, {
      rotulo: "Excluir", classe: "perigo",
      acao: () => {
        if ($("input", corpo).value.trim().toLowerCase() !== nome.trim().toLowerCase()) {
          aviso("O nome digitado não confere.", "erro"); return false;
        }
        return true;
      },
    }],
  });
}

// ---------------------------------------------------------------- datas e números
const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
export const partes = (iso) => { const [a, m, d] = String(iso).slice(0, 10).split("-").map(Number); return { a, m, d }; };
export const fmtData = (iso) => { if (!iso) return ""; const { a, m, d } = partes(iso); return `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/${a}`; };
export const fmtCurta = (iso) => { const { m, d } = partes(iso); return `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}`; };
export const dataExtenso = (iso, ordinal = false) => {
  const { a, m, d } = partes(iso);
  return `${ordinal && d === 1 ? "1º" : d} de ${MESES[m - 1]} de ${a}`;
};
export const diaMesExtenso = (iso) => { const { m, d } = partes(iso); return `${d === 1 ? "1º" : d} de ${MESES[m - 1]}`; };

// Duração inclusiva entre duas datas: "3 meses e 21 dias"
export function duracao(ini, fim) {
  if (!ini || !fim) return "";
  const a = partes(ini), b0 = new Date(Date.UTC(partes(fim).a, partes(fim).m - 1, partes(fim).d + 1));
  let meses = (b0.getUTCFullYear() - a.a) * 12 + (b0.getUTCMonth() - (a.m - 1));
  let base = new Date(Date.UTC(a.a, a.m - 1 + meses, a.d));
  if (base > b0) { meses--; base = new Date(Date.UTC(a.a, a.m - 1 + meses, a.d)); }
  const dias = Math.round((b0 - base) / 86400000);
  const pm = meses ? `${meses} ${meses === 1 ? "mês" : "meses"}` : "";
  const pd = dias ? `${dias} ${dias === 1 ? "dia" : "dias"}` : "";
  return [pm, pd].filter(Boolean).join(" e ") || "1 dia";
}

const UNID = ["zero", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove", "dez", "onze", "doze", "treze", "catorze", "quinze", "dezesseis", "dezessete", "dezoito", "dezenove"];
const DEZ = ["", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"];
export function porExtenso(n) {
  if (n < 20) return UNID[n];
  if (n < 100) return DEZ[Math.floor(n / 10)] + (n % 10 ? " e " + UNID[n % 10] : "");
  return String(n);
}

// Minutos → "1h30", "2h", "45 min"
export function fmtMin(min) {
  min = Math.round(min || 0);
  const h = Math.floor(min / 60), m = min % 60;
  if (!h) return `${m} min`;
  return m ? `${h}h${String(m).padStart(2, "0")}` : `${h}h`;
}
// Para o quadro: 2 / 1,5
export function horasQuadro(min) {
  const h = Math.round((min / 60) * 100) / 100;
  return String(h).replace(".", ",");
}

export const palavras = (t) => (String(t || "").replace(/\[\[nota:[^\]]*\]\]/g, " ").match(/\S+/g) || []).length;

// ---------------------------------------------------------------- imagens
export function carregarImagem(src) {
  return new Promise((ok, falhou) => {
    const i = new Image();
    i.crossOrigin = "anonymous";
    i.onload = () => ok(i);
    i.onerror = () => falhou(new Error("Não foi possível abrir a imagem."));
    i.src = src;
  });
}

// Reduz a foto no navegador antes de subir (1600 px, JPEG 80%)
export async function comprimir(arquivo, max = 1600, qualidade = 0.8) {
  const url = URL.createObjectURL(arquivo);
  try {
    const img = await carregarImagem(url);
    const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement("canvas");
    c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
    const g = c.getContext("2d");
    g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height);
    g.drawImage(img, 0, 0, c.width, c.height);
    return await new Promise((ok) => c.toBlob(ok, "image/jpeg", qualidade));
  } finally { URL.revokeObjectURL(url); }
}

export function escolherArquivo(aceita = "image/*") {
  return new Promise((ok) => {
    const i = document.createElement("input");
    i.type = "file"; i.accept = aceita;
    i.onchange = () => ok(i.files[0] || null);
    i.click();
  });
}

export function iniciais(nome) {
  const p = String(nome || "?").trim().split(/\s+/);
  return ((p[0]?.[0] || "") + (p.length > 1 ? p[p.length - 1][0] : "")).toUpperCase();
}

export function avatar(perfil, classe = "") {
  return perfil?.foto_url
    ? `<span class="avatar ${classe}"><img src="${esc(perfil.foto_url)}" alt=""></span>`
    : `<span class="avatar ${classe}">${esc(iniciais(perfil?.nome))}</span>`;
}

// ---------------------------------------------------------------- instalar
let pedidoInstalar = null;
window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); pedidoInstalar = e; });

export async function instalar() {
  if (pedidoInstalar) { pedidoInstalar.prompt(); pedidoInstalar = null; return; }
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  janela({
    titulo: "Baixar o app",
    corpo: ios
      ? "<p>No iPhone, abra este site no <b>Safari</b>, toque em <b>Compartilhar</b> e depois em <b>Adicionar à Tela de Início</b>.</p>"
      : "<p>No Android (Chrome), toque nos <b>três pontinhos</b> e depois em <b>Instalar app</b> ou <b>Adicionar à tela inicial</b>.</p><p>No computador, use o ícone de instalar na barra de endereço do Chrome ou do Edge.</p>",
  });
}

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
}

// ---------------------------------------------------------------- topo: sino e perfil
export function montarTopo(perfil, { rotuloPapel, linhas = [], extras = [] }) {
  const topo = $("#topo-direita");
  topo.innerHTML = "";
  for (const x of extras) topo.append(x);
  const bInst = el('<button class="icone-topo" title="Baixar o app" aria-label="Baixar o app">⬇</button>');
  bInst.onclick = instalar;
  const bSino = el('<button class="icone-topo sino" title="Notificações" aria-label="Notificações">🔔<span class="bolinha" hidden></span></button>');
  const bPerfil = el(`<button class="icone-topo perfil" title="Perfil" aria-label="Perfil">${avatar(perfil, "pequeno")}</button>`);
  topo.append(bInst, bSino, bPerfil);

  bPerfil.onclick = (ev) => {
    ev.stopPropagation();
    abrirPopover(bPerfil, `
      <div class="perfil-cab">${avatar(perfil, "grande")}<div><b>${esc(perfil.nome)}</b>
        <span class="selo">${esc(rotuloPapel)}</span></div></div>
      <dl class="perfil-dados">${linhas.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v || "—")}</dd></div>`).join("")}</dl>
      <button class="link-sair">↪ Sair</button>`, (p) => {
      $(".link-sair", p).onclick = () => { sair(); location.href = "index.html"; };
    });
  };
  bSino.onclick = (ev) => { ev.stopPropagation(); abrirNotificacoes(bSino, perfil); };
  atualizarSino(bSino, perfil);
  setInterval(() => atualizarSino(bSino, perfil), 60000);
  return { bSino };
}

function abrirPopover(ancora, html, depois) {
  fecharPopover();
  const p = el(`<div class="popover">${html}</div>`);
  document.body.append(p);
  const r = ancora.getBoundingClientRect();
  p.style.top = r.bottom + 8 + "px";
  p.style.right = Math.max(8, innerWidth - r.right) + "px";
  p.addEventListener("click", (ev) => ev.stopPropagation());
  setTimeout(() => document.addEventListener("click", fecharPopover, { once: true }));
  depois?.(p);
  return p;
}
export function fecharPopover() { $$(".popover").forEach((p) => p.remove()); }

function filtroNotif(perfil) {
  return perfil.papel === "admin" ? { or: `(para.is.null,para.eq.${perfil.id})` } : { para: `eq.${perfil.id}` };
}

async function atualizarSino(bSino, perfil) {
  try {
    const n = await db.sel("notificacoes", { ...filtroNotif(perfil), lida: "eq.false", select: "id" });
    $(".bolinha", bSino).hidden = !n.length;
    $(".bolinha", bSino).textContent = n.length > 9 ? "9+" : n.length || "";
  } catch { /* sem conexão: tenta de novo depois */ }
}

// Ao clicar numa notificação de senha, o painel do administrador abre a geração de código
export const ganchos = { aoAbrirNotificacao: null };

async function abrirNotificacoes(bSino, perfil) {
  const lista = await db.sel("notificacoes", { ...filtroNotif(perfil), order: "criado_em.desc", limit: 50 }).catch((e) => { erro(e); return []; });
  const p = abrirPopover(bSino, `<div class="notif"><h4>Notificações</h4>
    <div class="notif-acoes"><label><input type="checkbox" class="todas"> Selecionar todas</label>
      <span><button class="link marcar">Marcar como lida</button><button class="link apagar">Apagar</button></span></div>
    <div class="notif-lista">${lista.length ? lista.map((n) => `
      <label class="notif-item ${n.lida ? "" : "nova"}" data-id="${n.id}">
        <input type="checkbox" value="${n.id}">
        <span><b>${esc(n.titulo)}</b><span>${esc(n.corpo)}</span><small>${fmtData(n.criado_em)} ${new Date(n.criado_em).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</small>
        ${n.tipo === "senha" && perfil.papel === "admin" ? '<button class="botao pequeno primario gerar">Gerar código</button>' : ""}</span>
      </label>`).join("") : '<p class="vazio">Nenhuma notificação.</p>'}</div></div>`);
  const marcados = () => $$(".notif-item input:checked", p).map((i) => i.value);
  $(".todas", p).onchange = (ev) => $$(".notif-item input", p).forEach((i) => (i.checked = ev.target.checked));
  $(".marcar", p).onclick = async () => {
    const ids = marcados(); if (!ids.length) return;
    await db.upd("notificacoes", { id: `in.(${ids.join(",")})` }, { lida: true }).catch(erro);
    fecharPopover(); atualizarSino(bSino, perfil);
  };
  $(".apagar", p).onclick = async () => {
    const ids = marcados(); if (!ids.length) return;
    await db.del("notificacoes", { id: `in.(${ids.join(",")})` }).catch(erro);
    fecharPopover(); atualizarSino(bSino, perfil);
  };
  $$(".gerar", p).forEach((b) => (b.onclick = (ev) => {
    ev.preventDefault();
    const n = lista.find((x) => x.id === b.closest(".notif-item").dataset.id);
    fecharPopover();
    ganchos.aoAbrirNotificacao?.(n);
  }));
}

// ---------------------------------------------------------------- campo de texto com contador e botão Salvar
// Sem salvamento automático: o botão fica azul quando há alteração e cinza quando está tudo salvo.
//
// Notas de rodapé: no banco ficam como [[nota: texto]]; na caixa aparecem como um número
// sobrescrito (¹ ² ³…) precedido de um caractere invisível (U+2063), para não confundir com
// um "²" digitado de propósito (km²). A numeração segue a do trabalho: continua de uma caixa
// para a outra, na ordem em que as caixas aparecem.
const MARCA = "⁣";
const SUP = "⁰¹²³⁴⁵⁶⁷⁸⁹";
const sobrescrito = (n) => String(n).split("").map((d) => SUP[+d]).join("");
const numeroDe = (t) => Number([...t].map((c) => SUP.indexOf(c)).join(""));
const RE_NOTA = /\[\[nota:\s*([\s\S]*?)\]\]/g;
const RE_MARCA = /⁣([⁰¹²³⁴⁵⁶⁷⁸⁹]+)|⁣|/g;
const camposComNota = [];

function deslocamento(caixa) {
  let n = 0;
  for (const c of camposComNota) { if (c === caixa) break; n += c.totalNotas(); }
  return n;
}
function renumerarDepois(caixa) {
  let depois = false;
  for (const c of camposComNota) { if (depois) c.renumerar(); if (c === caixa) depois = true; }
}

export function campoTexto({ valor, aoSalvar, linhas = 8, placeholder = "", nota = false, formatacao = false }) {
  const caixa = el(`<div class="campo-texto">
    ${nota || formatacao ? `<div class="ferramentas">
      ${formatacao ? '<button type="button" class="botao pequeno" data-f="neg" title="Negrito"><b>N</b></button><button type="button" class="botao pequeno" data-f="ita" title="Itálico"><i>I</i></button>' : ""}
      ${nota ? '<button type="button" class="botao pequeno" data-f="nota" title="Inserir nota de rodapé onde está o cursor">¹ Nota de rodapé</button>' : ""}
    </div>` : ""}
    <textarea class="campo" rows="${linhas}" placeholder="${esc(placeholder)}"></textarea>
    ${nota ? `<div class="bloco-notas"><div class="bloco-notas-cab">Notas de rodapé deste texto</div><ol class="lista-notas"></ol></div>` : ""}
    <div class="campo-rodape"><span class="estado"></span><span class="contador">0 palavras</span>
      <button type="button" class="botao primario pequeno salvar" disabled>Salvar</button></div></div>`);
  const ta = $("textarea", caixa), est = $(".estado", caixa), cont = $(".contador", caixa), bt = $(".salvar", caixa);
  let notas = [];          // [{ texto }] na ordem em que aparecem
  let base = 0;            // quantas notas vêm antes desta caixa no trabalho
  let pendente = null;     // texto da nota que está sendo inserida
  let salvando = false;

  // ---- conversões
  const paraTela = (t) => {
    notas = [];
    return String(t || "").replace(RE_NOTA, (_, tx) => { notas.push({ texto: tx.trim() }); return MARCA + sobrescrito(base + notas.length); });
  };
  const paraBanco = () => {
    let k = 0;
    return ta.value.replace(RE_MARCA, (m, dig) => (dig ? `[[nota: ${(notas[k++]?.texto || "").replace(/\]\]/g, "]")}]]` : ""));
  };

  // Relê a caixa: tira marcas soltas ou repetidas, encaixa a nota nova e renumera
  function reorganizar() {
    const v = ta.value, pos = ta.selectionStart;
    const novas = [], vistas = new Set();
    let ajuste = 0;
    const saida = v.replace(RE_MARCA, (m, dig, off) => {
      let troca = "";
      if (m === "") { if (pendente !== null) { novas.push({ texto: pendente }); troca = MARCA + sobrescrito(base + novas.length); } }
      else if (dig) {
        const i = numeroDe(dig) - base - 1;
        if (notas[i] && !vistas.has(i)) { vistas.add(i); novas.push(notas[i]); troca = MARCA + sobrescrito(base + novas.length); }
      }
      if (off < pos) ajuste += troca.length - m.length;
      return troca;
    });
    pendente = null;
    const mudouQtd = novas.length !== notas.length;
    notas = novas;
    if (saida !== v) { ta.value = saida; ta.setSelectionRange(pos + ajuste, pos + ajuste); }
    desenharNotas();
    if (mudouQtd) renumerarDepois(caixa);
  }

  function desenharNotas() {
    const ol = $(".lista-notas", caixa);
    if (!ol) return;
    ol.innerHTML = notas.length ? notas.map((n, i) => `<li data-i="${i}"><span class="num-nota">${sobrescrito(base + i + 1)}</span>
      <span class="texto">${esc(n.texto)}</span><span class="acoes-mini"><button type="button" data-n="editar" title="Editar nota">✏️</button><button type="button" data-n="apagar" title="Apagar nota">🗑</button></span></li>`).join("")
      : '<li class="vazio-notas">Nenhuma nota neste texto. Ponha o cursor onde a nota deve ficar e toque em “¹ Nota de rodapé”.</li>';
    $$("[data-n]", ol).forEach((b) => (b.onclick = async () => {
      const i = +b.closest("li").dataset.i;
      if (b.dataset.n === "editar") {
        const t = await pedirTexto("Editar nota de rodapé", `Nota ${base + i + 1}:`, notas[i].texto, true);
        if (!t) return;
        notas[i].texto = t; desenharNotas(); mudou();
      } else {
        if (!(await confirmar(`Apagar a nota ${base + i + 1}? O número sai do texto também.`, "Apagar", true))) return;
        let k = 0;
        ta.value = ta.value.replace(RE_MARCA, (m, dig) => (dig && k++ === i ? "" : m));
        reorganizar(); mudou();
      }
    }));
  }

  // ---- estado do botão
  base = nota ? deslocamento(caixa) : 0;
  ta.value = nota ? paraTela(valor) : (valor || "");
  let salvo = nota ? paraBanco() : ta.value;
  const atual = () => (nota ? paraBanco() : ta.value);
  const contar = () => { const n = palavras(ta.value.replace(RE_MARCA, "")); cont.textContent = `${n} ${n === 1 ? "palavra" : "palavras"}`; };
  function mudou() {
    contar();
    const sujo = atual() !== salvo;
    bt.disabled = salvando || !sujo;
    est.textContent = sujo ? "Alterações não salvas" : (salvo ? "Salvo ✓" : "");
  }
  const salvar = async () => {
    const v = atual();
    if (v === salvo || salvando) return mudou();
    salvando = true; bt.disabled = true; est.textContent = "Salvando…";
    try { await aoSalvar(v); salvo = v; }
    catch (e) { erro(e); }
    salvando = false; mudou();
  };
  ta.addEventListener("input", () => { if (nota) reorganizar(); mudou(); });
  bt.onclick = salvar;
  $$("[data-f]", caixa).forEach((b) => (b.onclick = async () => {
    const f = b.dataset.f, s = ta.selectionStart, e = ta.selectionEnd, sel = ta.value.slice(s, e);
    if (f === "nota") {
      const t = await pedirTexto("Nota de rodapé", "Texto da nota (ex.: a fonte do dado, com endereço e data de acesso):", "", true);
      if (!t) return;
      pendente = t;
      ta.setRangeText("", e, e, "end");
      reorganizar();
    } else {
      const m = f === "neg" ? "**" : "*";
      ta.setRangeText(m + (sel || "texto") + m, s, e, "end");
    }
    ta.focus(); mudou();
  }));

  caixa.salvar = salvar;
  caixa.pendente = () => atual() !== salvo;
  if (nota) {
    caixa.totalNotas = () => notas.length;
    caixa.renumerar = () => {
      const novo = deslocamento(caixa);
      if (novo === base) return;
      const antes = paraBanco();      // pelo texto do banco, que não depende do número
      const pos = ta.selectionStart, foco = document.activeElement === ta;
      base = novo;
      const k = notas.map((n) => ({ ...n }));
      ta.value = paraTela(antes);
      notas = k;
      if (foco) ta.setSelectionRange(pos, pos);
      desenharNotas();
    };
    camposComNota.push(caixa);
    desenharNotas();
  }
  mudou();
  return caixa;
}

// Liga um botão "Salvar" a um formulário: cinza e travado até alguma coisa mudar
export function travarAteMudar(form, botao) {
  const foto = () => JSON.stringify([...form.querySelectorAll("input, select, textarea")].map((i) => (i.type === "checkbox" ? i.checked : i.value)));
  let base = foto();
  const ver = () => { botao.disabled = foto() === base; };
  form.addEventListener("input", ver);
  form.addEventListener("change", ver);
  ver();
  return { salvo() { base = foto(); ver(); } };
}

export function pedirTexto(titulo, rotulo, valor = "", area = false) {
  const corpo = el(`<div><label class="rotulo">${esc(rotulo)}</label>${area ? '<textarea class="campo" rows="4"></textarea>' : '<input class="campo">'}</div>`);
  $(".campo", corpo).value = valor;
  return janela({
    titulo, corpo,
    botoes: [{ rotulo: "Cancelar", valor: null }, { rotulo: "OK", classe: "primario", acao: () => $(".campo", corpo).value.trim() || false }],
  });
}

// Alerta ao sair com texto não salvo
export function protegerSaida(temPendente) {
  window.addEventListener("beforeunload", (e) => { if (temPendente()) { e.preventDefault(); e.returnValue = ""; } });
}

export { usuarioId };

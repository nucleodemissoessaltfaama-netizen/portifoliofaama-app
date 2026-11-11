import { db, logado, usuarioId, subirArquivo, apagarArquivo } from "./supa.js";
import {
  $, $$, el, esc, aviso, erro, janela, confirmar, montarTopo, campoTexto, palavras, pedirTexto,
  fmtData, fmtCurta, fmtMin, dataExtenso, comprimir, escolherArquivo, protegerSaida,
} from "./ui.js";
import { DICAS, PERGUNTAS, textoSecao2, textoSecao22 } from "./textos.js";
import { carregarDados, numerarFiguras, organizar, linhasQuadro } from "./documento.js";

if (!logado()) location.replace("index.html");

let D = null;          // tudo do portfólio
let diaSel = null;     // dia aberto no bloco 3
const campos = [];     // caixas de texto (para avisar ao sair sem salvar)
const abertos = new Set(JSON.parse(localStorage.getItem("portfolio_blocos") || '["b1"]'));

async function iniciar() {
  const perfil = await db.um("perfis", { id: `eq.${usuarioId()}` });
  if (!perfil) { location.replace("index.html"); return; }
  if (perfil.papel === "admin") { location.replace("admin.html"); return; }
  const turma = perfil.turma_id ? await db.um("turmas", { id: `eq.${perfil.turma_id}` }) : null;
  const extras = [
    botaoTopo("📊", "Quadro resumo", abrirQuadro),
    botaoTopo("👁", "Visualizar portfólio", () => visualizar()),
    botaoTopo("📄", "Gerar portfólio", () => gerar()),
  ];
  montarTopo(perfil, {
    rotuloPapel: "Aluno",
    linhas: [["E-mail", perfil.email], ["Nascimento", fmtData(perfil.nascimento)], ["RA", perfil.ra], ["CPF", perfil.cpf], ["Turma", turma?.nome], ["WhatsApp", perfil.whatsapp]],
    extras,
  });
  if (!perfil.disciplina_id) {
    $("#principal").innerHTML = `<div class="cartao"><h2>Você ainda não está em nenhuma disciplina</h2><p>Fale com o administrador para ser colocado na disciplina de prática atual.</p></div>`;
    extras.forEach((b) => (b.disabled = true));
    return;
  }
  D = await carregarDados(db, perfil);
  if (!D.portfolio) throw new Error("Portfólio não encontrado. Fale com o administrador.");
  $("#sub-topo").textContent = D.disciplina.nome;
  protegerSaida(() => campos.some((c) => c.pendente()));
  desenhar();
}

function botaoTopo(icone, texto, acao) {
  const b = el(`<button class="icone-topo" title="${esc(texto)}">${icone}<span class="texto-topo">${esc(texto)}</span></button>`);
  b.onclick = () => acao().catch?.(erro);
  return b;
}

// ------------------------------------------------------------------ percentuais
const cheio = (t) => String(t || "").trim().length > 0;
function percentuais() {
  const p = D.portfolio, f = D.figuras;
  const b1 = [p.introducao, p.perfil_discente].filter(cheio).length / 2;
  const itens2 = [p.campo_nome, p.caract_campo, p.caract_cidade, p.igreja_texto, f.some((x) => x.local === "mapa"), f.some((x) => x.local === "igreja"), p.organograma_desc, p.organograma_url];
  const b2 = itens2.filter((x) => (typeof x === "boolean" ? x : cheio(x))).length / itens2.length;
  const ativos = D.requisitos.filter((r) => !r.arquivado);
  let pedidos = 0, feitos = 0;
  for (const r of ativos) {
    const q = r.quantidade || 1;
    pedidos += q;
    feitos += Math.min(q, D.atividades.filter((a) => a.requisito_id === r.id).length);
  }
  const b3 = pedidos ? feitos / pedidos : 0;
  const b4 = [p.analise, p.conclusao, D.referencias.length ? "x" : ""].filter(cheio).length / 3;
  return { b1, b2, b3, b4, geral: (b1 + b2 + b3 + b4) / 4 };
}
const pctTxt = (x) => Math.round(x * 100) + "%";

function atualizarPercentuais() {
  const pc = percentuais();
  for (const k of ["b1", "b2", "b3", "b4"]) {
    const s = $(`#${k} .pct`);
    if (s) { s.textContent = pctTxt(pc[k]); s.classList.toggle("cheio", pc[k] >= 1); }
  }
  const g = $("#progresso-geral");
  if (g) { $("span", g).style.width = pctTxt(pc.geral); $("#pct-geral").textContent = pctTxt(pc.geral); }
}

// ------------------------------------------------------------------ desenho geral
function desenhar() {
  const m = $("#principal");
  m.innerHTML = `
    <div class="cartao cabecalho-aluno"><div><h1>${esc(D.disciplina.nome)}</h1>
      <div class="leve" style="font-size:14px">${D.disciplina.inicio ? `Período: ${fmtData(D.disciplina.inicio)} a ${fmtData(D.disciplina.fim)}` : ""}</div></div>
      <div class="progresso-geral"><div class="barra-p" id="progresso-geral"><span style="width:0"></span></div><b id="pct-geral">0%</b></div></div>
    ${bloco("b1", 1, "Seção Introdução")}${bloco("b2", 2, "Seção Caracterização")}${bloco("b3", 3, "Seção Atividades desenvolvidas")}${bloco("b4", 4, "Conclusão")}`;
  $$(".bloco-cab", m).forEach((b) => (b.onclick = () => {
    const bl = b.parentElement; bl.classList.toggle("fechado");
    bl.classList.contains("fechado") ? abertos.delete(bl.id) : abertos.add(bl.id);
    try { localStorage.setItem("portfolio_blocos", JSON.stringify([...abertos])); } catch { /* sem armazenamento */ }
  }));
  bloco1(); bloco2(); bloco3(); bloco4();
  atualizarPercentuais();
}

const bloco = (id, n, titulo) => `<section class="bloco ${abertos.has(id) ? "" : "fechado"}" id="${id}">
  <button class="bloco-cab"><span class="num">${n}</span><h2>${titulo}</h2><span class="pct">0%</span><span class="seta">▾</span></button>
  <div class="bloco-corpo"></div></section>`;

// Item com título, dica e caixa de texto ligada a um campo do portfólio
function itemTexto(num, titulo, campo, { dica = DICAS[campo], ajuda = "", linhas = 9 } = {}) {
  const it = el(`<div class="item"><div class="item-cab"><h3><span class="n">${num}</span>${esc(titulo)}</h3>
    ${dica && ["introducao", "perfil_discente", "caract_campo", "caract_cidade"].includes(campo) ? '<button class="botao-dica">💡 Dica</button>' : ""}</div>
    ${ajuda ? `<p class="dica-campo" style="margin-top:-4px">${esc(ajuda)}</p>` : ""}</div>`);
  const dt = $(".botao-dica", it);
  if (dt) dt.onclick = () => janela({ titulo: "Dica — " + titulo, corpo: `<p>${esc(dica)}</p>` });
  const c = campoTexto({
    valor: D.portfolio[campo], linhas,
    aoSalvar: async (v) => { await db.upd("portfolios", { id: `eq.${D.portfolio.id}` }, { [campo]: v }); D.portfolio[campo] = v; atualizarPercentuais(); },
  });
  campos.push(c);
  it.append(c);
  return it;
}

// ------------------------------------------------------------------ bloco 1
function bloco1() {
  const c = $("#b1 .bloco-corpo");
  c.append(
    itemTexto("1", "Introdução", "introducao"),
    itemTexto("1.1", "Perfil do discente e expectativas vocacionais", "perfil_discente"),
  );
}

// ------------------------------------------------------------------ bloco 2
function bloco2() {
  const c = $("#b2 .bloco-corpo");
  c.innerHTML = "";
  const auto = el(`<div class="item"><div class="item-cab"><h3><span class="n">2</span>Atividades desenvolvidas</h3></div>
    <div class="texto-auto"><span class="rot">Texto automático</span><span id="auto-s2"></span></div></div>`);
  $("#auto-s2", auto).textContent = textoSecao2(D.dias.length);

  const campo = el(`<div class="item"><div class="item-cab"><h3><span class="n">2.1</span>Caracterização do campo</h3>
    <button class="botao-dica">💡 Dica</button></div>
    <label class="rotulo">Nome do campo de extensão</label>
    <input class="campo" id="campo-nome" placeholder="Ex.: Missão Pará-Amapá (MPA)">
    <div class="dica-campo">Sai no título “2.1 Caracterização do campo de extensão: …” e no texto da carga horária.</div>
    <label class="rotulo">Caracterização do campo</label></div>`);
  $(".botao-dica", campo).onclick = () => janela({ titulo: "Dica — Caracterização do campo", corpo: `<p>${esc(DICAS.caract_campo)}</p>` });
  const inp = $("#campo-nome", campo);
  inp.value = D.portfolio.campo_nome;
  let t = null;
  const salvarNome = async () => {
    clearTimeout(t);
    const v = inp.value.trim();
    if (v === D.portfolio.campo_nome) return;
    try { await db.upd("portfolios", { id: `eq.${D.portfolio.id}` }, { campo_nome: v }); D.portfolio.campo_nome = v; atualizarPercentuais(); }
    catch (e) { erro(e); }
  };
  inp.oninput = () => { clearTimeout(t); t = setTimeout(salvarNome, 1200); };
  inp.onblur = salvarNome;
  const cc = campoTexto({
    valor: D.portfolio.caract_campo, linhas: 9,
    aoSalvar: async (v) => { await db.upd("portfolios", { id: `eq.${D.portfolio.id}` }, { caract_campo: v }); D.portfolio.caract_campo = v; atualizarPercentuais(); },
  });
  campos.push(cc); campo.append(cc);

  const cidade = itemTexto("2.1.1", "Caracterização sócio-política, econômica, demográfica e religiosa da cidade/bairro onde foi realizado a prática pastoral", "caract_cidade");
  const figCid = el(`<div><div class="figuras" id="figs-cidade"></div></div>`);
  cidade.append(figCid);

  const igreja = itemTexto("2.1.1.1", "Igreja de apoio ou igreja base", "igreja_texto", { ajuda: "Descreva a igreja de apoio. Abaixo do texto ficam as figuras: o print do Google Maps e as fotos de dentro e da frente da igreja (lado a lado)." });
  igreja.append(el(`<div class="figuras" id="figs-igreja"></div>`));

  const org = itemTexto("2.1.1.2", "Organograma", "organograma_desc", { ajuda: "Antes do organograma, descreva a estrutura administrativa da sua igreja.", linhas: 6 });
  org.append(el(`<div id="org-area"></div>`));

  c.append(auto, campo, cidade, igreja, org);
  desenharFigurasB2();
  desenharOrganograma();
}

function rotFig(f) {
  const n = numerarFiguras(D).get(f.id);
  return { sup: `Figura ${n}. ${f.legenda_sup}`, inf: `Fonte ${n}. ${f.legenda_inf}` };
}

function cartaoFigura(f, { trocar = true } = {}) {
  const r = rotFig(f);
  const c = el(`<div class="figura"><div class="rot-fig">${esc(r.sup)}</div>
    <div class="imgs">${[f.url, f.url2].filter(Boolean).map((u) => `<img src="${esc(u)}" alt="" loading="lazy">`).join("")}</div>
    <p class="leg">${esc(r.inf)}</p>
    <span class="acoes-mini"><button data-a="legenda" title="Editar legendas">✏️</button>${trocar ? '<button data-a="trocar" title="Trocar foto">🔄</button>' : ""}<button data-a="excluir" title="Excluir">🗑</button></span></div>`);
  $('[data-a="legenda"]', c).onclick = () => editarFigura(f);
  if (trocar) $('[data-a="trocar"]', c).onclick = () => editarFigura(f, true);
  $('[data-a="excluir"]', c).onclick = async () => {
    if (!(await confirmar("Excluir esta figura?", "Excluir", true))) return;
    try {
      await db.del("figuras", { id: `eq.${f.id}` });
      apagarArquivo(f.url); apagarArquivo(f.url2);
      D.figuras = D.figuras.filter((x) => x !== f);
      redesenharFiguras();
    } catch (e) { erro(e); }
  };
  return c;
}

function vaga(titulo, texto, acao) {
  const v = el(`<div class="figura vazia" tabindex="0"><b>＋ ${esc(titulo)}</b><span style="font-size:13px">${esc(texto)}</span></div>`);
  v.onclick = acao;
  return v;
}

function redesenharFiguras() {
  desenharFigurasB2();
  if ($("#painel-dia")) desenharDia();
  atualizarPercentuais();
}

function desenharFigurasB2() {
  const cid = $("#figs-cidade");
  if (!cid) return;
  cid.innerHTML = "";
  D.figuras.filter((f) => f.local === "cidade").forEach((f) => cid.append(cartaoFigura(f)));
  cid.append(vaga("Adicionar figura", "Mapa, foto, tabela ou gráfico (como imagem)", () => novaFigura("cidade")));
  const ig = $("#figs-igreja");
  ig.innerHTML = "";
  const mapa = D.figuras.find((f) => f.local === "mapa"), igr = D.figuras.find((f) => f.local === "igreja");
  ig.append(mapa ? cartaoFigura(mapa) : vaga("Print do Google Maps", "Localização da igreja", () => novaFigura("mapa")));
  ig.append(igr ? cartaoFigura(igr) : vaga("Fotos da igreja", "Foto de dentro e foto da frente, lado a lado", () => novaFigura("igreja")));
}

// Janela de foto: escolher arquivo(s) + legenda superior e inferior
async function formFigura(local, f = null, soTrocar = false) {
  const dupla = local === "igreja";
  const n = f ? numerarFiguras(D).get(f.id) : "N";
  const corpo = el(`<div>
    <div class="grade2">${(dupla ? ["Foto de dentro da igreja", "Foto da frente da igreja"] : [local === "mapa" ? "Print do Google Maps" : "Imagem"]).map((r, i) => `
      <div><label class="rotulo">${r}</label><div class="figura vazia escolher" data-i="${i}" style="min-height:140px">${f && [f.url, f.url2][i] ? `<img src="${esc([f.url, f.url2][i])}" style="max-width:100%;max-height:130px;border-radius:6px">` : "<b>＋ Escolher imagem</b>"}</div></div>`).join("")}</div>
    <label class="rotulo">Legenda de cima</label>
    <div style="display:flex;gap:6px;align-items:center"><b style="white-space:nowrap">Figura ${n}.</b><input class="campo sup" placeholder="${local === "mapa" ? "Print da tela do Google Maps" : dupla ? "Imagens da Igreja Central de …" : "Descrição da imagem"}"></div>
    <label class="rotulo">Legenda de baixo</label>
    <div style="display:flex;gap:6px;align-items:center"><b style="white-space:nowrap">Fonte ${n}.</b><input class="campo inf"></div>
    <p class="dica-campo">O número da figura é colocado automaticamente, na ordem em que ela aparece no trabalho.</p></div>`);
  $(".sup", corpo).value = f?.legenda_sup ?? (local === "mapa" ? "Print da tela do Google Maps" : "");
  $(".inf", corpo).value = f?.legenda_inf ?? "Arquivo Pessoal.";
  const arquivos = [null, null];
  $$(".escolher", corpo).forEach((v) => (v.onclick = async () => {
    const a = await escolherArquivo();
    if (!a) return;
    const i = +v.dataset.i;
    arquivos[i] = await comprimir(a);
    v.innerHTML = `<img src="${URL.createObjectURL(arquivos[i])}" style="max-width:100%;max-height:130px;border-radius:6px">`;
  }));
  return janela({
    titulo: f ? (soTrocar ? "Trocar foto" : "Editar figura") : "Nova figura", corpo, larga: dupla,
    botoes: [{ rotulo: "Cancelar", valor: null }, {
      rotulo: "Salvar", classe: "primario", acao: async () => {
        const precisa = dupla ? 2 : 1;
        for (let i = 0; i < precisa; i++) if (!arquivos[i] && !(f && [f.url, f.url2][i])) throw new Error(dupla ? "Escolha as duas fotos." : "Escolha a imagem.");
        const urls = [];
        for (let i = 0; i < precisa; i++) urls[i] = arquivos[i] ? await subirArquivo(arquivos[i], D.perfil.id) : [f.url, f.url2][i];
        return { url: urls[0], url2: urls[1] || null, legenda_sup: $(".sup", corpo).value.trim(), legenda_inf: $(".inf", corpo).value.trim(), velhos: f ? [f.url, f.url2].filter((u, i) => u && arquivos[i]) : [] };
      },
    }],
  });
}

async function novaFigura(local, dia = null) {
  const r = await formFigura(local);
  if (!r) return;
  try {
    const ordem = D.figuras.filter((f) => f.local === local && (f.dia_id || null) === (dia?.id || null)).length;
    const nova = await db.ins("figuras", { portfolio_id: D.portfolio.id, local, dia_id: dia?.id || null, url: r.url, url2: r.url2, legenda_sup: r.legenda_sup, legenda_inf: r.legenda_inf, ordem });
    D.figuras.push(nova);
    redesenharFiguras();
    aviso("Figura salva.");
  } catch (e) { erro(e); }
}

async function editarFigura(f, soTrocar = false) {
  const r = await formFigura(f.local, f, soTrocar);
  if (!r) return;
  try {
    const { velhos, ...dados } = r;
    Object.assign(f, await db.upd("figuras", { id: `eq.${f.id}` }, dados));
    velhos.forEach(apagarArquivo);
    redesenharFiguras();
  } catch (e) { erro(e); }
}

// ------------------------------------------------------------------ organograma
function desenharOrganograma() {
  const a = $("#org-area");
  if (!a) return;
  a.innerHTML = D.portfolio.organograma_url
    ? `<img class="miniatura-org" src="${esc(D.portfolio.organograma_url)}" alt="Organograma"><button class="botao primario">✏️ Editar organograma</button>`
    : `<button class="botao primario">🧩 Abrir editor do organograma</button>`;
  $("button", a).onclick = async () => {
    const { abrirEditor } = await import("./organograma.js?v=1");
    abrirEditor({
      json: D.portfolio.organograma_json,
      aoSalvar: async (json, png) => {
        const url = await subirArquivo(png, D.perfil.id, "png");
        const velho = D.portfolio.organograma_url;
        await db.upd("portfolios", { id: `eq.${D.portfolio.id}` }, { organograma_json: json, organograma_url: url });
        D.portfolio.organograma_json = json; D.portfolio.organograma_url = url;
        if (velho) apagarArquivo(velho);
        desenharOrganograma(); atualizarPercentuais();
      },
    });
  };
}

// ------------------------------------------------------------------ bloco 3
function minutosDoDia(d) { return D.atividades.filter((a) => a.dia_id === d.id).reduce((s, a) => s + a.minutos, 0); }

function bloco3() {
  const c = $("#b3 .bloco-corpo");
  const { dias } = organizar(D);
  if (!diaSel || !dias.some((d) => d.id === diaSel)) diaSel = dias[dias.length - 1]?.id || null;
  c.innerHTML = `<div class="item"><div class="item-cab"><h3><span class="n">2.2</span>Atividades desenvolvidas pelo estagiário</h3></div>
    <div class="texto-auto"><span class="rot">Texto automático</span>${esc(textoSecao22(dias.length))}</div></div>
    <div class="item"><div class="faixa-dias" id="faixa-dias"></div><div id="painel-dia"></div></div>`;
  const f = $("#faixa-dias", c);
  dias.forEach((d, i) => {
    const ch = el(`<button class="dia-chip ${d.id === diaSel ? "ativo" : ""}"><span class="horas">${fmtMin(minutosDoDia(d))}</span>
      <small>2.2.${i + 1}</small><b>Dia ${fmtCurta(d.data)}</b></button>`);
    ch.onclick = () => { diaSel = d.id; bloco3(); };
    f.append(ch);
  });
  const novo = el(`<button class="dia-chip dia-novo">＋ Ad. novo dia</button>`);
  novo.onclick = novoDia;
  f.append(novo);
  desenharDia();
  if ($(".dia-chip.ativo", f)) $(".dia-chip.ativo", f).scrollIntoView({ block: "nearest", inline: "nearest" });
}

async function pedirData(valor = "") {
  const d = D.disciplina;
  const corpo = el(`<div><label class="rotulo">Data do dia de prática</label><input type="date" class="campo">
    ${d.inicio ? `<p class="dica-campo">Entre ${fmtData(d.inicio)} e ${fmtData(d.fim)}.</p>` : ""}</div>`);
  const i = $("input", corpo);
  i.value = valor; if (d.inicio) i.min = d.inicio; if (d.fim) i.max = d.fim;
  return janela({ titulo: valor ? "Alterar data" : "Novo dia de prática", corpo, botoes: [{ rotulo: "Cancelar", valor: null }, { rotulo: "Salvar", classe: "primario", acao: () => i.value || false }] });
}

async function novoDia() {
  const data = await pedirData();
  if (!data) return;
  try {
    const d = await db.ins("dias", { portfolio_id: D.portfolio.id, data });
    D.dias.push(d); diaSel = d.id;
    bloco3(); bloco2Auto(); atualizarPercentuais();
  } catch (e) { erro(e); }
}

function bloco2Auto() { const s = $("#auto-s2"); if (s) s.textContent = textoSecao2(D.dias.length); }

function desenharDia() {
  const painel = $("#painel-dia");
  if (!painel) return;
  const { dias } = organizar(D);
  const d = dias.find((x) => x.id === diaSel);
  if (!d) { painel.innerHTML = '<p class="vazio">Adicione o primeiro dia de prática para lançar os requisitos cumpridos.</p>'; return; }
  const idx = dias.indexOf(d) + 1;
  const ativs = organizar(D).ativPorDia.get(d.id) || [];
  const fotos = D.figuras.filter((f) => f.local === "dia" && f.dia_id === d.id).sort((a, b) => a.ordem - b.ordem);
  painel.className = "painel-dia";
  painel.innerHTML = `<div class="painel-dia-cab"><div><small class="leve">2.2.${idx}</small><h3 style="font-size:16px">Dia ${esc(dataExtenso(d.data))}</h3>
      <small class="leve">Total do dia: <b>${fmtMin(minutosDoDia(d))}</b></small></div>
      <span class="acoes-mini"><button data-a="data" title="Alterar data">✏️</button><button data-a="excluir" title="Excluir dia">🗑</button></span></div>
    <div class="item-cab"><b style="flex:1">Requisitos cumpridos:</b>${fotos.length ? `<button class="botao pequeno ver-fotos">🖼 Visualizar fotos (${fotos.length})</button>` : ""}</div>
    <div id="lista-ativ"></div>
    <div class="linha-botoes"><button class="botao primario add-req">＋ Ad. novo requisito</button></div>
    <div class="linha-botoes"><button class="botao add-foto">📷 Adicionar foto</button></div>
    <div id="fotos-dia" hidden></div>`;
  const lista = $("#lista-ativ", painel);
  lista.innerHTML = ativs.length ? "" : '<p class="vazio">Nenhum requisito lançado neste dia.</p>';
  ativs.forEach((a, k) => {
    const r = D.requisitos.find((x) => x.id === a.requisito_id);
    const faltam = PERGUNTAS.filter(([c]) => !cheio(a[c])).length;
    const card = el(`<div class="atividade"><div class="atividade-cab">
      <span class="leve" style="font-size:12px">2.2.${idx}.${k + 1}</span><span class="texto">${esc(r?.enunciado || "(requisito removido)")}</span>
      ${faltam ? `<span class="pendente-selo">${faltam} em branco</span>` : ""}<span class="tempo">${fmtMin(a.minutos)}</span>
      <span class="acoes-mini"><button data-a="editar" title="Editar">✏️</button><button data-a="excluir" title="Excluir">🗑</button></span></div>
      <div class="atividade-corpo" hidden>${PERGUNTAS.map(([c, rot]) => `<p><b>${rot}</b> ${cheio(a[c]) ? esc(a[c]) : '<span class="vazio-r">(em branco)</span>'}</p>`).join("")}</div></div>`);
    $(".atividade-cab", card).onclick = (ev) => { if (!ev.target.closest("button")) $(".atividade-corpo", card).hidden ^= true; };
    $('[data-a="editar"]', card).onclick = () => formAtividade(d, a);
    $('[data-a="excluir"]', card).onclick = async () => {
      if (!(await confirmar("Excluir este requisito cumprido? As respostas escritas serão apagadas.", "Excluir", true))) return;
      try { await db.del("atividades", { id: `eq.${a.id}` }); D.atividades = D.atividades.filter((x) => x !== a); bloco3(); atualizarPercentuais(); }
      catch (e) { erro(e); }
    };
    lista.append(card);
  });
  $(".add-req", painel).onclick = () => formAtividade(d);
  $(".add-foto", painel).onclick = () => novaFigura("dia", d);
  const vf = $(".ver-fotos", painel);
  if (vf) vf.onclick = () => {
    const box = $("#fotos-dia", painel);
    box.hidden = !box.hidden;
    if (!box.hidden) {
      box.innerHTML = '<div class="figuras"></div>';
      fotos.forEach((f) => $(".figuras", box).append(cartaoFigura(f)));
      $(".figuras", box).append(vaga("Adicionar foto", "Fica no fim das atividades do dia", () => novaFigura("dia", d)));
    }
  };
  $('[data-a="data"]', painel).onclick = async () => {
    const data = await pedirData(d.data);
    if (!data || data === d.data) return;
    try { Object.assign(d, await db.upd("dias", { id: `eq.${d.id}` }, { data })); bloco3(); redesenharFiguras(); } catch (e) { erro(e); }
  };
  $('[data-a="excluir"]', painel).onclick = async () => {
    const n = ativs.length, nf = fotos.length;
    if (!(await confirmar(`Excluir o dia ${fmtData(d.data)}${n || nf ? ` com ${n} requisito(s) e ${nf} foto(s)` : ""}? Não dá para desfazer.`, "Excluir dia", true))) return;
    try {
      await db.del("dias", { id: `eq.${d.id}` });
      fotos.forEach((f) => { apagarArquivo(f.url); });
      D.dias = D.dias.filter((x) => x !== d);
      D.atividades = D.atividades.filter((a) => a.dia_id !== d.id);
      D.figuras = D.figuras.filter((f) => f.dia_id !== d.id);
      diaSel = null; bloco3(); bloco2Auto(); redesenharFiguras();
    } catch (e) { erro(e); }
  };
}

// Janela do requisito cumprido: requisito, tempo, perguntas A–E
async function formAtividade(dia, a = null) {
  const usados = (rid) => D.atividades.filter((x) => x.requisito_id === rid && x !== a).length;
  const noDia = new Set(D.atividades.filter((x) => x.dia_id === dia.id && x !== a).map((x) => x.requisito_id));
  const opcoes = D.requisitos.filter((r) => !r.arquivado || r.id === a?.requisito_id).map((r) => {
    const u = usados(r.id), cheioR = r.quantidade && u >= r.quantidade, jaNoDia = noDia.has(r.id);
    const info = r.quantidade ? `${u}/${r.quantidade}` : `${u}× · todos os dias`;
    return `<option value="${r.id}" ${(cheioR || jaNoDia) && r.id !== a?.requisito_id ? "disabled" : ""}>${esc(r.enunciado)} (${info}${cheioR ? " · completo" : jaNoDia ? " · já neste dia" : ""})</option>`;
  });
  const corpo = el(`<div>
    <label class="rotulo">Requisito cumprido <span class="obrig">*</span></label>
    <select class="campo req"><option value="">Selecione o requisito…</option>${opcoes.join("")}</select>
    <label class="rotulo">Quantidade de horas / minutos gastos nessa atividade <span class="obrig">*</span></label>
    <div style="display:flex;gap:8px;align-items:center"><input type="number" min="0" max="24" class="campo hh" style="width:90px" placeholder="0"> h
      <input type="number" min="0" max="59" step="5" class="campo mm" style="width:90px" placeholder="0"> min</div>
    ${PERGUNTAS.map(([c, rot]) => `<label class="rotulo">${rot}</label><textarea class="campo" data-c="${c}" rows="4"></textarea>
      <div class="campo-rodape"><span class="estado"></span><button type="button" class="botao pequeno nota" data-c="${c}">¹ Nota</button><span class="contador" data-c="${c}">0 palavras</span></div>`).join("")}
    <p class="dica-campo">Pode salvar mesmo com respostas em branco e completar depois. No arquivo final, as perguntas em branco aparecem assim mesmo.</p></div>`);
  const sel = $(".req", corpo);
  if (a) { sel.value = a.requisito_id; $(".hh", corpo).value = Math.floor(a.minutos / 60); $(".mm", corpo).value = a.minutos % 60; }
  for (const [c] of PERGUNTAS) {
    const ta = $(`textarea[data-c="${c}"]`, corpo), ct = $(`.contador[data-c="${c}"]`, corpo);
    ta.value = a?.[c] || "";
    const contar = () => { const n = palavras(ta.value); ct.textContent = `${n} ${n === 1 ? "palavra" : "palavras"}`; };
    ta.oninput = contar; contar();
    $(`.nota[data-c="${c}"]`, corpo).onclick = async () => {
      const t = await pedirTexto("Nota de rodapé", "Texto da nota:", "", true);
      if (t) { ta.setRangeText(`[[nota: ${t}]]`, ta.selectionEnd, ta.selectionEnd, "end"); contar(); }
    };
  }
  await janela({
    titulo: a ? "Editar requisito cumprido" : "Novo requisito cumprido", corpo, larga: true, fixa: true,
    botoes: [{ rotulo: "Cancelar", valor: null }, {
      rotulo: "Salvar", classe: "primario", acao: async () => {
        const rid = sel.value;
        if (!rid) throw new Error("Escolha o requisito.");
        const min = (parseInt($(".hh", corpo).value || "0", 10) * 60) + parseInt($(".mm", corpo).value || "0", 10);
        if (!(min > 0)) throw new Error("Informe quanto tempo a atividade levou.");
        const dados = { requisito_id: rid, minutos: min };
        for (const [c] of PERGUNTAS) dados[c] = $(`textarea[data-c="${c}"]`, corpo).value.trim();
        if (a) Object.assign(a, await db.upd("atividades", { id: `eq.${a.id}` }, dados));
        else D.atividades.push(await db.ins("atividades", { dia_id: dia.id, ...dados }));
        bloco3(); atualizarPercentuais();
        aviso("Requisito salvo.");
      },
    }],
  });
}

// ------------------------------------------------------------------ bloco 4
function bloco4() {
  const c = $("#b4 .bloco-corpo");
  c.append(
    itemTexto("2.3", "Análise dos resultados", "analise"),
    itemTexto("2.5", "Conclusão", "conclusao"),
  );
  const ref = el(`<div class="item"><div class="item-cab"><h3><span class="n">2.6</span>Referências</h3><button class="botao-dica">💡 Dica</button></div>
    <ul class="lista-ref" id="lista-ref"></ul><div class="linha-botoes"><button class="botao primario add-ref">＋ Adicionar referência</button></div></div>`);
  $(".botao-dica", ref).onclick = () => janela({ titulo: "Referências", corpo: `<p>${esc(DICAS.referencias)}</p>` });
  $(".add-ref", ref).onclick = () => formReferencia();
  c.append(ref);
  desenharRefs();
}

const refHtml = (t) => esc(t).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/\*([^*]+?)\*/g, "<i>$1</i>");

function desenharRefs() {
  const ul = $("#lista-ref");
  const lista = [...D.referencias].sort((a, b) => a.texto.localeCompare(b.texto, "pt-BR", { sensitivity: "base" }));
  ul.innerHTML = lista.length ? "" : '<li class="vazio">Nenhuma referência ainda.</li>';
  lista.forEach((r) => {
    const li = el(`<li><span class="texto">${refHtml(r.texto)}</span><span class="acoes-mini"><button data-a="e" title="Editar">✏️</button><button data-a="x" title="Excluir">🗑</button></span></li>`);
    $('[data-a="e"]', li).onclick = () => formReferencia(r);
    $('[data-a="x"]', li).onclick = async () => {
      if (!(await confirmar("Excluir esta referência?", "Excluir", true))) return;
      try { await db.del("referencias", { id: `eq.${r.id}` }); D.referencias = D.referencias.filter((x) => x !== r); desenharRefs(); atualizarPercentuais(); }
      catch (e) { erro(e); }
    };
    ul.append(li);
  });
}

async function formReferencia(r = null) {
  const corpo = el(`<div><div class="ferramentas" style="display:flex;gap:6px;margin-bottom:6px">
      <button type="button" class="botao pequeno" data-m="**"><b>N</b></button><button type="button" class="botao pequeno" data-m="*"><i>I</i></button></div>
    <textarea class="campo" rows="4" placeholder="Ex.: IBGE. Belém: panorama. **Cidades e Estados**, 2026. Disponível em: https://... Acesso em: 01 set. 2026."></textarea>
    <p class="dica-campo">Selecione o título e toque em N (negrito) ou I (itálico).</p></div>`);
  const ta = $("textarea", corpo);
  ta.value = r?.texto || "";
  $$("[data-m]", corpo).forEach((b) => (b.onclick = () => {
    const m = b.dataset.m, s = ta.selectionStart, e = ta.selectionEnd;
    ta.setRangeText(m + (ta.value.slice(s, e) || "título") + m, s, e, "end"); ta.focus();
  }));
  const salvar = async () => {
    const texto = ta.value.trim().replace(/\s*\n\s*/g, " ");
    if (!texto) throw new Error("Escreva a referência.");
    if (r) Object.assign(r, await db.upd("referencias", { id: `eq.${r.id}` }, { texto }));
    else D.referencias.push(await db.ins("referencias", { portfolio_id: D.portfolio.id, texto }));
    desenharRefs(); atualizarPercentuais();
  };
  await janela({
    titulo: r ? "Editar referência" : "Nova referência", corpo, larga: true,
    botoes: [{ rotulo: "Cancelar", valor: null },
      ...(!r ? [{ rotulo: "Salvar e adicionar outra", fica: true, acao: async () => { await salvar(); ta.value = ""; ta.focus(); aviso("Referência salva."); } }] : []),
      { rotulo: "Salvar", classe: "primario", acao: salvar }],
  });
}

// ------------------------------------------------------------------ quadro, prévia e Word
async function abrirQuadro() {
  const q = linhasQuadro(D);
  janela({
    titulo: "2.4 Quadro resumo das atividades de extensão", larga: true,
    corpo: `<p class="leve" style="margin-top:0">Preenchido sozinho com as horas dos requisitos cumpridos. Só para conferir.</p>
      <div class="tabela-rolagem"><table class="quadro"><thead><tr><th>Atividade</th><th>Período</th><th>Horas</th></tr></thead><tbody>
      ${q.linhas.map((l) => `<tr><td>${esc(l.atividade)}</td><td class="c">${esc(l.periodo)}</td><td class="c">${esc(l.horas)}</td></tr>`).join("")}
      <tr class="total"><td colspan="2">Total de horas da Extensão Curricular Supervisionada</td><td class="c">${esc(q.total)}</td></tr></tbody></table></div>
      ${D.disciplina.carga_requerida ? `<p class="leve">Carga horária requerida: ${String(D.disciplina.carga_requerida).replace(".", ",")} horas.</p>` : ""}`,
  });
}

async function salvarPendentes() { for (const c of campos) if (c.pendente()) await c.salvar(); }

async function visualizar() {
  await salvarPendentes();
  const { abrirPrevia } = await import("./previa.js?v=1");
  abrirPrevia(D, { aoGerar: gerar });
}

async function gerar() {
  await salvarPendentes();
  const { gerarWord } = await import("./word.js?v=1");
  aviso("Gerando o arquivo Word…");
  try { await gerarWord(D); } catch (e) { erro(e); }
}

iniciar().catch(erro);

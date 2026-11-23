// Painel do administrador: disciplinas, requisitos, turmas, professor orientador,
// geração do atualizacaoN.zip e área de downloads. Nada de dados de alunos.
import { db, logado, usuarioId, subirArquivo, apagarArquivo, urlPublica } from "./supa.js";
import {
  $, $$, el, esc, aviso, erro, janela, confirmar, confirmarDigitando, montarTopo, travarAteMudar,
  fmtData, escolherArquivo, tamanho,
} from "./ui.js";
import { zipar } from "./zip.js";

if (!logado()) location.replace("entrar.html");

let eu, turmas = [], disciplinas = [];
const LIMITE = 50 * 1024 * 1024;   // limite por arquivo do plano gratuito do Supabase

async function iniciar() {
  eu = await db.um("perfis", { id: `eq.${usuarioId()}` });
  if (!eu || eu.papel !== "admin") { location.replace("entrar.html"); return; }
  const ver = el('<a class="icone-topo" href="index.html" title="Ver a página de downloads">⬇<span class="texto-topo">Página de downloads</span></a>');
  montarTopo(eu, { rotuloPapel: "Administrador", linhas: [["E-mail", eu.email]], sino: false, instalavel: false, extras: [ver] });
  $$("#abas button").forEach((b) => (b.onclick = () => abrirAba(b.dataset.aba)));
  await recarregarListas();
  abrirAba("disciplinas");
  armazenamento();
}

async function recarregarListas() {
  [turmas, disciplinas] = await Promise.all([
    db.sel("turmas", { order: "nome.asc" }),
    db.sel("disciplinas", { order: "criado_em.asc" }),
  ]);
}

function abrirAba(nome) {
  $$("#abas button").forEach((b) => b.classList.toggle("ativa", b.dataset.aba === nome));
  $$("main > section").forEach((s) => (s.hidden = s.id !== "aba-" + nome));
  ({ disciplinas: abaDisciplinas, turmas: abaTurmas, orientador: abaOrientador, gerar: abaGerar, downloads: abaDownloads })[nome]().catch(erro);
}

async function armazenamento() {
  try {
    const u = await db.rpc("uso_downloads");
    const mb = u.bytes / 1048576, pct = Math.min(100, (mb / 1024) * 100);
    $("#armaz .barra span").style.width = pct.toFixed(1) + "%";
    $("#armaz .leve").textContent = `${mb.toFixed(1).replace(".", ",")} MB de 1024 MB · ${u.arquivos} arquivo(s)`;
  } catch { $("#armaz .leve").textContent = "—"; }
}

const opcoes = (lista, sel, vazio = "Selecione…") =>
  `<option value="">${vazio}</option>` + lista.map((x) => `<option value="${x.id}" ${x.id === sel ? "selected" : ""}>${esc(x.nome)}</option>`).join("");

// =====================================================================
// 1ª aba — Disciplinas e requisitos
// =====================================================================
let discAtual = null;

async function abaDisciplinas() {
  await recarregarListas();
  if (!discAtual || !disciplinas.some((d) => d.id === discAtual)) discAtual = disciplinas.find((d) => !d.arquivada)?.id || disciplinas[0]?.id || null;
  const s = $("#aba-disciplinas");
  s.innerHTML = `<div class="chips" id="chips-disc"></div><div id="disc-corpo"></div>`;
  const chips = $("#chips-disc", s);
  for (const d of disciplinas) {
    const c = el(`<button class="chip ${d.id === discAtual ? "ativo" : ""} ${d.arquivada ? "arquivada" : ""}">${esc(d.nome)}</button>`);
    c.onclick = () => { discAtual = d.id; abaDisciplinas(); };
    chips.append(c);
  }
  const nova = el(`<button class="botao contorno">＋ Ad. nova disciplina</button>`);
  nova.onclick = novaDisciplina;
  chips.append(nova);
  if (!discAtual) {
    $("#disc-corpo", s).innerHTML = '<div class="cartao vazio">Nenhuma disciplina cadastrada. Use “Ad. nova disciplina”.</div>';
    return;
  }
  await desenharDisciplina(disciplinas.find((d) => d.id === discAtual));
}

async function novaDisciplina() {
  const corpo = el(`<div><label class="rotulo">Nome da disciplina</label>
    <input class="campo" placeholder="Ex.: Extensão: Prática Pastoral Comunitária II"></div>`);
  const nome = await janela({
    titulo: "Nova disciplina", corpo,
    botoes: [{ rotulo: "Cancelar", valor: null }, { rotulo: "Criar", classe: "primario", acao: () => $("input", corpo).value.trim() || false }],
  });
  if (!nome) return;
  try {
    const d = await db.ins("disciplinas", { nome });
    discAtual = d.id;
    await abaDisciplinas();
  } catch (e) { erro(e); }
}

async function desenharDisciplina(d) {
  const corpo = $("#disc-corpo");
  const reqsTodos = await db.sel("requisitos", { disciplina_id: `eq.${d.id}`, order: "ordem.asc,criado_em.asc" });
  // "Confecção do portfólio" é automático: fica fora da lista editável e sempre por último
  const reqs = reqsTodos.filter((r) => !r.fixo), fixos = reqsTodos.filter((r) => r.fixo);
  corpo.innerHTML = "";
  const c = el(`<div class="cartao">
    <div class="item-cab"><h3 style="font-size:17px">${esc(d.nome)} ${d.arquivada ? '<span class="selo-p inativo">arquivada</span>' : ""}</h3>
      <span class="acoes-mini"><button data-a="renomear" title="Renomear">✏️</button>
      <button data-a="arquivar" title="${d.arquivada ? "Reativar" : "Arquivar"}">${d.arquivada ? "▶" : "🗄"}</button>
      <button data-a="excluir" title="Excluir toda a disciplina">🗑</button></span></div>
    <form class="form-disc">
      <div class="grade2">
        <div><label class="rotulo">Carga horária requerida (h)</label><input name="carga_requerida" type="number" min="0" step="0.5" class="campo"></div>
        <div><label class="rotulo">Carga horária semanal (h)</label><input name="carga_semanal" type="number" min="0" step="0.5" class="campo"></div>
      </div>
      <div class="grade2">
        <div><label class="rotulo">Início do período (primeiro dia de prática)</label><input name="inicio" type="date" class="campo"></div>
        <div><label class="rotulo">Último dia de prática</label><input name="fim" type="date" class="campo"></div>
      </div>
      <label class="rotulo">Horário das atividades</label>
      <input name="horario" class="campo" placeholder="8:00 horas às 12:00 horas e das 14:00 horas às 18:00 horas">
      <div class="dica-campo">Entra no texto automático da carga horária: “… no horário de <i>[o que você escrever aqui]</i>.”</div>
      <div class="linha-botoes"><button type="button" class="botao primario salvar-disc">Salvar dados da disciplina</button></div>
    </form>
    <div class="caixa-lista"><div class="caixa-lista-topo"><b>Requisitos da disciplina (${reqs.filter((r) => !r.arquivado).length + fixos.length})</b>
      <button class="botao pequeno primario" data-a="novo-req">＋ Ad. novo requisito</button></div>
      <div class="caixa-lista-corpo" id="lista-reqs"></div></div>
    <p class="dica-campo">As mudanças só chegam aos alunos depois de <b>Gerar atualização</b>.</p>
  </div>`);
  corpo.append(c);
  const f = $(".form-disc", c);
  for (const k of ["carga_requerida", "carga_semanal", "inicio", "fim", "horario"]) f[k].value = d[k] ?? "";
  const trava = travarAteMudar(f, $(".salvar-disc", c));
  $(".salvar-disc", c).onclick = async () => {
    const dados = {};
    for (const k of ["carga_requerida", "carga_semanal"]) dados[k] = f[k].value === "" ? null : Number(f[k].value);
    dados.inicio = f.inicio.value || null; dados.fim = f.fim.value || null; dados.horario = f.horario.value.trim() || null;
    if (dados.inicio && dados.fim && dados.fim < dados.inicio) return aviso("O último dia vem antes do primeiro.", "erro");
    try { await db.upd("disciplinas", { id: `eq.${d.id}` }, dados); Object.assign(d, dados); trava.salvo(); aviso("Disciplina salva."); }
    catch (e) { erro(e); }
  };

  // requisitos
  const lr = $("#lista-reqs", c);
  lr.innerHTML = reqs.map((r, i) => `<div class="linha-item ${r.arquivado ? "arquivado" : ""}" data-id="${r.id}">
      <span class="texto">${esc(r.enunciado)}</span>
      <span class="meta">Quantidade: ${r.quantidade ? r.quantidade + (r.quantidade === 1 ? " vez" : " vezes") : "todos os dias de prática"}${r.arquivado ? " · arquivado" : ""}</span>
      <span class="acoes-mini">
        <button data-a="subir" title="Subir" ${i === 0 ? "disabled" : ""}>↑</button>
        <button data-a="editar" title="Editar">✏️</button>
        <button data-a="arquivar" title="${r.arquivado ? "Reativar" : "Arquivar"}">${r.arquivado ? "▶" : "🗄"}</button>
        <button data-a="excluir" title="Excluir">🗑</button></span></div>`).join("")
    + fixos.map((r) => `<div class="linha-item"><span class="texto"><b>${esc(r.enunciado)}</b></span>
      <span class="meta">O aluno informa as horas · aparece só no quadro-resumo</span><span class="selo-fixo">automático · obrigatório</span></div>`).join("");
  $$("button[data-a]", lr).forEach((b) => (b.onclick = () => {
    const r = reqs.find((x) => x.id === b.closest(".linha-item").dataset.id);
    acaoRequisito(b.dataset.a, r, reqs, d);
  }));
  $('[data-a="novo-req"]', c).onclick = () => editarRequisito(null, d, reqs);

  // disciplina
  $('.item-cab [data-a="renomear"]', c).onclick = async () => {
    const corpoR = el(`<div><label class="rotulo">Nome da disciplina</label><input class="campo"></div>`);
    $("input", corpoR).value = d.nome;
    const nome = await janela({ titulo: "Renomear disciplina", corpo: corpoR, botoes: [{ rotulo: "Cancelar", valor: null }, { rotulo: "Salvar", classe: "primario", acao: () => $("input", corpoR).value.trim() || false }] });
    if (!nome) return;
    try { await db.upd("disciplinas", { id: `eq.${d.id}` }, { nome }); abaDisciplinas(); } catch (e) { erro(e); }
  };
  $('.item-cab [data-a="arquivar"]', c).onclick = async () => {
    const ok = await confirmar(d.arquivada ? "Reativar esta disciplina? Ela volta para a lista do programa na próxima atualização." : "Arquivar esta disciplina? Na próxima atualização ela deixa de aparecer para quem ainda vai escolher a disciplina. Quem já está nela continua com tudo.", d.arquivada ? "Reativar" : "Arquivar");
    if (!ok) return;
    try { await db.upd("disciplinas", { id: `eq.${d.id}` }, { arquivada: !d.arquivada }); abaDisciplinas(); } catch (e) { erro(e); }
  };
  $('.item-cab [data-a="excluir"]', c).onclick = async () => {
    try {
      const ok = await confirmarDigitando("Excluir a disciplina apaga também todos os requisitos dela. Se algum aluno já usa esta disciplina, prefira Arquivar (🗄): o programa dele continua funcionando, mas é mais seguro.", d.nome);
      if (!ok) return;
      await db.del("disciplinas", { id: `eq.${d.id}` });
      discAtual = null; aviso("Disciplina excluída."); abaDisciplinas();
    } catch (e) { erro(e); }
  };
}

async function acaoRequisito(acao, r, reqs, d) {
  try {
    if (acao === "editar") return editarRequisito(r, d, reqs);
    if (acao === "subir") {
      const i = reqs.indexOf(r), ant = reqs[i - 1];
      await Promise.all(reqs.map((x, k) => db.upd("requisitos", { id: `eq.${x.id}` }, { ordem: x === r ? i - 1 : x === ant ? i : k })));
      return desenharDisciplina(d);
    }
    if (acao === "arquivar") {
      await db.upd("requisitos", { id: `eq.${r.id}` }, { arquivado: !r.arquivado });
      aviso(r.arquivado ? "Requisito reativado." : "Requisito arquivado: na próxima atualização some da lista para novos lançamentos, mas continua no trabalho de quem já escreveu.");
      return desenharDisciplina(d);
    }
    if (acao === "excluir") {
      if (!(await confirmar(`Excluir o requisito “${r.enunciado}”? Se algum aluno já o lançou, o texto dele continua no trabalho, mas o requisito não aparece mais para novos lançamentos. Para isso, Arquivar (🗄) já basta.`, "Excluir", true))) return;
      await db.del("requisitos", { id: `eq.${r.id}` });
      desenharDisciplina(d);
    }
  } catch (e) { erro(e); }
}

async function editarRequisito(r, d, reqs) {
  const corpo = el(`<div>
    <label class="rotulo">Enunciado do requisito</label><textarea class="campo" rows="3"></textarea>
    <label class="rotulo">Quantidade de vezes que deve ser cumprido</label>
    <div class="grade2"><input type="number" min="1" class="campo qtd" placeholder="Ex.: 2">
      <label class="marcar-linha"><input type="checkbox" class="todos"> Todos os dias de prática (sem limite)</label></div>
    <p class="dica-campo aviso-uso"></p></div>`);
  const ta = $("textarea", corpo), q = $(".qtd", corpo), t = $(".todos", corpo);
  ta.value = r?.enunciado || ""; q.value = r?.quantidade || ""; t.checked = !!r && !r.quantidade;
  q.disabled = t.checked;
  t.onchange = () => { q.disabled = t.checked; if (t.checked) q.value = ""; };
  if (r) $(".aviso-uso", corpo).textContent = "Se algum aluno já lançou este requisito, o texto novo aparece no trabalho dele depois que ele importar a próxima atualização.";
  await janela({
    titulo: r ? "Editar requisito" : "Novo requisito", corpo,
    botoes: [{ rotulo: "Cancelar", valor: null },
      ...(!r ? [{ rotulo: "Salvar e adicionar outro", fica: true, acao: async () => { await gravarReq(); ta.value = ""; q.value = ""; t.checked = false; q.disabled = false; ta.focus(); aviso("Requisito salvo."); } }] : []),
      { rotulo: "Salvar", classe: "primario", acao: async () => { await gravarReq(); } }],
  });
  async function gravarReq() {
    const enunciado = ta.value.trim().replace(/\s+/g, " ");
    if (!enunciado) throw new Error("Escreva o enunciado.");
    const quantidade = t.checked ? null : parseInt(q.value, 10);
    if (!t.checked && !(quantidade > 0)) throw new Error("Informe a quantidade ou marque “todos os dias de prática”.");
    if (r) await db.upd("requisitos", { id: `eq.${r.id}` }, { enunciado, quantidade });
    else { await db.ins("requisitos", { disciplina_id: d.id, enunciado, quantidade, ordem: reqs.length }); reqs.push({}); }
  }
  desenharDisciplina(d);
}

// =====================================================================
// 2ª aba — Turmas
// =====================================================================
async function abaTurmas() {
  await recarregarListas();
  const s = $("#aba-turmas");
  s.innerHTML = `<div class="cartao"><h2>Cadastro de turmas</h2>
    <p class="leve" style="margin-top:0">Estas turmas aparecem para o aluno escolher no programa (depois de Gerar atualização).</p>
    <div class="filtros"><input class="campo" id="nova-turma" placeholder="Ex.: 16ª Turma"><button class="botao primario" id="add-turma">＋ Adicionar turma</button></div>
    <div class="caixa-lista"><div class="caixa-lista-corpo" style="max-height:none">${turmas.map((t) => `
      <div class="linha-item" data-id="${t.id}"><span class="texto"><b>${esc(t.nome)}</b></span>
      <span class="acoes-mini"><button data-a="editar" title="Renomear">✏️</button><button data-a="excluir" title="Excluir">🗑</button></span></div>`).join("") || '<p class="vazio">Nenhuma turma cadastrada.</p>'}
    </div></div></div>`;
  const add = async () => {
    const nome = $("#nova-turma").value.trim();
    if (!nome) return;
    try { await db.ins("turmas", { nome }); aviso("Turma adicionada."); abaTurmas(); } catch (e) { erro(e); }
  };
  $("#add-turma").onclick = add;
  $("#nova-turma").onkeydown = (e) => { if (e.key === "Enter") add(); };
  $$("button[data-a]", s).forEach((b) => (b.onclick = async () => {
    const t = turmas.find((x) => x.id === b.closest(".linha-item").dataset.id);
    try {
      if (b.dataset.a === "editar") {
        const corpo = el(`<div><label class="rotulo">Nome da turma</label><input class="campo"></div>`);
        $("input", corpo).value = t.nome;
        const nome = await janela({ titulo: "Renomear turma", corpo, botoes: [{ rotulo: "Cancelar", valor: null }, { rotulo: "Salvar", classe: "primario", acao: () => $("input", corpo).value.trim() || false }] });
        if (nome) { await db.upd("turmas", { id: `eq.${t.id}` }, { nome }); abaTurmas(); }
      } else {
        const ok = await confirmar(`Excluir a turma ${t.nome}? Quem já escolheu esta turma no programa continua com ela; ela só deixa de aparecer para escolha.`, "Excluir", true);
        if (ok) { await db.del("turmas", { id: `eq.${t.id}` }); abaTurmas(); }
      }
    } catch (e) { erro(e); }
  }));
}

// =====================================================================
// 3ª aba — Professor orientador
// =====================================================================
async function abaOrientador() {
  const c = await db.um("config", { id: "eq.1" });
  const s = $("#aba-orientador");
  const atual = c?.orientador || "";
  s.innerHTML = `<div class="cartao"><h2>Professor orientador</h2>
    <p class="leve" style="margin-top:0">Aparece na folha de rosto de todos os portfólios, em “Docente Orientador” (depois de Gerar atualização).</p>
    ${atual ? `<div class="linha-item" style="border:1px solid var(--linha);border-radius:10px"><span class="texto"><b>${esc(atual)}</b></span>
      <span class="acoes-mini"><button data-a="editar" title="Editar">✏️</button><button data-a="excluir" title="Excluir">🗑</button></span></div>`
    : `<label class="rotulo">Nome como deve sair no trabalho</label><input class="campo" id="orient" placeholder="Ex.: Pr. Dr. Antônio Gonçalves Pires">
       <div class="linha-botoes"><button class="botao primario" id="salvar-orient">Salvar</button></div>`}</div>`;
  const salvar = async (nome) => { await db.upd("config", { id: "eq.1" }, { orientador: nome }); abaOrientador(); };
  if (!atual) $("#salvar-orient").onclick = () => { const n = $("#orient").value.trim(); if (n) salvar(n).catch(erro); };
  else {
    $('[data-a="editar"]', s).onclick = async () => {
      const corpo = el(`<div><label class="rotulo">Nome do professor orientador</label><input class="campo"></div>`);
      $("input", corpo).value = atual;
      const n = await janela({ titulo: "Editar orientador", corpo, botoes: [{ rotulo: "Cancelar", valor: null }, { rotulo: "Salvar", classe: "primario", acao: () => $("input", corpo).value.trim() || false }] });
      if (n) salvar(n).catch(erro);
    };
    $('[data-a="excluir"]', s).onclick = async () => { if (await confirmar("Excluir o professor orientador? A folha de rosto fica sem o nome até cadastrar outro.", "Excluir", true)) salvar(null).catch(erro); };
  }
}

// =====================================================================
// 4ª aba — Gerar atualização (atualizacaoN.zip)
// =====================================================================
// Formato lido pelo programa de PC. Mudou o formato? Aumente FORMATO_VERSAO e ajuste o programa.
const FORMATO_VERSAO = 1;

async function montarDados() {
  const [ds, rs, ts, cfg] = await Promise.all([
    db.sel("disciplinas", { order: "criado_em.asc" }),
    db.sel("requisitos", { order: "ordem.asc,criado_em.asc" }),
    db.sel("turmas", { order: "nome.asc" }),
    db.um("config", { id: "eq.1" }),
  ]);
  return {
    orientador: cfg?.orientador || "",
    turmas: ts.map((t) => ({ id: t.id, nome: t.nome })),
    disciplinas: ds.map((d) => ({
      id: d.id, nome: d.nome, arquivada: d.arquivada,
      carga_requerida: d.carga_requerida, carga_semanal: d.carga_semanal,
      inicio: d.inicio, fim: d.fim, horario: d.horario,
      requisitos: rs.filter((r) => r.disciplina_id === d.id)
        .sort((a, b) => (!!a.fixo - !!b.fixo) || a.ordem - b.ordem)
        .map((r) => ({ id: r.id, enunciado: r.enunciado, quantidade: r.quantidade, ordem: r.ordem, arquivado: r.arquivado, fixo: r.fixo || null })),
    })),
  };
}

export function montarZip(numero, resumo, dados) {
  const conteudo = {
    formato: "portfolio-salt-faama", formato_versao: FORMATO_VERSAO, tipo: "dados",
    numero, gerado_em: new Date().toISOString(), resumo, ...dados,
  };
  const leia = `Portfólio SALT-FAAMA — Atualização ${numero}\r\n\r\n` +
    `Este arquivo traz as disciplinas, os requisitos, as turmas e o professor orientador.\r\n` +
    `Não precisa abrir nem descompactar: no programa Portfólio, use "Importar atualização" e escolha este arquivo.\r\n` +
    (resumo ? `\r\nO que mudou:\r\n${resumo.replace(/\n/g, "\r\n")}\r\n` : "");
  return zipar([
    { nome: "atualizacao.json", dados: JSON.stringify(conteudo, null, 2) },
    { nome: "LEIA-ME.txt", dados: leia },
  ]);
}

async function abaGerar() {
  const s = $("#aba-gerar");
  const [dados, historico] = await Promise.all([montarDados(), db.sel("atualizacoes", { order: "numero.desc", limit: 20 })]);
  const ativas = dados.disciplinas.filter((d) => !d.arquivada);
  const nReq = ativas.reduce((n, d) => n + d.requisitos.filter((r) => !r.arquivado).length, 0);
  const proximo = (historico[0]?.numero || 0) + 1;
  s.innerHTML = `<div class="cartao"><h2>Gerar atualização</h2>
    <p class="leve" style="margin-top:0">Junta tudo o que está cadastrado num arquivo <b>atualizacao${proximo}.zip</b>. O aluno baixa e importa no programa. O programa só aceita uma atualização de número maior que a que ele já tem.</p>
    <div class="resumo-dados">
      <div><b>${ativas.length}</b><span>disciplina(s) ativa(s)</span></div>
      <div><b>${nReq}</b><span>requisito(s) ativo(s)</span></div>
      <div><b>${dados.turmas.length}</b><span>turma(s)</span></div>
      <div><b style="font-size:15px">${esc(dados.orientador || "—")}</b><span>professor orientador</span></div>
    </div>
    <label class="rotulo">O que mudou nesta atualização (aparece para os alunos)</label>
    <textarea class="campo" id="resumo" rows="3" placeholder="Ex.: Novo requisito de visitas na Prática Pastoral Comunitária II."></textarea>
    <label class="marcar-linha"><input type="checkbox" id="publicar" checked> Publicar na área de downloads (aba Atualizações)</label>
    <div class="linha-botoes"><button class="botao primario" id="gerar">📦 Gerar atualizacao${proximo}.zip</button></div></div>
    <div class="cartao"><h2>Atualizações geradas</h2>
      <div class="caixa-lista"><div class="caixa-lista-corpo" style="max-height:none">${historico.map((h) => `
        <div class="linha-item"><span class="texto"><b>atualizacao${h.numero}.zip</b>${h.resumo ? `<br><small class="leve">${esc(h.resumo)}</small>` : ""}</span>
        <span class="meta">${fmtData(h.gerado_em)} ${new Date(h.gerado_em).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span></div>`).join("")
        || '<p class="vazio">Nenhuma ainda.</p>'}</div></div></div>`;
  $("#gerar").onclick = async () => {
    const bt = $("#gerar");
    if (!ativas.length) return aviso("Cadastre pelo menos uma disciplina antes.", "erro");
    bt.disabled = true;
    try {
      const resumo = $("#resumo").value.trim();
      const numero = await db.rpc("nova_atualizacao", { p_resumo: resumo });
      const nome = `atualizacao${numero}.zip`;
      const blob = montarZip(numero, resumo, await montarDados());
      if ($("#publicar").checked) {
        const caminho = `atualizacoes/${nome}`;
        await subirArquivo(blob, caminho, "application/zip");
        await db.ins("downloads", { aba: "atualizacoes", titulo: `Atualização ${numero}`, descricao: resumo, caminho, nome_arquivo: nome, tamanho: blob.size, numero });
      }
      baixarBlob(blob, nome);
      aviso(`${nome} gerado${$("#publicar").checked ? " e publicado" : ""}.`);
      armazenamento();
      abaGerar();
    } catch (e) { erro(e); bt.disabled = false; }
  };
}

function baixarBlob(blob, nome) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = nome;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

// =====================================================================
// 5ª aba — Downloads (o que aparece na página pública)
// =====================================================================
async function abaDownloads() {
  const s = $("#aba-downloads");
  const itens = await db.sel("downloads", { order: "criado_em.desc" });
  const bloco = (aba, titulo, texto) => `<div class="cartao"><div class="item-cab"><h2 style="flex:1;margin:0">${titulo}</h2>
      <button class="botao primario pequeno" data-novo="${aba}">＋ Adicionar</button></div>
    <p class="leve" style="margin-top:4px">${texto}</p>
    <div class="caixa-lista"><div class="caixa-lista-corpo" style="max-height:none">${itens.filter((i) => i.aba === aba).map((i) => `
      <div class="linha-item ${i.publicado ? "" : "arquivado"}" data-id="${i.id}">
        <span class="texto"><b>${esc(i.titulo)}</b>${i.descricao ? `<br><small class="leve">${esc(i.descricao)}</small>` : ""}</span>
        <span class="meta">${fmtData(i.criado_em)}<br>${i.link ? "link externo" : esc(i.nome_arquivo || "") + (i.tamanho ? " · " + tamanho(i.tamanho) : "")}${i.publicado ? "" : "<br><b>escondido</b>"}</span>
        <span class="acoes-mini"><button data-a="editar" title="Editar">✏️</button>
          <button data-a="ver" title="${i.publicado ? "Esconder da página" : "Mostrar na página"}">${i.publicado ? "🙈" : "👁"}</button>
          <button data-a="excluir" title="Excluir">🗑</button></span></div>`).join("") || '<p class="vazio">Nada aqui ainda.</p>'}</div></div></div>`;
  s.innerHTML = bloco("atualizacoes", "Atualizações", "Os arquivos atualizacaoN.zip entram aqui sozinhos quando você usa “Gerar atualização”.")
    + bloco("versoes", "Versões", "Instalador do programa e atualizações do programa (correções e melhorias). Arquivo de até 50 MB, ou um link (para o instalador, que é maior).");
  $$("[data-novo]", s).forEach((b) => (b.onclick = () => editarDownload(null, b.dataset.novo)));
  $$(".linha-item [data-a]", s).forEach((b) => (b.onclick = async () => {
    const i = itens.find((x) => x.id === b.closest(".linha-item").dataset.id);
    try {
      if (b.dataset.a === "editar") return editarDownload(i, i.aba);
      if (b.dataset.a === "ver") { await db.upd("downloads", { id: `eq.${i.id}` }, { publicado: !i.publicado }); return abaDownloads(); }
      if (!(await confirmar(`Excluir “${i.titulo}”? ${i.caminho ? "O arquivo é apagado da área de downloads." : ""}`, "Excluir", true))) return;
      await db.del("downloads", { id: `eq.${i.id}` });
      if (i.caminho && !itens.some((x) => x !== i && x.caminho === i.caminho)) await apagarArquivo(i.caminho);
      aviso("Excluído."); armazenamento(); abaDownloads();
    } catch (e) { erro(e); }
  }));
}

async function editarDownload(item, aba) {
  const corpo = el(`<div>
    <label class="rotulo">Aba</label>
    <select class="campo aba"><option value="atualizacoes">Atualizações</option><option value="versoes">Versões</option></select>
    <label class="rotulo">Título</label><input class="campo titulo" placeholder="Ex.: Instalador do Portfólio 1.0 ou Atualização V.2">
    <label class="rotulo">Descrição</label><textarea class="campo descricao" rows="3" placeholder="O que tem de novo, para quem é…"></textarea>
    ${item ? "" : `<label class="rotulo">Arquivo</label>
      <div class="origem"><label class="marcar-linha"><input type="radio" name="origem" value="arquivo" checked> Enviar um arquivo (até 50 MB)</label>
        <label class="marcar-linha"><input type="radio" name="origem" value="link"> Link de fora (para arquivo maior)</label></div>
      <div class="o-arquivo"><button type="button" class="botao escolher" style="margin-top:8px">📎 Escolher arquivo</button> <span class="leve nome-arq"></span></div>
      <div class="o-link" hidden><input class="campo link" placeholder="https://github.com/…/releases/download/…/Portfolio-Setup.exe" style="margin-top:8px"></div>`}
    <label class="marcar-linha"><input type="checkbox" class="publicado" checked> Mostrar na página de downloads</label></div>`);
  $(".aba", corpo).value = item?.aba || aba;
  $(".titulo", corpo).value = item?.titulo || "";
  $(".descricao", corpo).value = item?.descricao || "";
  $(".publicado", corpo).checked = item ? item.publicado : true;
  let arquivo = null;
  if (!item) {
    $$('[name="origem"]', corpo).forEach((r) => (r.onchange = () => {
      const lk = $('[name="origem"]:checked', corpo).value === "link";
      $(".o-arquivo", corpo).hidden = lk; $(".o-link", corpo).hidden = !lk;
    }));
    $(".escolher", corpo).onclick = async () => {
      const a = await escolherArquivo("*/*");
      if (!a) return;
      if (a.size > LIMITE) { aviso(`O arquivo tem ${tamanho(a.size)}. O limite é 50 MB: use a opção de link.`, "erro"); return; }
      arquivo = a;
      $(".nome-arq", corpo).textContent = `${a.name} · ${tamanho(a.size)}`;
      if (!$(".titulo", corpo).value) $(".titulo", corpo).value = a.name.replace(/\.[^.]+$/, "");
    };
  }
  await janela({
    titulo: item ? "Editar download" : "Adicionar download", corpo,
    botoes: [{ rotulo: "Cancelar", valor: null }, {
      rotulo: "Salvar", classe: "primario", acao: async () => {
        const dados = { aba: $(".aba", corpo).value, titulo: $(".titulo", corpo).value.trim(), descricao: $(".descricao", corpo).value.trim(), publicado: $(".publicado", corpo).checked };
        if (!dados.titulo) throw new Error("Escreva o título.");
        if (item) { await db.upd("downloads", { id: `eq.${item.id}` }, dados); return; }
        if ($('[name="origem"]:checked', corpo).value === "link") {
          const link = $(".link", corpo).value.trim();
          if (!/^https?:\/\//i.test(link)) throw new Error("Cole um link que comece com https://");
          await db.ins("downloads", { ...dados, link });
        } else {
          if (!arquivo) throw new Error("Escolha o arquivo.");
          const limpo = arquivo.name.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\w.\-]+/g, "_");
          const caminho = `${dados.aba}/${Date.now().toString(36)}-${limpo}`;
          await subirArquivo(arquivo, caminho, arquivo.type || "application/octet-stream");
          await db.ins("downloads", { ...dados, caminho, nome_arquivo: arquivo.name, tamanho: arquivo.size });
        }
        aviso("Publicado.");
      },
    }],
  });
  armazenamento();
  abaDownloads();
}

iniciar().catch(erro);

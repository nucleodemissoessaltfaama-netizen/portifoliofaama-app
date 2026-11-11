import { db, api, logado, usuarioId, subirArquivo } from "./supa.js";
import {
  $, $$, el, esc, aviso, erro, janela, confirmar, confirmarDigitando, montarTopo, ganchos,
  fmtData, comprimir, escolherArquivo, avatar,
} from "./ui.js";

if (!logado()) location.replace("index.html");

let eu, turmas = [], disciplinas = [], usuarios = [];
const nomeTurma = (id) => turmas.find((t) => t.id === id)?.nome || "";
const nomeDisc = (id) => disciplinas.find((d) => d.id === id)?.nome || "";
const linkApp = () => new URL(".", location.href).href;

async function iniciar() {
  eu = await db.um("perfis", { id: `eq.${usuarioId()}` });
  if (!eu || eu.papel !== "admin") { location.replace(eu ? "app.html" : "index.html"); return; }
  montarTopo(eu, { rotuloPapel: "Administrador", linhas: [["E-mail", eu.email]] });
  ganchos.aoAbrirNotificacao = (n) => { if (n.tipo === "senha" && n.ref) gerarCodigo(n.ref); };
  $$("#abas button").forEach((b) => (b.onclick = () => abrirAba(b.dataset.aba)));
  await recarregarListas();
  abrirAba("cadastros");
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
  ({ cadastros: abaCadastros, disciplinas: abaDisciplinas, turmas: abaTurmas, orientador: abaOrientador })[nome]().catch(erro);
}

async function armazenamento() {
  try {
    const u = await db.rpc("uso_armazenamento");
    const mb = u.bytes / 1048576, pct = Math.min(100, (mb / 1024) * 100);
    $("#armaz .barra span").style.width = pct.toFixed(1) + "%";
    $("#armaz .leve").textContent = `${mb.toFixed(1)} MB de 1024 MB · ${u.arquivos} foto(s) · ${pct.toFixed(1)}%`;
  } catch { $("#armaz .leve").textContent = "—"; }
}

// =====================================================================
// 1ª aba — Gerenciador de cadastros
// =====================================================================
const opcoes = (lista, sel, vazio = "Selecione…") =>
  `<option value="">${vazio}</option>` + lista.map((x) => `<option value="${x.id}" ${x.id === sel ? "selected" : ""}>${esc(x.nome)}</option>`).join("");

function formPessoa(p = {}) {
  const f = el(`<form class="form-pessoa">
    <div class="foto-escolha" tabindex="0">${avatar(p)}<div><b>Foto do perfil</b><div class="dica-campo">Opcional. JPEG ou PNG — a imagem é reduzida antes de subir.</div></div></div>
    <label class="rotulo">Nome completo <span class="obrig">*</span></label><input name="nome" class="campo" required>
    <div class="grade2">
      <div><label class="rotulo">Data de nascimento <span class="obrig">*</span></label><input name="nascimento" type="date" class="campo" required></div>
      <div><label class="rotulo">Turma <span class="obrig">*</span></label><select name="turma_id" class="campo" required>${opcoes(turmas, p.turma_id)}</select></div>
    </div>
    <div class="grade2">
      <div><label class="rotulo">RA <span class="obrig">*</span></label><input name="ra" class="campo" inputmode="numeric" required><div class="dica-campo">Somente números.</div></div>
      <div><label class="rotulo">CPF</label><input name="cpf" class="campo" inputmode="numeric"><div class="dica-campo">Opcional.</div></div>
    </div>
    <div class="grade2">
      <div><label class="rotulo">E-mail <span class="obrig">*</span></label><input name="email" type="email" class="campo" required></div>
      <div><label class="rotulo">WhatsApp <span class="obrig">*</span></label><input name="whatsapp" class="campo" inputmode="tel" placeholder="(91) 99999-9999" required></div>
    </div>
    <label class="rotulo">Disciplina</label><select name="disciplina_id" class="campo">${opcoes(disciplinas.filter((d) => !d.arquivada || d.id === p.disciplina_id), p.disciplina_id, "Nenhuma por enquanto")}</select>
    <label class="rotulo">Tipo de perfil</label><select class="campo" disabled><option>${p.papel === "admin" ? "Administrador" : "Aluno"}</option></select>
  </form>`);
  for (const k of ["nome", "nascimento", "ra", "cpf", "email", "whatsapp"]) f[k].value = p[k] || "";
  f.foto = undefined;
  const escolher = async () => {
    const arq = await escolherArquivo();
    if (!arq) return;
    f.foto = await comprimir(arq, 600, 0.85);
    $(".foto-escolha .avatar", f).innerHTML = `<img src="${URL.createObjectURL(f.foto)}" alt="">`;
  };
  $(".foto-escolha", f).onclick = escolher;
  return f;
}

function lerForm(f) {
  const d = {};
  for (const k of ["nome", "nascimento", "ra", "cpf", "email", "whatsapp", "turma_id", "disciplina_id"]) d[k] = f[k].value.trim();
  if (!f.reportValidity()) throw new Error("Preencha os campos obrigatórios.");
  return d;
}

async function abaCadastros() {
  const s = $("#aba-cadastros");
  s.innerHTML = "";
  const cartaoForm = el(`<div class="cartao"><h2>Cadastrar pessoa</h2></div>`);
  const f = formPessoa();
  const bt = el(`<button class="botao escuro largo" style="margin-top:16px">Cadastrar e gerar código</button>`);
  cartaoForm.append(f, bt);
  bt.onclick = async () => {
    bt.disabled = true;
    try {
      const d = lerForm(f);
      const r = await api("cadastrar", d);
      if (f.foto) {
        const url = await subirArquivo(f.foto, r.id);
        await db.rpc("definir_foto", { p_id: r.id, p_url: url });
      }
      f.reset(); f.foto = undefined; $(".foto-escolha .avatar", f).innerHTML = "?";
      await carregarUsuarios();
      mostrarCodigo({ ...d, id: r.id }, r);
    } catch (e) { erro(e); }
    bt.disabled = false;
  };

  const cartaoLista = el(`<div class="cartao"><h2>Usuários <span class="selo-p" id="n-usuarios">0</span></h2>
    <div class="filtros">
      <input class="campo" id="busca" placeholder="Pesquisar por nome, e-mail, RA ou CPF…">
      <select class="campo" id="f-turma">${opcoes(turmas, "", "Todas as turmas")}</select>
      <select class="campo" id="f-disc">${opcoes(disciplinas, "", "Todas as disciplinas")}</select>
    </div>
    <div class="tabela-rolagem"><table class="tabela"><thead><tr>
      <th>Nome</th><th>Nascimento</th><th>Turma</th><th>Disciplina</th><th>RA</th><th>CPF</th><th>E-mail</th><th>WhatsApp</th><th>Perfil</th><th>Ações</th>
    </tr></thead><tbody></tbody></table></div></div>`);
  s.append(cartaoForm, cartaoLista);
  ["#busca", "#f-turma", "#f-disc"].forEach((id) => $(id, cartaoLista).addEventListener("input", desenharUsuarios));
  await carregarUsuarios();
}

async function carregarUsuarios() {
  usuarios = await db.sel("perfis", { order: "nome.asc" });
  desenharUsuarios();
}

const fmtCpf = (c) => (c && c.length === 11 ? `${c.slice(0, 3)}.${c.slice(3, 6)}.${c.slice(6, 9)}-${c.slice(9)}` : c || "—");
const fmtWhats = (w) => {
  if (!w) return "—";
  const n = w.startsWith("55") && w.length >= 12 ? w.slice(2) : w;
  return n.length >= 10 ? `(${n.slice(0, 2)}) ${n.slice(2, n.length - 4)}-${n.slice(-4)}` : w;
};

function desenharUsuarios() {
  const corpo = $("#aba-cadastros tbody");
  if (!corpo) return;
  const q = ($("#busca").value || "").toLowerCase().trim(), ft = $("#f-turma").value, fd = $("#f-disc").value;
  const qd = q.replace(/\D/g, "");
  const lista = usuarios.filter((u) =>
    (!q || u.nome.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || (qd && ((u.ra || "").includes(qd) || (u.cpf || "").includes(qd)))) &&
    (!ft || u.turma_id === ft) && (!fd || u.disciplina_id === fd));
  $("#n-usuarios").textContent = lista.length;
  corpo.innerHTML = lista.map((u) => `<tr data-id="${u.id}" class="${u.ativo ? "" : "inativo"}">
    <td><div class="pessoa">${avatar(u, "lista")}<div>${esc(u.nome)}${u.id === eu.id ? '<br><small class="leve">(você)</small>' : ""}</div></div></td>
    <td>${fmtData(u.nascimento) || "—"}</td><td>${esc(nomeTurma(u.turma_id)) || '<span class="leve">sem turma</span>'}</td>
    <td>${esc(nomeDisc(u.disciplina_id)) || '<span class="leve">—</span>'}</td>
    <td>${esc(u.ra || "—")}</td><td style="white-space:nowrap">${fmtCpf(u.cpf)}</td><td>${esc(u.email)}</td><td style="white-space:nowrap">${fmtWhats(u.whatsapp)}</td>
    <td><span class="selo-p ${u.ativo ? "" : "inativo"}">${u.ativo ? (u.papel === "admin" ? "administrador" : "aluno") : "inativo"}</span></td>
    <td><span class="acoes-mini">
      <button data-a="editar" title="Editar">✏️</button>
      <button data-a="codigo" title="Gerar código de acesso">🔑</button>
      ${u.id !== eu.id ? `<button data-a="ativo" title="${u.ativo ? "Inativar" : "Ativar"}">${u.ativo ? "⏸" : "▶"}</button>
      <button data-a="excluir" title="Excluir">🗑</button>` : ""}
    </span></td></tr>`).join("") || '<tr><td colspan="10" class="vazio">Nenhum usuário encontrado.</td></tr>';
  $$("button[data-a]", corpo).forEach((b) => (b.onclick = () => {
    const u = usuarios.find((x) => x.id === b.closest("tr").dataset.id);
    ({ editar: editarUsuario, codigo: () => gerarCodigo(u.id), ativo: alternarAtivo, excluir: excluirUsuario })[b.dataset.a](u);
  }));
}

async function editarUsuario(u) {
  const f = formPessoa(u);
  if (u.papel === "admin") $$("[required]", f).forEach((i) => { if (!["nome", "email"].includes(i.name)) i.required = false; });
  await janela({
    titulo: "Editar cadastro", corpo: f, larga: true,
    botoes: [{ rotulo: "Cancelar", valor: null }, {
      rotulo: "Salvar", classe: "primario", acao: async () => {
        const d = lerForm(f);
        if (f.foto) d.foto_url = await subirArquivo(f.foto, u.id);
        await api("atualizar", { id: u.id, ...d });
        aviso("Cadastro atualizado.");
        await carregarUsuarios();
      },
    }],
  });
}

async function gerarCodigo(id) {
  try {
    if (!usuarios.length) usuarios = await db.sel("perfis", { order: "nome.asc" });
    const u = usuarios.find((x) => x.id === id) || await db.um("perfis", { id: `eq.${id}` });
    if (!u) throw new Error("Usuário não encontrado.");
    const ok = await confirmar(`Gerar um novo código de acesso para ${u.nome}? O código anterior deixa de valer.`, "Gerar código");
    if (!ok) return;
    const r = await api("gerar_codigo", { id });
    mostrarCodigo(u, r);
  } catch (e) { erro(e); }
}

function mostrarCodigo(u, r) {
  const validade = r.minutos >= 60 * 24 ? `${Math.round(r.minutos / 1440)} dias` : `${r.minutos} minutos`;
  const texto = `Olá, ${u.nome.split(" ")[0]}! Seu código de acesso ao Portfólio SALT-FAAMA é: ${r.codigo}\n\n` +
    `1. Abra ${linkApp()}\n2. Digite o seu e-mail (${u.email}) e, no lugar da senha, o código acima.\n3. Crie a sua senha.\n\n` +
    `O código vale por ${validade}.`;
  let w = String(u.whatsapp || "").replace(/\D/g, "");
  if (w && !w.startsWith("55")) w = "55" + w;
  janela({
    titulo: "Código de acesso",
    corpo: `<p>Código de <b>${esc(u.nome)}</b>:</p>
      <p style="font-size:34px;font-weight:800;letter-spacing:.2em;text-align:center;margin:10px 0;color:var(--azul-escuro)">${r.codigo}</p>
      <p class="leve" style="text-align:center">Vale por ${validade} · até ${new Date(r.expira_em).toLocaleString("pt-BR")}</p>
      <div class="caixa-info" style="white-space:pre-wrap">${esc(texto)}</div>`,
    botoes: [
      { rotulo: "Copiar mensagem", fica: true, acao: async () => { await navigator.clipboard.writeText(texto); aviso("Mensagem copiada."); } },
      { rotulo: "Enviar pelo WhatsApp", classe: "primario", fica: true, acao: () => { window.open(`https://wa.me/${w}?text=${encodeURIComponent(texto)}`, "_blank", "noopener"); } },
      { rotulo: "Fechar", valor: null },
    ],
  });
}

async function alternarAtivo(u) {
  const ok = await confirmar(u.ativo
    ? `Inativar ${u.nome}? A pessoa não consegue mais entrar, mas nada é apagado.`
    : `Ativar ${u.nome} de novo?`, u.ativo ? "Inativar" : "Ativar", u.ativo);
  if (!ok) return;
  try { await api("definir_ativo", { id: u.id, ativo: !u.ativo }); await carregarUsuarios(); }
  catch (e) { erro(e); }
}

async function excluirUsuario(u) {
  const ok = await confirmarDigitando(`Excluir ${u.nome} apaga a conta, o portfólio inteiro e as fotos. Não dá para desfazer. Se quiser só bloquear o acesso, use Inativar.`, u.nome);
  if (!ok) return;
  try { await api("excluir", { id: u.id }); aviso("Usuário excluído."); await carregarUsuarios(); armazenamento(); }
  catch (e) { erro(e); }
}

// =====================================================================
// 2ª aba — Cadastro de disciplinas
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
  const [reqs, ports, todos] = await Promise.all([
    db.sel("requisitos", { disciplina_id: `eq.${d.id}`, order: "ordem.asc,criado_em.asc" }),
    db.sel("portfolios", { disciplina_id: `eq.${d.id}`, removido: "eq.false", select: "id,aluno_id" }),
    db.sel("perfis", { papel: "eq.aluno", order: "nome.asc" }),
  ]);
  const alunos = ports.map((p) => todos.find((a) => a.id === p.aluno_id)).filter(Boolean);
  corpo.innerHTML = "";
  const c = el(`<div class="cartao">
    <div class="item-cab"><h3 style="font-size:17px">${esc(d.nome)} ${d.arquivada ? '<span class="selo-p inativo">arquivada</span>' : ""}</h3>
      <span class="acoes-mini"><button data-a="renomear" title="Renomear">✏️</button>
      <button data-a="arquivar" title="${d.arquivada ? "Reativar" : "Arquivar"}">${d.arquivada ? "▶" : "🗄"}</button>
      <button data-a="excluir" title="Excluir toda a disciplina">🗑</button></span></div>
    <form class="form-disc">
      <div class="grade3">
        <div><label class="rotulo">Carga horária requerida (h)</label><input name="carga_requerida" type="number" min="0" step="0.5" class="campo"></div>
        <div><label class="rotulo">Carga horária semanal (h)</label><input name="carga_semanal" type="number" min="0" step="0.5" class="campo"></div>
        <div><label class="rotulo">Confecção do relatório (h)</label><input name="horas_relatorio" type="number" min="0" step="0.5" class="campo"><div class="dica-campo">Linha própria no quadro-resumo.</div></div>
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
    <div class="caixa-lista"><div class="caixa-lista-topo"><b>Requisitos da disciplina (${reqs.filter((r) => !r.arquivado).length})</b>
      <button class="botao pequeno primario" data-a="novo-req">＋ Ad. novo requisito</button></div>
      <div class="caixa-lista-corpo" id="lista-reqs"></div></div>
    <div class="caixa-lista"><div class="caixa-lista-topo"><b>Alunos desta disciplina (${alunos.length})</b>
      <button class="botao pequeno primario" data-a="novo-aluno">＋ Ad. novo aluno</button></div>
      <div class="caixa-lista-corpo" id="lista-alunos"></div></div>
  </div>`);
  corpo.append(c);
  const f = $(".form-disc", c);
  for (const k of ["carga_requerida", "carga_semanal", "horas_relatorio", "inicio", "fim", "horario"]) f[k].value = d[k] ?? "";
  $(".salvar-disc", c).onclick = async () => {
    const dados = {};
    for (const k of ["carga_requerida", "carga_semanal", "horas_relatorio"]) dados[k] = f[k].value === "" ? null : Number(f[k].value);
    if (dados.horas_relatorio === null) dados.horas_relatorio = 0;
    dados.inicio = f.inicio.value || null; dados.fim = f.fim.value || null; dados.horario = f.horario.value.trim() || null;
    if (dados.inicio && dados.fim && dados.fim < dados.inicio) return aviso("O último dia vem antes do primeiro.", "erro");
    try { await db.upd("disciplinas", { id: `eq.${d.id}` }, dados); Object.assign(d, dados); aviso("Disciplina salva."); }
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
        <button data-a="excluir" title="Excluir">🗑</button></span></div>`).join("") || '<p class="vazio">Nenhum requisito ainda.</p>';
  $$("button[data-a]", lr).forEach((b) => (b.onclick = () => {
    const r = reqs.find((x) => x.id === b.closest(".linha-item").dataset.id);
    acaoRequisito(b.dataset.a, r, reqs, d);
  }));
  $('[data-a="novo-req"]', c).onclick = () => editarRequisito(null, d, reqs);

  // alunos
  const la = $("#lista-alunos", c);
  la.innerHTML = alunos.map((a) => `<div class="linha-item" data-id="${a.id}">
      <span class="texto pessoa">${avatar(a, "lista")} ${esc(a.nome)}</span>
      <span class="meta">RA: ${esc(a.ra || "—")}</span><span class="meta">Turma: ${esc(nomeTurma(a.turma_id) || "—")}</span>
      <span class="acoes-mini"><button data-a="editar" title="Editar cadastro">✏️</button><button data-a="remover" title="Tirar desta disciplina">✕</button></span></div>`).join("")
    || '<p class="vazio">Nenhum aluno ainda. Os alunos entram sozinhos quando escolhem esta disciplina no primeiro acesso.</p>';
  $$("button[data-a]", la).forEach((b) => (b.onclick = async () => {
    const a = alunos.find((x) => x.id === b.closest(".linha-item").dataset.id);
    if (b.dataset.a === "editar") { usuarios = todos; await editarUsuario(a); return desenharDisciplina(d); }
    const ok = await confirmar(`Tirar ${a.nome} desta disciplina? O que ele já escreveu fica guardado e volta se ele for colocado de novo.`, "Tirar da disciplina", true);
    if (!ok) return;
    try { await db.rpc("remover_aluno", { p_disciplina: d.id, p_aluno: a.id }); desenharDisciplina(d); } catch (e) { erro(e); }
  }));
  $('[data-a="novo-aluno"]', c).onclick = () => atribuirAluno(d, todos, alunos);

  // disciplina
  $('.item-cab [data-a="renomear"]', c).onclick = async () => {
    const corpoR = el(`<div><label class="rotulo">Nome da disciplina</label><input class="campo"></div>`);
    $("input", corpoR).value = d.nome;
    const nome = await janela({ titulo: "Renomear disciplina", corpo: corpoR, botoes: [{ rotulo: "Cancelar", valor: null }, { rotulo: "Salvar", classe: "primario", acao: () => $("input", corpoR).value.trim() || false }] });
    if (!nome) return;
    try { await db.upd("disciplinas", { id: `eq.${d.id}` }, { nome }); abaDisciplinas(); } catch (e) { erro(e); }
  };
  $('.item-cab [data-a="arquivar"]', c).onclick = async () => {
    const ok = await confirmar(d.arquivada ? "Reativar esta disciplina? Ela volta para a lista do primeiro acesso." : "Arquivar esta disciplina? Ela some da lista do primeiro acesso, mas os portfólios ficam guardados.", d.arquivada ? "Reativar" : "Arquivar");
    if (!ok) return;
    try { await db.upd("disciplinas", { id: `eq.${d.id}` }, { arquivada: !d.arquivada }); abaDisciplinas(); } catch (e) { erro(e); }
  };
  $('.item-cab [data-a="excluir"]', c).onclick = async () => {
    try {
      const n = await db.rpc("uso_disciplina", { p_id: d.id });
      if (n > 0) return janela({ titulo: "Não dá para excluir", corpo: `<p>Esta disciplina tem ${n} portfólio(s) de alunos. Para tirá-la da lista sem perder nada, use <b>Arquivar</b> (🗄).</p>` });
      const ok = await confirmarDigitando("Excluir a disciplina apaga também todos os requisitos dela.", d.nome);
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
      aviso(r.arquivado ? "Requisito reativado." : "Requisito arquivado: some da lista dos alunos, mas continua em quem já lançou.");
      return desenharDisciplina(d);
    }
    if (acao === "excluir") {
      const n = await db.rpc("uso_requisito", { p_id: r.id });
      if (n > 0) {
        const ok = await confirmar(`${n} aluno(s) já lançaram este requisito, então ele não pode ser excluído. Quer arquivar? Ele some da lista para novos lançamentos e continua no trabalho de quem já escreveu.`, "Arquivar");
        if (ok) { await db.upd("requisitos", { id: `eq.${r.id}` }, { arquivado: true }); desenharDisciplina(d); }
        return;
      }
      if (!(await confirmar(`Excluir o requisito “${r.enunciado}”?`, "Excluir", true))) return;
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
  if (r) {
    const n = await db.rpc("uso_requisito", { p_id: r.id }).catch(() => 0);
    if (n) $(".aviso-uso", corpo).innerHTML = `⚠️ <b>${n} aluno(s)</b> já lançaram este requisito. A mudança aparece no portfólio de todos eles e eles recebem um aviso.`;
  }
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

async function atribuirAluno(d, todos, jaEstao) {
  const ids = new Set(jaEstao.map((a) => a.id));
  const candidatos = todos.filter((a) => !ids.has(a.id) && a.ativo);
  const corpo = el(`<div><input class="campo" placeholder="Pesquisar por nome ou RA…"><div class="caixa-lista" style="margin-top:10px"><div class="caixa-lista-corpo"></div></div>
    <p class="dica-campo">Aqui não se cadastra aluno novo: escolhe-se um já cadastrado. Se ele estiver em outra disciplina, esta passa a ser a atual e a outra fica guardada.</p></div>`);
  const lista = $(".caixa-lista-corpo", corpo);
  const desenhar = () => {
    const q = $("input", corpo).value.toLowerCase().trim();
    lista.innerHTML = candidatos.filter((a) => !q || a.nome.toLowerCase().includes(q) || (a.ra || "").includes(q)).slice(0, 60).map((a) => `
      <label class="linha-item"><input type="checkbox" value="${a.id}"><span class="texto">${esc(a.nome)}</span>
      <span class="meta">RA ${esc(a.ra || "—")} · ${esc(nomeTurma(a.turma_id) || "sem turma")}${a.disciplina_id ? " · em " + esc(nomeDisc(a.disciplina_id)) : ""}</span></label>`).join("")
      || '<p class="vazio">Ninguém encontrado.</p>';
  };
  $("input", corpo).oninput = desenhar;
  desenhar();
  await janela({
    titulo: "Atribuir alunos a " + d.nome, corpo, larga: true,
    botoes: [{ rotulo: "Cancelar", valor: null }, {
      rotulo: "Atribuir", classe: "primario", acao: async () => {
        const marcados = $$("input:checked", lista).map((i) => i.value);
        if (!marcados.length) throw new Error("Marque pelo menos um aluno.");
        for (const id of marcados) await db.rpc("atribuir_aluno", { p_disciplina: d.id, p_aluno: id });
        aviso(`${marcados.length} aluno(s) atribuído(s).`);
      },
    }],
  });
  desenharDisciplina(d);
}

// =====================================================================
// 3ª aba — Cadastro de turmas
// =====================================================================
async function abaTurmas() {
  await recarregarListas();
  const contagem = await db.sel("perfis", { select: "turma_id" });
  const s = $("#aba-turmas");
  s.innerHTML = `<div class="cartao"><h2>Cadastro de turmas</h2>
    <p class="leve" style="margin-top:0">Estas turmas aparecem na lista do primeiro acesso.</p>
    <div class="filtros"><input class="campo" id="nova-turma" placeholder="Ex.: 16ª Turma"><button class="botao primario" id="add-turma">＋ Adicionar turma</button></div>
    <div class="caixa-lista"><div class="caixa-lista-corpo" style="max-height:none">${turmas.map((t) => `
      <div class="linha-item" data-id="${t.id}"><span class="texto"><b>${esc(t.nome)}</b></span>
      <span class="meta">${contagem.filter((p) => p.turma_id === t.id).length} pessoa(s)</span>
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
        const n = contagem.filter((p) => p.turma_id === t.id).length;
        const ok = await confirmar(n ? `${n} pessoa(s) estão nesta turma e ficarão sem turma. Excluir mesmo assim?` : `Excluir a turma ${t.nome}?`, "Excluir", true);
        if (ok) { await db.del("turmas", { id: `eq.${t.id}` }); abaTurmas(); }
      }
    } catch (e) { erro(e); }
  }));
}

// =====================================================================
// 4ª aba — Professor orientador
// =====================================================================
async function abaOrientador() {
  const c = await db.um("config", { id: "eq.1" });
  const s = $("#aba-orientador");
  const atual = c?.orientador || "";
  s.innerHTML = `<div class="cartao"><h2>Professor orientador</h2>
    <p class="leve" style="margin-top:0">Aparece na folha de rosto de todos os portfólios, em “Docente Orientador”.</p>
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

iniciar().catch(erro);

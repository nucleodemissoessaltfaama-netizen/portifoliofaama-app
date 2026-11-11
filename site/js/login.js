import { db, api, entrar, sair, logado, usuarioId } from "./supa.js";
import { $, $$, aviso, erro, janela, esc } from "./ui.js";

const views = ["v-entrar", "v-primeiro", "v-esqueci", "v-nova"];
function mostrar(id) { views.forEach((v) => ($("#" + v).hidden = v !== id)); }
$$("[data-ir]").forEach((b) => (b.onclick = () => { mostrar(b.dataset.ir); if (b.dataset.ir === "v-primeiro") carregarListas(); }));
$$(".ver").forEach((b) => (b.onclick = () => { const i = $("#" + b.dataset.alvo); i.type = i.type === "password" ? "text" : "password"; }));

async function irParaApp() {
  const p = await db.um("perfis", { id: `eq.${usuarioId()}` });
  if (!p) { sair(); throw new Error("Conta sem cadastro no Portfólio. Fale com o administrador."); }
  if (!p.ativo) { sair(); throw new Error("Esta conta está inativa. Fale com o administrador."); }
  db.rpc("marcar_entrada").catch(() => {});
  location.replace(p.papel === "admin" ? "admin.html" : "app.html");
}

// Já está conectado? Vai direto.
if (logado()) irParaApp().catch(() => sair());

let codigoEmUso = null;

$("#v-entrar").onsubmit = async (ev) => {
  ev.preventDefault();
  const bt = $("button.primario", ev.target); bt.disabled = true;
  const email = $("#e-email").value.trim(), senha = $("#e-senha").value;
  try {
    if (/^\d{6}$/.test(senha)) {
      await api("validar_codigo", { email, codigo: senha });
      codigoEmUso = { email, codigo: senha };
      mostrar("v-nova");
    } else {
      await entrar(email, senha, $("#e-lembrar").checked);
      await irParaApp();
    }
  } catch (e) { erro(e); }
  bt.disabled = false;
};

$("#v-nova").onsubmit = async (ev) => {
  ev.preventDefault();
  const f = ev.target, bt = $("button", f); bt.disabled = true;
  try {
    if (f.senha.value !== f.confirma.value) throw new Error("As senhas não conferem.");
    await api("definir_senha", { ...codigoEmUso, senha: f.senha.value, confirma: f.confirma.value });
    await entrar(codigoEmUso.email, f.senha.value, $("#e-lembrar").checked);
    aviso("Senha criada.");
    await irParaApp();
  } catch (e) { erro(e); }
  bt.disabled = false;
};

let listasProntas = false;
async function carregarListas() {
  if (listasProntas) return;
  const f = $("#v-primeiro");
  try {
    const [turmas, discs] = await Promise.all([
      db.sel("turmas", { order: "nome.asc" }),
      db.sel("disciplinas", { arquivada: "eq.false", order: "nome.asc" }),
    ]);
    f.turma_id.innerHTML = '<option value="">Selecione…</option>' + turmas.map((t) => `<option value="${t.id}">${esc(t.nome)}</option>`).join("");
    f.disciplina_id.innerHTML = '<option value="">Selecione…</option>' + discs.map((d) => `<option value="${d.id}">${esc(d.nome)}</option>`).join("");
    listasProntas = true;
  } catch (e) { erro(e); }
}

$("#v-primeiro").onsubmit = async (ev) => {
  ev.preventDefault();
  const f = ev.target, bt = $("button.primario", f); bt.disabled = true;
  const dados = Object.fromEntries(new FormData(f));
  try {
    if (dados.senha !== dados.confirma) throw new Error("As senhas não conferem.");
    if (dados.senha.length < 8) throw new Error("A senha precisa ter pelo menos 8 caracteres.");
    await api("primeiro_acesso", dados);
    await entrar(dados.email, dados.senha, true);
    aviso("Cadastro feito. Bem-vindo!");
    await irParaApp();
  } catch (e) { erro(e); }
  bt.disabled = false;
};

$("#v-esqueci").onsubmit = async (ev) => {
  ev.preventDefault();
  const f = ev.target, bt = $("button.primario", f); bt.disabled = true;
  try {
    await api("esqueci_senha", { email: f.email.value });
    await janela({
      titulo: "Pedido enviado",
      corpo: "<p>Se o e-mail estiver cadastrado, o administrador recebeu o seu pedido.</p><p>Ele vai te mandar um <b>código de 6 números</b> pelo WhatsApp. Quando chegar, entre com o seu e-mail e digite o código no lugar da senha. O código vale por 15 minutos.</p>",
    });
    mostrar("v-entrar");
    $("#e-email").value = f.email.value;
  } catch (e) { erro(e); }
  bt.disabled = false;
};

// Entrada do painel: só administradores.
import { db, entrar, sair, logado, usuarioId } from "./supa.js";
import { $, erro } from "./ui.js";

async function irParaPainel() {
  const p = await db.um("perfis", { id: `eq.${usuarioId()}` });
  if (!p || p.papel !== "admin" || !p.ativo) { sair(); throw new Error("Esta conta não é de administrador."); }
  location.replace("admin.html");
}

if (logado()) irParaPainel().catch(() => sair());

$(".ver").onclick = () => { const i = $("#e-senha"); i.type = i.type === "password" ? "text" : "password"; };
$("#v-entrar").onsubmit = async (ev) => {
  ev.preventDefault();
  const bt = $("button.primario", ev.target); bt.disabled = true;
  try {
    await entrar($("#e-email").value, $("#e-senha").value, $("#e-lembrar").checked);
    await irParaPainel();
  } catch (e) { erro(e); }
  bt.disabled = false;
};

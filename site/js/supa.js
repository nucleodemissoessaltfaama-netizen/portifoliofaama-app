// Cliente mínimo do Supabase, sem SDK: login, banco (PostgREST), RPC, fotos e a função "api".
import { SUPABASE_URL, SUPABASE_ANON } from "./config.js";

export const BASE = SUPABASE_URL.trim().replace(/\/(rest|auth|storage|functions)\/v1\/?$/, "").replace(/\/+$/, "");
const K = "portfolio_sessao";

function ler() {
  try { return JSON.parse(localStorage.getItem(K) || sessionStorage.getItem(K) || "null"); }
  catch { return null; }
}
let sessao = ler();

function guardar(s, lembrar) {
  sessao = s;
  try {
    localStorage.removeItem(K); sessionStorage.removeItem(K);
    if (s) (lembrar === false ? sessionStorage : localStorage).setItem(K, JSON.stringify(s));
  } catch { /* navegador sem armazenamento: a sessão vale só nesta aba */ }
}

const TRADUCOES = [
  [/Invalid login credentials/i, "E-mail ou senha incorretos."],
  [/Email not confirmed/i, "E-mail ainda não confirmado."],
  [/User is banned|banned/i, "Esta conta está inativa. Fale com o administrador."],
  [/JWT expired|invalid JWT|refresh_token/i, "Sua sessão expirou. Entre novamente."],
  [/duplicate key.*dias_portfolio_id_data/i, "Este dia já foi adicionado."],
  [/duplicate key.*atividades_dia_id_requisito_id/i, "Este requisito já foi lançado neste dia."],
  [/duplicate key.*turmas_nome/i, "Já existe uma turma com esse nome."],
  [/violates foreign key.*requisito/i, "Este requisito já foi usado por alunos. Arquive em vez de excluir."],
  [/violates foreign key.*portfolios_disciplina/i, "Esta disciplina tem portfólios de alunos. Arquive em vez de excluir."],
  [/Failed to fetch|NetworkError|Load failed/i, "Sem conexão com a internet. Tente de novo."],
  [/row-level security/i, "Você não tem permissão para isso."],
];
export function traduzir(msg) {
  const m = String(msg || "Erro desconhecido.");
  for (const [re, t] of TRADUCOES) if (re.test(m)) return t;
  return m;
}

export class ErroApp extends Error {}

async function lerResposta(r) {
  const txt = await r.text();
  let corpo = null;
  try { corpo = txt ? JSON.parse(txt) : null; } catch { corpo = txt; }
  if (!r.ok) {
    const msg = corpo?.message || corpo?.msg || corpo?.error_description || corpo?.error || txt || r.statusText;
    throw new ErroApp(traduzir(msg));
  }
  return corpo;
}

async function chamarAuth(caminho, corpo) {
  const r = await fetch(BASE + "/auth/v1/" + caminho, {
    method: "POST",
    headers: { apikey: SUPABASE_ANON, "Content-Type": "application/json" },
    body: JSON.stringify(corpo),
  });
  return lerResposta(r);
}

function montarSessao(d) {
  return {
    access_token: d.access_token, refresh_token: d.refresh_token,
    expires_at: d.expires_at || Math.floor(Date.now() / 1000) + (d.expires_in || 3600),
    user_id: d.user?.id,
  };
}

export async function entrar(email, senha, lembrar = true) {
  const d = await chamarAuth("token?grant_type=password", { email: email.trim().toLowerCase(), password: senha });
  guardar(montarSessao(d), lembrar);
  return sessao;
}

export function sair() {
  const s = sessao;
  guardar(null);
  if (s) fetch(BASE + "/auth/v1/logout", {
    method: "POST", headers: { apikey: SUPABASE_ANON, Authorization: "Bearer " + s.access_token },
  }).catch(() => {});
}

export const usuarioId = () => sessao?.user_id || null;
export const logado = () => !!sessao;

let renovando = null;
async function token() {
  if (!sessao) return null;
  if (sessao.expires_at - 60 > Date.now() / 1000) return sessao.access_token;
  if (!renovando) {
    const lembrar = !!localStorage.getItem(K);
    renovando = chamarAuth("token?grant_type=refresh_token", { refresh_token: sessao.refresh_token })
      .then((d) => guardar(montarSessao(d), lembrar))
      .catch((e) => { guardar(null); throw e; })
      .finally(() => { renovando = null; });
  }
  await renovando;
  return sessao.access_token;
}

async function cabecalhos(extra = {}) {
  const t = await token();
  return { apikey: SUPABASE_ANON, Authorization: "Bearer " + (t || SUPABASE_ANON), "Content-Type": "application/json", ...extra };
}

async function rest(metodo, caminho, corpo, extra) {
  const r = await fetch(BASE + "/rest/v1/" + caminho, {
    method: metodo, headers: await cabecalhos(extra),
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
  });
  return lerResposta(r);
}

// Filtros no formato do PostgREST: { id: "eq.xxx", disciplina_id: "eq.yyy", order: "ordem.asc" }
function qs(obj = {}) {
  return Object.entries(obj).filter(([, v]) => v !== undefined)
    .map(([k, v]) => encodeURIComponent(k) + "=" + encodeURIComponent(v)).join("&");
}

export const db = {
  sel: (tabela, filtros = {}) => rest("GET", `${tabela}?${qs({ select: "*", ...filtros })}`),
  um: async (tabela, filtros = {}) => (await rest("GET", `${tabela}?${qs({ select: "*", ...filtros })}`))[0] || null,
  ins: async (tabela, obj) => {
    const r = await rest("POST", tabela, obj, { Prefer: "return=representation" });
    return Array.isArray(obj) ? r : r[0];
  },
  upd: async (tabela, filtros, obj) => (await rest("PATCH", `${tabela}?${qs(filtros)}`, obj, { Prefer: "return=representation" }))[0] || null,
  del: (tabela, filtros) => rest("DELETE", `${tabela}?${qs(filtros)}`, undefined, { Prefer: "return=minimal" }),
  rpc: (fn, args = {}) => rest("POST", `rpc/${fn}`, args),
};

// Função "api" (contas, códigos)
export async function api(acao, dados = {}) {
  const r = await fetch(BASE + "/functions/v1/api", {
    method: "POST", headers: await cabecalhos(), body: JSON.stringify({ acao, dados }),
  });
  const corpo = await lerResposta(r);
  if (corpo?.erro) throw new ErroApp(traduzir(corpo.erro));
  return corpo;
}

// Fotos: depósito público "fotos", na pasta do usuário
export function urlPublica(caminho) {
  return `${BASE}/storage/v1/object/public/fotos/${caminho}`;
}

export async function subirArquivo(blob, pasta, extensao = "jpg") {
  const id = (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2));
  const caminho = `${pasta}/${id}.${extensao}`;
  const t = await token();
  const r = await fetch(`${BASE}/storage/v1/object/fotos/${caminho}`, {
    method: "POST",
    headers: { apikey: SUPABASE_ANON, Authorization: "Bearer " + t, "Content-Type": blob.type || "image/jpeg", "x-upsert": "true" },
    body: blob,
  });
  await lerResposta(r);
  return urlPublica(caminho);
}

export async function apagarArquivo(url) {
  if (!url || !url.includes("/object/public/fotos/")) return;
  const caminho = url.split("/object/public/fotos/")[1];
  try {
    await fetch(`${BASE}/storage/v1/object/fotos/${caminho}`, { method: "DELETE", headers: await cabecalhos() });
  } catch { /* foto órfã não atrapalha */ }
}

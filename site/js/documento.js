// Monta o Trabalho Final como uma lista de blocos. A prévia (previa.js) e o Word (word.js)
// desenham a MESMA lista, então não podem divergir.
import { dataExtenso, horasQuadro, fmtData } from "./ui.js";
import { PERGUNTAS, nomeSemExtensao, textoSecao2, textoSecao22, textoCargaHoraria } from "./textos.js";
import { CIDADE_CAPA } from "./config.js";

// Texto → pedaços: [[nota: ...]], **negrito**, *itálico*
export function runs(texto) {
  const out = [];
  const re = /\[\[nota:\s*([\s\S]*?)\]\]|\*\*([\s\S]+?)\*\*|\*([^*\n]+?)\*/g;
  let i = 0, m;
  while ((m = re.exec(texto))) {
    if (m.index > i) out.push({ tx: texto.slice(i, m.index) });
    if (m[1] !== undefined) out.push({ nota: m[1].trim() });
    else if (m[2] !== undefined) out.push({ tx: m[2], b: true });
    else out.push({ tx: m[3], i: true });
    i = m.index + m[0].length;
  }
  if (i < texto.length) out.push({ tx: texto.slice(i) });
  // espaço antes da nota some (o número fica colado na palavra)
  for (let k = 1; k < out.length; k++) if (out[k].nota !== undefined && out[k - 1].tx) out[k - 1].tx = out[k - 1].tx.replace(/\s+$/, "");
  return out;
}

const paragrafos = (t) => String(t || "").split(/\n+/).map((s) => s.trim()).filter(Boolean);

// Ordem cronológica dos dias e das atividades
export function organizar(dados) {
  const dias = [...dados.dias].sort((a, b) => a.data.localeCompare(b.data));
  const ordemReq = new Map(dados.requisitos.map((r, i) => [r.id, i]));
  const ativPorDia = new Map(dias.map((d) => [d.id, dados.atividades
    .filter((a) => a.dia_id === d.id)
    .sort((a, b) => a.criado_em.localeCompare(b.criado_em) || (ordemReq.get(a.requisito_id) - ordemReq.get(b.requisito_id)))]));
  return { dias, ativPorDia };
}

// Números das figuras na ordem em que aparecem no trabalho
export function numerarFiguras(dados) {
  const { dias } = organizar(dados);
  const ordem = [
    ...dados.figuras.filter((f) => f.local === "cidade").sort(porOrdem),
    ...dados.figuras.filter((f) => f.local === "mapa"),
    ...dados.figuras.filter((f) => f.local === "igreja"),
    ...dias.flatMap((d) => dados.figuras.filter((f) => f.local === "dia" && f.dia_id === d.id).sort(porOrdem)),
  ];
  return new Map(ordem.map((f, i) => [f.id, i + 1]));
}
const porOrdem = (a, b) => a.ordem - b.ordem || a.criado_em.localeCompare(b.criado_em);

export function linhasQuadro(dados) {
  const minutos = new Map();
  for (const a of dados.atividades) minutos.set(a.requisito_id, (minutos.get(a.requisito_id) || 0) + a.minutos);
  const d = dados.disciplina;
  const periodo = d.inicio && d.fim ? `${fmtData(d.inicio)} a ${fmtData(d.fim)}` : "–";
  const linhas = dados.requisitos.filter((r) => minutos.get(r.id))
    .map((r) => ({ atividade: r.enunciado, periodo, horas: horasQuadro(minutos.get(r.id)), min: minutos.get(r.id) }));
  const rel = Number(d.horas_relatorio || 0);
  if (rel > 0) linhas.push({ atividade: "Confecção de Relatório", periodo: "-", horas: horasQuadro(rel * 60), min: rel * 60 });
  const total = linhas.reduce((s, l) => s + l.min, 0);
  return { linhas, total: horasQuadro(total), totalMin: total };
}

export function montar(dados) {
  const { perfil, disciplina: disc, portfolio: p } = dados;
  const { dias, ativPorDia } = organizar(dados);
  const numFig = numerarFiguras(dados);
  const reqPorId = new Map(dados.requisitos.map((r) => [r.id, r]));
  const corpo = [];
  const titulos = [];
  const figuras = [];
  const quadros = [];
  let idT = 0;

  const h = (nivel, numero, texto, opc = {}) => {
    const b = { t: "h", id: "t" + ++idT, nivel, numero, texto, ...opc };
    titulos.push(b); corpo.push(b);
  };
  const ps = (texto, estilo = "corpo") => paragrafos(texto).forEach((t) => corpo.push({ t: "p", estilo, runs: runs(t) }));
  const pFixo = (texto) => corpo.push({ t: "p", estilo: "corpo", runs: [{ tx: texto }] });
  const fig = (f) => {
    const num = numFig.get(f.id);
    const b = { t: "fig", id: "f" + f.id, num, sup: `Figura ${num}. ${f.legenda_sup || ""}`.trim(), inf: `Fonte ${num}. ${f.legenda_inf || ""}`.trim(), imgs: [f.url, f.url2].filter(Boolean) };
    figuras.push(b); corpo.push(b);
  };

  // 1 INTRODUÇÃO
  h(1, "1.", "INTRODUÇÃO");
  ps(p.introducao);
  h(2, "1.1", "Perfil do discente e expectativas vocacionais");
  ps(p.perfil_discente);

  // 2 ATIVIDADES DESENVOLVIDAS
  h(1, "2.", "ATIVIDADES DESENVOLVIDAS");
  pFixo(textoSecao2(dias.length));
  h(2, "2.1.", `Caracterização do campo de extensão${p.campo_nome ? ": " + p.campo_nome : ""}`);
  ps(p.caract_campo);
  h(3, "2.1.1.", "Caracterização sócio-política, econômica, demográfica e religiosa da cidade/bairro onde foi realizado a prática pastoral");
  ps(p.caract_cidade);
  dados.figuras.filter((f) => f.local === "cidade").sort(porOrdem).forEach(fig);
  h(4, "2.1.1.1.", "Igreja de apoio ou igreja base");
  ps(p.igreja_texto);
  dados.figuras.filter((f) => f.local === "mapa").forEach(fig);
  dados.figuras.filter((f) => f.local === "igreja").forEach(fig);
  h(4, "2.1.1.2.", "Organograma da igreja de apoio ou igreja base");
  ps(p.organograma_desc);
  if (p.organograma_url) corpo.push({ t: "img", url: p.organograma_url });
  h(4, "2.1.1.3.", "Carga horária das atividades");
  pFixo(textoCargaHoraria(disc, p.campo_nome));

  h(2, "2.2.", "Atividades desenvolvidas pelo estagiário");
  pFixo(textoSecao22(dias.length));
  dias.forEach((d, i) => {
    const nd = `2.2.${i + 1}.`;
    h(3, nd, `Dia ${dataExtenso(d.data)}`);
    (ativPorDia.get(d.id) || []).forEach((a, k) => {
      const r = reqPorId.get(a.requisito_id);
      h(4, `${nd}${k + 1}.`, r ? r.enunciado : "(requisito removido)");
      for (const [campo, rot] of PERGUNTAS) {
        const pars = paragrafos(a[campo]);
        corpo.push({ t: "p", estilo: "atividade", runs: [{ tx: rot + (pars.length ? " " : "") }, ...runs(pars[0] || "")] });
        pars.slice(1).forEach((t) => corpo.push({ t: "p", estilo: "atividade", runs: runs(t) }));
      }
    });
    dados.figuras.filter((f) => f.local === "dia" && f.dia_id === d.id).sort(porOrdem).forEach(fig);
  });

  // 24C: Análise 2.3, Quadro 2.4, Conclusão 2.5, Referências 2.6 — cada um em página nova
  h(2, "2.3.", "ANÁLISE DOS RESULTADOS", { novaPagina: true });
  ps(p.analise);

  h(2, "2.4.", "QUADRO RESUMO DAS ATIVIDADES DE EXTENSÃO", { novaPagina: true });
  const q = linhasQuadro(dados);
  const bq = { t: "quadro", id: "q1", num: 1, linhas: q.linhas, total: q.total, legenda: "Quadro 1 – Resumo das atividades de extensão" };
  quadros.push({ ...bq, entrada: "Quadro 1 – Resumo das Atividades de Extensão" });
  corpo.push(bq);

  h(2, "2.5.", "CONCLUSÃO", { novaPagina: true });
  ps(p.conclusao);

  h(2, "2.6.", "REFERÊNCIAS", { novaPagina: true });
  [...dados.referencias].sort((a, b) => a.texto.localeCompare(b.texto, "pt-BR", { sensitivity: "base" }))
    .forEach((r) => paragrafos(r.texto).forEach((t) => corpo.push({ t: "p", estilo: "ref", runs: runs(t) })));

  const ano = (disc.fim || disc.inicio || new Date().toISOString()).slice(0, 4);
  return {
    capa: {
      instituicao: ["FACULDADE ADVENTISTA DA AMAZÔNIA", "SEMINÁRIO ADVENTISTA LATINO-AMERICANO DE TEOLOGIA", "BACHARELADO EM TEOLOGIA"],
      titulo: "TRABALHO FINAL DE ATIVIDADES DE EXTENSÃO",
      subtitulo: nomeSemExtensao(disc.nome),
      autor: perfil.nome.toUpperCase(),
      cidade: CIDADE_CAPA, ano,
      natureza: `Trabalho Final de Atividades de Extensão apresentado à Faculdade Adventista da Amazônia como requisito da unidade curricular ${disc.nome}, no curso de Bacharelado em Teologia do Seminário Adventista Latino-Americano de Teologia.`,
      orientador: dados.orientador || "",
    },
    titulos, figuras, quadros, corpo,
    // sem acentos: alguns navegadores trocam por "download" um nome com acento
    nomeArquivo: `Portfolio - ${perfil.nome} - ${nomeSemExtensao(disc.nome)}`.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim(),
  };
}

// Carrega tudo o que o documento precisa
export async function carregarDados(db, perfil) {
  const disciplina = await db.um("disciplinas", { id: `eq.${perfil.disciplina_id}` });
  const portfolio = await db.um("portfolios", { aluno_id: `eq.${perfil.id}`, disciplina_id: `eq.${perfil.disciplina_id}` });
  const [requisitos, dias, figuras, referencias, config] = await Promise.all([
    db.sel("requisitos", { disciplina_id: `eq.${disciplina.id}`, order: "ordem.asc,criado_em.asc" }),
    db.sel("dias", { portfolio_id: `eq.${portfolio.id}`, order: "data.asc" }),
    db.sel("figuras", { portfolio_id: `eq.${portfolio.id}`, order: "ordem.asc,criado_em.asc" }),
    db.sel("referencias", { portfolio_id: `eq.${portfolio.id}`, order: "criado_em.asc" }),
    db.um("config", { id: "eq.1" }),
  ]);
  const atividades = dias.length ? await db.sel("atividades", { dia_id: `in.(${dias.map((d) => d.id).join(",")})`, order: "criado_em.asc" }) : [];
  return { perfil, disciplina, portfolio, requisitos, dias, atividades, figuras, referencias, orientador: config?.orientador || "" };
}

export { PERGUNTAS };

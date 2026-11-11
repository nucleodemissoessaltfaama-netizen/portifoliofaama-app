// Dicas e textos automáticos do Portfólio (redação conforme a especificação do Wilson).
import { porExtenso, duracao, diaMesExtenso, dataExtenso } from "./ui.js";

export const DICAS = {
  introducao: "Texto introdutório – importância, justificativa e objetivos da extensão – 3 a 4 parágrafos. Por tratar-se de relatório ou relato pessoal, em todo o relatório é usada a 1ª pessoa do singular explicitando, claramente, o que você fez e o que você aprendeu. Lembre-se que esse relato será a base da avaliação de seu desempenho no extensão supervisionada. A redação não é científica, nem coloquial: é uma redação técnico-profissional, demonstrando sua vivência profissional vocacionado, a base da extensão supervisionada no SALT-FAAMA",
  perfil_discente: "Descrever em 3 a 4 parágrafos as principais características do discente em relação ao período formativo do curso e suas expectativas quanto a extensão supervisionada [hipótese].",
  caract_campo: "Informar e descrever as características do campo de extensão, incluindo aspectos históricos, perfis administrativos e eclesiásticos. Se o extensão foi realizada em etapas em mais de um campo, toda esta sessão, incluindo os subtítulos, deve ser duplicada para permitir a inclusão das informações de cada campo de extensão e respectivas atividades.",
  caract_cidade: "Descrever a cidade/bairro onde foi realizada a campanha evangelística ou plantio de igreja. Aspectos sócio-políticos, econômicos, demográficos e religiosos devem ser detalhadas, incluindo mapas, fotos, tabelas e gráficos, devidamente referenciados e legendados. Além da observação pessoal e do diálogo com residentes e autoridades, fontes como o banco de dados do IBGE Cidades (IBGE, 2021), sites dos órgãos públicos tais como Prefeitura Municipal, e outras como o Fórum Nacional das Entidades Metropolitanas (FNEM, 2018) ou o Portal Brasileiro de Dados Abertos (BRASIL, 2018) podem ser consultados.",
  igreja_texto: "Descreva a igreja de apoio (ou igreja base): nome, distrito, número de membros, Unidades de Ação, estudos bíblicos, supervisores e endereço. Abaixo, coloque o print do Google Maps com a localização e as fotos de dentro e da frente da igreja.",
  organograma_desc: "Descreva a estrutura administrativa da sua igreja de prática antes de montar o organograma.",
  analise: "Analise os resultados obtidos nas atividades desenvolvidas durante a extensão.",
  conclusao: "Escreva a conclusão do seu trabalho.",
  referencias: "Coloque uma referência por vez, no formato ABNT. No arquivo final elas saem em ordem alfabética, na última página. Use os botões N e I para o negrito e o itálico (ex.: o título da obra).",
};

export const PERGUNTAS = [
  ["a", "A) O que foi feito:"],
  ["b", "B) Por que foi feito:"],
  ["c", "C) Como foi feito:"],
  ["d", "D) Relação teórico-prática:"],
  ["e", "E) Qual a aprendizagem com a atividade:"],
];

// "Extensão: Prática Pastoral Comunitária II" → "Prática Pastoral Comunitária II"
export const nomeSemExtensao = (nome) => String(nome || "").replace(/^\s*extens[ãa]o\s*:\s*/i, "").trim();

function nDias(n) {
  return n === 1 ? "no único dia de atuação" : `em cada um dos ${porExtenso(n)} dias de atuação`;
}

export function textoSecao2(nDiasPratica) {
  return `Nesta seção são apresentadas as atividades desenvolvidas durante a Prática Pastoral Comunitária, com a caracterização do campo de extensão, da igreja de apoio e das ações realizadas ${nDias(nDiasPratica)}, bem como a análise dos resultados obtidos.`;
}

export function textoSecao22(nDiasPratica) {
  const ao = nDiasPratica === 1 ? "ao longo do dia de prática pastoral" : `ao longo dos ${porExtenso(nDiasPratica)} dias de prática pastoral`;
  return `A seguir são descritas as atividades centrais desenvolvidas ${ao}, apresentadas em ordem cronológica, com a indicação do que foi feito, por que foi feito, como foi feito, a relação teórico-prática envolvida e a aprendizagem obtida em cada uma delas.`;
}

const fmtHoras = (h) => String(h ?? "").replace(".", ",");

export function textoCargaHoraria(disc, campo) {
  const periodo = disc.inicio && disc.fim
    ? `realizado no período de ${diaMesExtenso(disc.inicio)}${disc.inicio.slice(0, 4) !== disc.fim.slice(0, 4) ? " de " + disc.inicio.slice(0, 4) : ""} a ${dataExtenso(disc.fim, true)}`
    : "realizado no período [datas não cadastradas]";
  const partes = [
    `As atividades de extensão em ${nomeSemExtensao(disc.nome)} que ocorreram no campo de estágio ${campo || "[campo de extensão]"}`,
    ` correspondem ao período de ${duracao(disc.inicio, disc.fim) || "[período]"}`,
    `, com carga horária de ${fmtHoras(disc.carga_requerida) || "[ ]"} horas`,
    `, totalizando ${fmtHoras(disc.carga_semanal) || "[ ]"} horas semanais`,
    `, ${periodo}`,
    disc.horario ? ` no horário de ${disc.horario.replace(/^\s*(de|das)\s+/i, "")}` : "",
    ".",
  ];
  return partes.join("");
}

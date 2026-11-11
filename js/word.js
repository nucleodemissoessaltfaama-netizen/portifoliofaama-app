// Gera o Trabalho Final em .docx de verdade (XML montado à mão, sem biblioteca):
// capa, folha de rosto, listas e sumário (campos do Word com números já calculados),
// corpo com notas de rodapé, figuras numeradas, quadro e referências.
import { calcularPaginas, medidasFigura, tamanhoImagem, LIMITES, CAPA, ROSTO } from "./previa.js";
import { zipar } from "./zip.js";

const TW = 567;            // twips por cm
const EMU = 360000;        // EMU por cm
const LARG_UTIL = 9071;    // 16 cm em twips

const x = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]))
  // caracteres de controle quebram o XML
  .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");

function r(texto, o = {}) {
  const pr = [o.b && "<w:b/><w:bCs/>", o.i && "<w:i/><w:iCs/>", o.cor && `<w:color w:val="${o.cor}"/>`, o.sz && `<w:sz w:val="${o.sz}"/><w:szCs w:val="${o.sz}"/>`].filter(Boolean).join("");
  return `<w:r>${pr ? `<w:rPr>${pr}</w:rPr>` : ""}<w:t xml:space="preserve">${x(texto)}</w:t></w:r>`;
}

function p(conteudo, o = {}) {
  const pr = [
    o.estilo && `<w:pStyle w:val="${o.estilo}"/>`,
    o.keepNext && "<w:keepNext/>",
    o.quebra && "<w:pageBreakBefore/>",
    o.frame && `<w:framePr w:w="${LARG_UTIL}" w:wrap="around" w:vAnchor="margin" w:hAnchor="margin" w:xAlign="center" w:yAlign="bottom"/>`,
    o.antes !== undefined || o.linha ? `<w:spacing${o.antes !== undefined ? ` w:before="${Math.round(o.antes * 20)}"` : ""} w:after="0"${o.linha ? ` w:line="${o.linha}" w:lineRule="auto"` : ""}/>` : "",
    o.ind && `<w:ind w:left="${o.ind}"/>`,
    o.jc && `<w:jc w:val="${o.jc}"/>`,
    o.sect,
  ].filter(Boolean).join("");
  return `<w:p>${pr ? `<w:pPr>${pr}</w:pPr>` : ""}${conteudo}</w:p>`;
}

const campo = (instr, resultado, o = {}) =>
  `<w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText xml:space="preserve"> ${instr} </w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r>${r(resultado, o)}<w:r><w:fldChar w:fldCharType="end"/></w:r>`;

// ---------------------------------------------------------------- imagens
async function baixar(url) {
  const resp = await fetch(url, { cache: "force-cache" });
  if (!resp.ok) throw new Error("Imagem indisponível: " + url);
  const tipo = resp.headers.get("content-type") || "";
  const dados = new Uint8Array(await resp.arrayBuffer());
  const png = tipo.includes("png") || (dados[0] === 0x89 && dados[1] === 0x50);
  return { dados, ext: png ? "png" : "jpeg" };
}

function desenho(rid, id, wcm, hcm) {
  const cx = Math.round(wcm * EMU), cy = Math.round(hcm * EMU);
  return `<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/><wp:docPr id="${id}" name="Imagem ${id}"/>
<wp:cNvGraphicFramePr><a:graphicFrameLocks xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" noChangeAspect="1"/></wp:cNvGraphicFramePr>
<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">
<pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="${id}" name="img${id}"/><pic:cNvPicPr/></pic:nvPicPr>
<pic:blipFill><a:blip r:embed="${rid}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>
<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`;
}

// ---------------------------------------------------------------- montagem
export async function montarDocx(dados) {
  const { pag, doc, dims } = await calcularPaginas(dados);
  const imagens = new Map();   // url → { rid, nome, dados }
  let idDesenho = 1;
  const pegarImg = async (url) => {
    if (!imagens.has(url)) {
      const b = await baixar(url);
      const n = imagens.size + 1;
      imagens.set(url, { rid: "rIdImg" + n, nome: `media/imagem${n}.${b.ext}`, ...b });
    }
    return imagens.get(url);
  };

  const notas = [];
  const runsXml = (runs) => runs.map((q) => {
    if (q.nota !== undefined) {
      notas.push(q.nota);
      return `<w:r><w:rPr><w:rStyle w:val="RefNota"/></w:rPr><w:footnoteReference w:id="${notas.length + 1}"/></w:r>`;
    }
    return r(q.tx, { b: q.b, i: q.i });
  }).join("");

  const c = doc.capa;
  const corpo = [];

  // ---- capa
  corpo.push(...c.instituicao.map((t, i) => p(r(t, { b: true }), { jc: "center", antes: i ? 0 : CAPA.antesInst })));
  corpo.push(p(r(c.titulo, { b: true, sz: 28 }), { jc: "center", antes: CAPA.antesTitulo }));
  corpo.push(p(r(c.subtitulo, { b: true, i: true }), { jc: "center" }));
  corpo.push(p(r(c.autor, { b: true }), { jc: "center", antes: CAPA.antesAutor }));
  corpo.push(p(r(c.cidade, { b: true }), { jc: "center", frame: true }));
  corpo.push(p(r(c.ano, { b: true }), { jc: "center", frame: true }));

  // ---- folha de rosto
  corpo.push(p(r(c.autor, { b: true }), { jc: "center", quebra: true }));
  corpo.push(p(r(c.titulo, { b: true, sz: 28 }), { jc: "center", antes: ROSTO.antesTitulo }));
  corpo.push(p(r(c.subtitulo, { b: true, i: true }), { jc: "center" }));
  corpo.push(p(r(c.natureza), { jc: "both", ind: 8 * TW, antes: ROSTO.antesNatureza, linha: 240 }));
  corpo.push(p(r("Docente Orientador:"), { jc: "left", ind: 8 * TW, antes: 12, linha: 240 }));
  corpo.push(p(r(c.orientador), { jc: "left", ind: 8 * TW, linha: 240 }));
  corpo.push(p(r(c.cidade, { b: true }), { jc: "center", frame: true }));
  corpo.push(p(r(c.ano, { b: true }), { jc: "center", frame: true }));

  // ---- listas e sumário (campos do Word, com o resultado já preenchido)
  const lista = (titulo, instr, estiloEnt, entradas) => {
    corpo.push(p(r(titulo, { b: true }), { estilo: "TituloLista", quebra: true }));
    if (!entradas.length) { corpo.push(p(campo(instr, "Nenhuma entrada."))); return; }
    entradas.forEach((e, i) => {
      const ini = i === 0 ? `<w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText xml:space="preserve"> ${instr} </w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r>` : "";
      const fim = i === entradas.length - 1 ? `<w:r><w:fldChar w:fldCharType="end"/></w:r>` : "";
      corpo.push(p(`${ini}${r(e.texto, { b: e.negrito })}<w:r><w:tab/></w:r>${r(String(pag.get(e.id) ?? ""), { b: e.negrito })}${fim}`, { estilo: estiloEnt(e) }));
    });
  };
  if (doc.figuras.length) lista("LISTA DE FIGURAS", 'TOC \\h \\z \\c "Figura"', () => "IndiceIlustracoes", doc.figuras.map((f) => ({ id: f.id, texto: f.sup })));
  lista("LISTA DE QUADROS", 'TOC \\h \\z \\c "Quadro"', () => "IndiceIlustracoes", doc.quadros.map((q) => ({ id: q.id, texto: q.entrada })));
  lista("SUMÁRIO", 'TOC \\o "1-4" \\h \\z \\u', (e) => "TOC" + e.nivel, doc.titulos.map((t) => ({ id: t.id, nivel: t.nivel, texto: `${t.numero} ${t.texto}`, negrito: t.nivel === 1 })));
  // fim da 1ª seção (sem número de página visível)
  corpo.push(p("", { sect: secao(false) }));

  // ---- corpo
  let primeiro = true;
  for (const b of doc.corpo) {
    if (b.t === "h") {
      // o primeiro título (Introdução) vem logo depois da quebra de seção, que já começa página nova
      corpo.push(p(r(`${b.numero} ${b.texto}`), { estilo: "Heading" + b.nivel, quebra: b.novaPagina && !primeiro }));
    } else if (b.t === "p") {
      const est = { corpo: "Corpo", atividade: "Atividade", ref: "Referencia" }[b.estilo] || "Corpo";
      corpo.push(p(runsXml(b.runs), { estilo: est }));
    } else if (b.t === "fig") {
      const num = b.num, sup = b.sup.replace(/^Figura \d+\.\s*/, ""), inf = b.inf;
      corpo.push(p(r("Figura ", { i: true }) + campo("SEQ Figura \\* ARABIC", String(num), { i: true }) + r(". " + sup, { i: true }), { estilo: "Legenda", keepNext: true }));
      const med = medidasFigura(b, dims);
      let imgs = "";
      for (let i = 0; i < b.imgs.length; i++) {
        try {
          const im = await pegarImg(b.imgs[i]);
          imgs += (i ? r("  ") : "") + desenho(im.rid, idDesenho++, med[i].w, med[i].h);
        } catch { imgs += r("[imagem indisponível]"); }
      }
      corpo.push(p(imgs, { estilo: "Imagem", keepNext: true }));
      corpo.push(p(r(inf, { i: true }), { estilo: "Legenda" }));
    } else if (b.t === "img") {
      try {
        const im = await pegarImg(b.url);
        const d = dims.get(b.url) || { w: 4, h: 3 }, m = tamanhoImagem(d.w, d.h, ...LIMITES.org);
        corpo.push(p(desenho(im.rid, idDesenho++, m.w, m.h), { estilo: "Imagem" }));
      } catch { corpo.push(p(r("[organograma indisponível]"), { estilo: "Imagem" })); }
    } else if (b.t === "quadro") {
      corpo.push(tabelaQuadro(b));
      corpo.push(p(r("Quadro ", { b: true }) + campo("SEQ Quadro \\* ARABIC", String(b.num), { b: true }) + r(" – Resumo das atividades de extensão", { b: true }), { estilo: "LegendaQuadro" }));
    }
    primeiro = false;
  }

  const documento = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing">
<w:body>${corpo.join("\n")}${secao(true)}</w:body></w:document>`;

  const rodapes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:footnotes xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<w:footnote w:type="separator" w:id="0"><w:p><w:pPr><w:spacing w:after="0" w:line="240" w:lineRule="auto"/></w:pPr><w:r><w:separator/></w:r></w:p></w:footnote>
<w:footnote w:type="continuationSeparator" w:id="1"><w:p><w:pPr><w:spacing w:after="0" w:line="240" w:lineRule="auto"/></w:pPr><w:r><w:continuationSeparator/></w:r></w:p></w:footnote>
${notas.map((t, i) => `<w:footnote w:id="${i + 2}"><w:p><w:pPr><w:pStyle w:val="NotaRodape"/></w:pPr><w:r><w:rPr><w:rStyle w:val="RefNota"/></w:rPr><w:footnoteRef/></w:r>${r(" " + t)}</w:p></w:footnote>`).join("\n")}
</w:footnotes>`;

  const cabecalho = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:hdr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<w:p><w:pPr><w:pStyle w:val="Cabecalho"/></w:pPr>${campo("PAGE", "1", { sz: 20 })}</w:p></w:hdr>`;

  const imgs = [...imagens.values()];
  const arquivos = [
    { nome: "[Content_Types].xml", dados: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Default Extension="jpeg" ContentType="image/jpeg"/>
<Default Extension="png" ContentType="image/png"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
<Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/>
<Override PartName="/word/footnotes.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footnotes+xml"/>
<Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/>
<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
</Types>` },
    { nome: "_rels/.rels", dados: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
</Relationships>` },
    { nome: "docProps/core.xml", dados: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
<dc:title>${x(c.titulo)}</dc:title><dc:creator>${x(dados.perfil.nome)}</dc:creator>
<dcterms:created xsi:type="dcterms:W3CDTF">${new Date().toISOString().slice(0, 19)}Z</dcterms:created></cp:coreProperties>` },
    { nome: "word/_rels/document.xml.rels", dados: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rIdEstilos" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
<Relationship Id="rIdConfig" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/>
<Relationship Id="rIdNotas" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footnotes" Target="footnotes.xml"/>
<Relationship Id="rIdCab" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/>
${imgs.map((i) => `<Relationship Id="${i.rid}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="${i.nome}"/>`).join("\n")}
</Relationships>` },
    { nome: "word/document.xml", dados: documento },
    { nome: "word/styles.xml", dados: ESTILOS },
    { nome: "word/settings.xml", dados: CONFIG },
    { nome: "word/footnotes.xml", dados: rodapes },
    { nome: "word/header1.xml", dados: cabecalho },
    ...imgs.map((i) => ({ nome: "word/" + i.nome, dados: i.dados })),
  ];
  return { blob: zipar(arquivos), nome: doc.nomeArquivo + ".docx" };
}

function secao(comCabecalho) {
  return `<w:sectPr>${comCabecalho ? '<w:headerReference w:type="default" r:id="rIdCab"/>' : ""}
<w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="${3 * TW}" w:right="${2 * TW}" w:bottom="${2 * TW}" w:left="${3 * TW}" w:header="${Math.round(1.6 * TW)}" w:footer="${TW}" w:gutter="0"/>
<w:cols w:space="708"/></w:sectPr>`;
}

function tabelaQuadro(b) {
  const borda = (n) => `<w:${n} w:val="single" w:sz="4" w:space="0" w:color="808080"/>`;
  const cel = (texto, o = {}) => `<w:tc><w:tcPr><w:tcW w:w="${o.w}" w:type="dxa"/>${o.span ? `<w:gridSpan w:val="${o.span}"/>` : ""}${o.fundo ? `<w:shd w:val="clear" w:color="auto" w:fill="${o.fundo}"/>` : ""}<w:vAlign w:val="center"/></w:tcPr>
    ${p(r(texto, { b: o.b, cor: o.cor }), { estilo: "Tabela", jc: o.jc || "left" })}</w:tc>`;
  const W = [4706, 2948, 1417];
  const cab = `<w:tr><w:trPr><w:tblHeader/><w:cantSplit/></w:trPr>${["Atividade", "Período", "Horas"].map((t, i) => cel(t, { w: W[i], b: true, cor: "FFFFFF", fundo: "1F3864", jc: "center" })).join("")}</w:tr>`;
  const linhas = b.linhas.map((l, k) => {
    const fundo = k % 2 ? "F2F2F2" : undefined;
    return `<w:tr><w:trPr><w:cantSplit/></w:trPr>${cel(l.atividade, { w: W[0], fundo })}${cel(l.periodo, { w: W[1], fundo, jc: "center" })}${cel(l.horas, { w: W[2], fundo, jc: "center" })}</w:tr>`;
  }).join("");
  const total = `<w:tr><w:trPr><w:cantSplit/></w:trPr>${cel("Total de horas da Extensão Curricular Supervisionada", { w: W[0] + W[1], span: 2, b: true, jc: "center" })}${cel(b.total, { w: W[2], b: true, jc: "center" })}</w:tr>`;
  return `<w:tbl><w:tblPr><w:tblW w:w="${LARG_UTIL}" w:type="dxa"/><w:jc w:val="center"/>
<w:tblBorders>${["top", "left", "bottom", "right", "insideH", "insideV"].map(borda).join("")}</w:tblBorders>
<w:tblLayout w:type="fixed"/><w:tblCellMar><w:top w:w="57" w:type="dxa"/><w:left w:w="85" w:type="dxa"/><w:bottom w:w="57" w:type="dxa"/><w:right w:w="85" w:type="dxa"/></w:tblCellMar></w:tblPr>
<w:tblGrid>${W.map((w) => `<w:gridCol w:w="${w}"/>`).join("")}</w:tblGrid>${cab}${linhas}${total}</w:tbl>`;
}

const TNR = '<w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:eastAsia="Times New Roman" w:cs="Times New Roman"/>';
const TAB_PONTOS = `<w:tabs><w:tab w:val="right" w:leader="dot" w:pos="${LARG_UTIL - 10}"/></w:tabs>`;
const titulo = (n) => `<w:style w:type="paragraph" w:styleId="Heading${n}"><w:name w:val="heading ${n}"/><w:basedOn w:val="Normal"/><w:next w:val="Corpo"/><w:uiPriority w:val="9"/><w:qFormat/>
<w:pPr><w:keepNext/><w:keepLines/><w:spacing w:before="240" w:after="0"/><w:jc w:val="left"/><w:outlineLvl w:val="${n - 1}"/></w:pPr><w:rPr><w:b/><w:bCs/></w:rPr></w:style>`;
const toc = (n) => `<w:style w:type="paragraph" w:styleId="TOC${n}"><w:name w:val="toc ${n}"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:uiPriority w:val="39"/>
<w:pPr>${TAB_PONTOS}<w:spacing w:after="60" w:line="240" w:lineRule="auto"/><w:ind w:left="${(n - 1) * 284}" w:right="567"/><w:jc w:val="left"/></w:pPr>${n === 1 ? "<w:rPr><w:b/><w:bCs/></w:rPr>" : ""}</w:style>`;

const ESTILOS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:docDefaults><w:rPrDefault><w:rPr>${TNR}<w:sz w:val="24"/><w:szCs w:val="24"/><w:lang w:val="pt-BR" w:eastAsia="en-US" w:bidi="ar-SA"/></w:rPr></w:rPrDefault>
<w:pPrDefault><w:pPr><w:spacing w:after="0" w:line="360" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>
<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/><w:pPr><w:jc w:val="both"/></w:pPr></w:style>
<w:style w:type="character" w:default="1" w:styleId="FonteParagPadrao"><w:name w:val="Default Paragraph Font"/><w:uiPriority w:val="1"/><w:semiHidden/></w:style>
<w:style w:type="paragraph" w:styleId="Corpo"><w:name w:val="Corpo do trabalho"/><w:basedOn w:val="Normal"/><w:qFormat/><w:pPr><w:ind w:firstLine="709"/></w:pPr></w:style>
<w:style w:type="paragraph" w:styleId="Atividade"><w:name w:val="Atividade A-E"/><w:basedOn w:val="Normal"/></w:style>
<w:style w:type="paragraph" w:styleId="Referencia"><w:name w:val="Referência"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:after="240" w:line="240" w:lineRule="auto"/><w:jc w:val="left"/></w:pPr></w:style>
${[1, 2, 3, 4].map(titulo).join("\n")}
<w:style w:type="paragraph" w:styleId="Legenda"><w:name w:val="caption"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:spacing w:before="60" w:after="60" w:line="240" w:lineRule="auto"/><w:jc w:val="center"/></w:pPr><w:rPr><w:i/><w:iCs/><w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="LegendaQuadro"><w:name w:val="Legenda do quadro"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:before="120" w:after="0" w:line="240" w:lineRule="auto"/><w:jc w:val="center"/></w:pPr><w:rPr><w:b/><w:bCs/><w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Imagem"><w:name w:val="Imagem"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:before="0" w:after="0" w:line="240" w:lineRule="auto"/><w:jc w:val="center"/></w:pPr></w:style>
<w:style w:type="paragraph" w:styleId="Tabela"><w:name w:val="Texto da tabela"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:after="0" w:line="240" w:lineRule="auto"/><w:jc w:val="left"/></w:pPr><w:rPr><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="TituloLista"><w:name w:val="Título de lista"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:after="240"/><w:jc w:val="center"/></w:pPr><w:rPr><w:b/><w:bCs/></w:rPr></w:style>
${[1, 2, 3, 4].map(toc).join("\n")}
<w:style w:type="paragraph" w:styleId="IndiceIlustracoes"><w:name w:val="table of figures"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:uiPriority w:val="99"/><w:pPr>${TAB_PONTOS}<w:spacing w:after="60" w:line="240" w:lineRule="auto"/><w:ind w:right="567"/><w:jc w:val="left"/></w:pPr></w:style>
<w:style w:type="paragraph" w:styleId="NotaRodape"><w:name w:val="footnote text"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:after="0" w:line="240" w:lineRule="auto"/><w:jc w:val="both"/></w:pPr><w:rPr><w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr></w:style>
<w:style w:type="character" w:styleId="RefNota"><w:name w:val="footnote reference"/><w:rPr><w:vertAlign w:val="superscript"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Cabecalho"><w:name w:val="header"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:line="240" w:lineRule="auto"/><w:jc w:val="right"/></w:pPr><w:rPr><w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr></w:style>
</w:styles>`;

const CONFIG = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:updateFields w:val="true"/><w:defaultTabStop w:val="709"/><w:hyphenationZone w:val="425"/><w:characterSpacingControl w:val="doNotCompress"/>
<w:footnotePr><w:footnote w:id="0"/><w:footnote w:id="1"/></w:footnotePr>
<w:compat><w:compatSetting w:name="compatibilityMode" w:uri="http://schemas.microsoft.com/office/word" w:val="15"/></w:compat>
<w:themeFontLang w:val="pt-BR"/></w:settings>`;

// ---------------------------------------------------------------- baixar
export async function gerarWord(dados) {
  const { blob, nome } = await montarDocx(dados);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = nome;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
  return { blob, nome };
}

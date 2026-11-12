// Gera o PDF a partir das mesmas folhas da prévia: cada página vira uma imagem A4 em alta
// resolução (html2canvas) e o jsPDF junta tudo. Fica idêntico ao que aparece em "Visualizar".
import { el } from "./ui.js";
import { paginar, montarFolhas } from "./previa.js";

const LIBS = [
  "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js",
];

function carregarScript(url) {
  return new Promise((ok, falha) => {
    if (document.querySelector(`script[src="${url}"]`)) return ok();
    const s = document.createElement("script");
    s.src = url;
    s.onload = ok;
    s.onerror = () => falha(new Error("Não foi possível carregar o gerador de PDF. Confira a internet e tente de novo."));
    document.head.append(s);
  });
}

const esperarImagens = (raiz) => Promise.all([...raiz.querySelectorAll("img")].map((i) => (i.complete ? null : new Promise((ok) => { i.onload = i.onerror = ok; }))));

export async function gerarPdf(dados, nome, aoAvancar) {
  for (const u of LIBS) await carregarScript(u);
  const r = await paginar(dados);
  const palco = el(`<div style="position:fixed;left:-40000px;top:0;width:21cm;background:#fff"></div>`);
  document.body.append(palco);
  try {
    const folhas = montarFolhas(r);
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ unit: "mm", format: "a4", compress: true });
    pdf.setProperties({ title: r.doc.capa.titulo, author: dados.perfil.nome });
    for (let i = 0; i < folhas.length; i++) {
      aoAvancar?.(i + 1, folhas.length);
      const f = folhas[i];
      f.style.boxShadow = "none";
      palco.replaceChildren(f);
      await esperarImagens(f);
      const canvas = await window.html2canvas(f, { scale: 2, useCORS: true, backgroundColor: "#ffffff", logging: false });
      if (i) pdf.addPage("a4", "portrait");
      pdf.addImage(canvas.toDataURL("image/jpeg", 0.88), "JPEG", 0, 0, 210, 297, undefined, "FAST");
    }
    const blob = pdf.output("blob");
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = nome + ".pdf";
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
    return { blob, paginas: folhas.length };
  } finally {
    palco.remove();
    r.regua.remove();
  }
}

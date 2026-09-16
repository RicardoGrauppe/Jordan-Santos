/*
  Nós próprios e serializador do editor de contrato. Portado de
  `configuracoes-editor.js` do estúdio do Jordan.

  Três nós além do StarterKit:
    campo            → inline atômico, vira <span class="campo" data-campo="...">
    tabelaItens      → bloco atômico, vira a <table aria-label="Serviços contratados">
    blocoAssinaturas → bloco atômico, vira o <div class="assinaturas" id="bloco-assinaturas">

  São os MESMOS três nós que `contrato-pdf/gerar-pdfmake.ts` sabe converter pra
  PDF, e a MESMA estrutura HTML que as telas de revisão e assinatura preenchem
  via [data-campo]. Mudar a marcação aqui quebra as duas pontas.

  Este arquivo não tem React de propósito: o serializador roda no servidor
  também (rota de templates), e a rota não pode puxar o editor inteiro.
*/
import { Node, mergeAttributes, type JSONContent } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import TextAlign from "@tiptap/extension-text-align";

/** Rótulo de cada data-campo, pro menu "Inserir campo". É a lista inteira que o
 *  texto pode referenciar (a mesma de valorDoCampo no gerador de PDF). */
export const ROTULOS_CAMPO: Record<string, string> = {
  "noivo": "Nome do noivo",
  "cpf-noivo": "CPF do noivo",
  "noiva": "Nome da noiva",
  "cpf-noiva": "CPF da noiva",
  "endereco": "Endereço",
  "numero": "Número",
  "bairro": "Bairro",
  "cidade": "Cidade",
  "complemento": "Complemento",
  "estado": "Estado",
  "cep": "CEP",
  "tel-noivo": "Telefone do noivo",
  "tel-noiva": "Telefone da noiva",
  "data-formatada": "Data do evento",
  "local": "Local do evento",
  "horario": "Horário",
  "valor-total": "Valor total",
  "valor-entrada": "Valor de entrada",
  "cidade-assinatura": "Cidade (assinatura)",
  "data-assinatura": "Data (assinatura)",
};

function placeholder(texto: string) {
  return () => {
    const div = document.createElement("div");
    div.className = "placeholder-no-editor";
    div.textContent = texto;
    return { dom: div };
  };
}

export const Campo = Node.create({
  name: "campo",
  group: "inline",
  inline: true,
  atom: true,
  addAttributes() { return { campo: { default: null } }; },
  parseHTML() {
    return [{ tag: "span.campo[data-campo]", getAttrs: (el) => ({ campo: (el as HTMLElement).getAttribute("data-campo") }) }];
  },
  renderHTML({ node }) {
    const nome = node.attrs.campo as string;
    /* o rótulo é só o que aparece ANTES de preencherCampo() rodar nas telas
       reais, onde [data-campo] é achado por seletor e o texto é sobrescrito */
    return ["span", mergeAttributes({ class: "campo", "data-campo": nome }), ROTULOS_CAMPO[nome] ?? nome];
  },
});

export const TabelaItens = Node.create({
  name: "tabelaItens",
  group: "block",
  atom: true,
  parseHTML() { return [{ tag: 'table[aria-label="Serviços contratados"]' }]; },
  renderHTML() {
    return ["table", { "aria-label": "Serviços contratados" },
      ["thead", {}, ["tr", {}, ["th", {}, "QTD"], ["th", {}, "DESCRIÇÃO DOS SERVIÇOS"], ["th", {}, "VALOR TOTAL"]]],
      ["tbody", { id: "tabela-servicos" }]];
  },
  addNodeView() {
    return placeholder("Tabela de itens (pacote + adicionais + valor total, preenchida na hora de gerar o contrato)");
  },
});

export const BlocoAssinaturas = Node.create({
  name: "blocoAssinaturas",
  group: "block",
  atom: true,
  parseHTML() { return [{ tag: "div.assinaturas" }]; },
  renderHTML() {
    return ["div", { class: "assinaturas", id: "bloco-assinaturas" },
      ["p", {}, ["span", { class: "campo", "data-campo": "cidade-assinatura" }, "Cidade"], ", ",
        ["span", { class: "campo", "data-campo": "data-assinatura" }, "Data"], "."],
      ["div", { id: "assinatura-jordan-area" }]];
  },
  addNodeView() {
    return placeholder("Bloco de assinaturas (cidade/data + assinatura do casal + assinatura do fotógrafo)");
  },
});

/* defaultAlignment "justify" porque é assim que o contrato renderiza em todo
   lugar. Com o padrão da extensão ("left"), parágrafo em que ninguém tocou
   vinha marcado como alinhado à esquerda, o serializador gravava class="al-left"
   em todo bloco no primeiro autosave, e o PDF deixava de ser justificado. */
export const EXTENSOES = [
  StarterKit,
  TextAlign.configure({ types: ["heading", "paragraph"], defaultAlignment: "justify" }),
  Campo,
  TabelaItens,
  BlocoAssinaturas,
];

/* ---------- JSON → HTML ----------
   Não dá pra usar editor.getHTML(): ele geraria os nós próprios com a marcação
   de PLACEHOLDER do editor, não a estrutura final que as telas preenchem. */

function esc(s: unknown): string {
  return String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);
}

function inlineParaHtml(nos: JSONContent[] | undefined): string {
  return (nos ?? []).map((n) => {
    if (n.type === "text") {
      let t = esc(n.text ?? "");
      for (const m of n.marks ?? []) {
        if (m.type === "bold") t = "<strong>" + t + "</strong>";
        if (m.type === "italic") t = "<em>" + t + "</em>";
      }
      return t;
    }
    if (n.type === "campo") return '<span class="campo" data-campo="' + esc(n.attrs?.campo) + '"></span>';
    if (n.type === "hardBreak") return "<br>";
    return "";
  }).join("");
}

/* Alinhamento vira classe, não style inline: as telas e o CSS de impressão
   controlam a aparência, e classe é o que elas sabem estilizar. "justify" é o
   padrão do documento e não precisa de classe. */
function classeAlinhamento(no: JSONContent): string {
  const a = no.attrs?.textAlign;
  return !a || a === "justify" ? "" : ' class="al-' + a + '"';
}

function noParaHtml(no: JSONContent): string {
  if (no.type === "paragraph") return "<p" + classeAlinhamento(no) + ">" + inlineParaHtml(no.content) + "</p>";
  if (no.type === "heading") {
    const n = no.attrs?.level ?? 2;
    return `<h${n}${classeAlinhamento(no)}>${inlineParaHtml(no.content)}</h${n}>`;
  }
  if (no.type === "bulletList" || no.type === "orderedList") {
    const tag = no.type === "orderedList" ? "ol" : "ul";
    const itens = (no.content ?? []).map((li) =>
      "<li>" + nosParaHtml(li.content).replace(/^<p>|<\/p>$/g, "") + "</li>").join("");
    return `<${tag}>${itens}</${tag}>`;
  }
  if (no.type === "tabelaItens") {
    return '<table aria-label="Serviços contratados"><thead><tr><th>QTD</th><th>DESCRIÇÃO DOS SERVIÇOS</th><th>VALOR TOTAL</th></tr></thead><tbody id="tabela-servicos"></tbody></table>';
  }
  if (no.type === "blocoAssinaturas") {
    return '<div class="assinaturas" id="bloco-assinaturas">' +
      '<p><span class="campo" data-campo="cidade-assinatura"></span>, <span class="campo" data-campo="data-assinatura"></span>.</p>' +
      '<p class="linha-ass"><span class="campo" data-campo="noivo"></span></p>' +
      '<div id="assinatura-jordan-area"><p class="linha-ass">Jordan Santos &ndash; CONTRATADA</p></div>' +
      "</div>";
  }
  return "";
}

function nosParaHtml(nos: JSONContent[] | undefined): string {
  return (nos ?? []).map(noParaHtml).join("\n");
}

/** Documento inteiro, na casca que o template sempre teve (section > blocos). */
export function jsonParaHtml(doc: JSONContent | null | undefined): string {
  return '<section class="secao">' + nosParaHtml(doc?.content) + "</section>";
}

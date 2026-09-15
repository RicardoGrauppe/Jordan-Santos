/*
  Editor Tiptap do texto do contrato, carregado só em /configuracoes (seção
  "Contrato e assinatura"). Fonte duplicada de propósito, mesmo motivo do
  resto do site: página single-file, sem build.

  Três nós próprios além do StarterKit padrão:
    - campo             → inline atômico, vira <span class="campo" data-campo="...">
    - tabelaItens        → bloco atômico, vira a <table aria-label="Serviços contratados">
    - blocoAssinaturas   → bloco atômico, vira o <div class="assinaturas" id="bloco-assinaturas">

  São os MESMOS três nós que api/_lib/contrato-pdf/gerar-pdfmake.js sabe
  converter pra PDF, e a MESMA estrutura HTML que contrato-template.js sempre
  produziu — trocar de um texto fixo pra um editável não pode mudar o que
  assinar.html/revisar-contrato.html sabem preencher via [data-campo].

  Tiptap via ESM (esm.sh) — não existe UMD oficial do pacote, e o resto do
  site já usa <script type="module"> quando precisa (nenhum caso ainda, mas é
  o padrão natural pra biblioteca ESM-only; scripts de terceiro em UMD, como
  o signature_pad, continuam por <script src> comum).
*/
import { Editor, Node, mergeAttributes } from "https://esm.sh/@tiptap/core@2.9.1";
import StarterKit from "https://esm.sh/@tiptap/starter-kit@2.9.1";
/* alinhamento como ATRIBUTO do bloco (não como marca de trecho): o alinhamento
   vale pro parágrafo/título inteiro, e é assim que ele sobrevive ao
   jsonParaHtml e ao gerador de PDF, que leem o doc bloco a bloco */
/* defaultAlignment "justify" porque é assim que o contrato renderiza em todo
   lugar (tela de revisão, página de assinatura, PDF). Com o padrão da extensão
   ("left"), um parágrafo em que ninguém tocou vinha marcado como alinhado à
   esquerda e a barra acendia o ícone errado sobre um texto justificado. */
import TextAlign from "https://esm.sh/@tiptap/extension-text-align@2.9.1";

/* rótulo amigável de cada data-campo, pro dropdown "Inserir campo" — a lista
   inteira que o texto do contrato pode referenciar (mesma de valorDoCampo em
   gerar-pdfmake.js e de preencherCampo em assinar.html/revisar-contrato.html) */
export const ROTULOS_CAMPO = {
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
  "data-assinatura": "Data (assinatura)"
};

const Campo = Node.create({
  name: "campo",
  group: "inline",
  inline: true,
  atom: true,
  addAttributes() {
    return { campo: { default: null } };
  },
  parseHTML() {
    return [{ tag: "span.campo[data-campo]", getAttrs: (el) => ({ campo: el.getAttribute("data-campo") }) }];
  },
  renderHTML({ node }) {
    const nome = node.attrs.campo;
    const rotulo = ROTULOS_CAMPO[nome] || nome;
    /* o rótulo aqui é só o que aparece ANTES de preencherCampo() rodar (na
       tela do Jordan/casal, [data-campo] é achado por seletor e o
       textContent é sobrescrito — o rótulo nunca sobrevive à renderização de
       verdade) */
    return ["span", mergeAttributes({ class: "campo", "data-campo": nome }), rotulo];
  }
});

const TabelaItens = Node.create({
  name: "tabelaItens",
  group: "block",
  atom: true,
  parseHTML() {
    return [{ tag: 'table[aria-label="Serviços contratados"]' }];
  },
  renderHTML() {
    return ["table", { "aria-label": "Serviços contratados" }, [
      "thead", {}, ["tr", {}, ["th", {}, "QTD"], ["th", {}, "DESCRIÇÃO DOS SERVIÇOS"], ["th", {}, "VALOR TOTAL"]]
    ], ["tbody", { id: "tabela-servicos" }]];
  },
  addNodeView() {
    return () => {
      const div = document.createElement("div");
      div.className = "placeholder-no-editor";
      div.textContent = "Tabela de itens (pacote + adicionais + valor total — preenchida na hora de gerar o contrato)";
      return { dom: div };
    };
  }
});

const BlocoAssinaturas = Node.create({
  name: "blocoAssinaturas",
  group: "block",
  atom: true,
  parseHTML() {
    return [{ tag: "div.assinaturas" }];
  },
  renderHTML() {
    return ["div", { class: "assinaturas", id: "bloco-assinaturas" }, [
      "p", {}, ["span", { class: "campo", "data-campo": "cidade-assinatura" }, "Cidade"], ", ",
      ["span", { class: "campo", "data-campo": "data-assinatura" }, "Data"], "."
    ], ["div", { id: "assinatura-jordan-area" }]];
  },
  addNodeView() {
    return () => {
      const div = document.createElement("div");
      div.className = "placeholder-no-editor";
      div.textContent = "Bloco de assinaturas (cidade/data + assinatura do casal + assinatura do Jordan)";
      return { dom: div };
    };
  }
});

/* Converte o content[] do doc do Tiptap pra HTML no MESMO formato que
   contrato-template.js sempre produziu — não dá pra usar editor.getHTML() puro
   porque ele geraria os nós próprios com a marcação de PLACEHOLDER do editor
   (addNodeView), não a estrutura final. */
function nosParaHtml(nos) {
  return (nos || []).map(noParaHtml).join("\n");
}
function inlineParaHtml(nos) {
  return (nos || []).map(function (n) {
    if (n.type === "text") {
      let t = escapeHtml(n.text || "");
      (n.marks || []).forEach(function (m) {
        if (m.type === "bold") t = "<strong>" + t + "</strong>";
        if (m.type === "italic") t = "<em>" + t + "</em>";
      });
      return t;
    }
    if (n.type === "campo") {
      return '<span class="campo" data-campo="' + escapeHtml(n.attrs.campo) + '"></span>';
    }
    if (n.type === "hardBreak") return "<br>";
    return "";
  }).join("");
}
/* Alinhamento vira classe, não style inline: as telas que renderizam o
   contrato (revisar-contrato.html, assinar.html) e o CSS de impressão
   controlam a aparência, e classe é o que elas sabem estilizar. "justify" é o
   padrão do documento, então não precisa de classe. */
function classeAlinhamento(no) {
  const a = (no.attrs || {}).textAlign;
  if (!a || a === "justify") return "";
  return ' class="al-' + a + '"';
}
function noParaHtml(no) {
  if (no.type === "paragraph") return "<p" + classeAlinhamento(no) + ">" + inlineParaHtml(no.content) + "</p>";
  if (no.type === "heading") {
    const nivel = (no.attrs || {}).level || 2;
    return "<h" + nivel + classeAlinhamento(no) + ">" + inlineParaHtml(no.content) + "</h" + nivel + ">";
  }
  if (no.type === "bulletList" || no.type === "orderedList") {
    const tag = no.type === "orderedList" ? "ol" : "ul";
    const itens = (no.content || []).map(function (li) {
      return "<li>" + nosParaHtml(li.content).replace(/^<p>|<\/p>$/g, "") + "</li>";
    }).join("");
    return "<" + tag + ">" + itens + "</" + tag + ">";
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
function escapeHtml(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
  });
}

/* HTML completo, na mesma "casca" que CONTRATO_TEMPLATE.html sempre teve
   (article > seções) — aqui simplificado a um wrapper único, já que o
   conteúdo em si (parágrafos/headings/listas/tabela/assinaturas) é o que
   paginarDocumento() (revisar-contrato.html/assinar.html) reagrupa em folhas
   de qualquer forma. */
export function jsonParaHtml(doc) {
  return '<section class="secao">' + nosParaHtml((doc && doc.content) || []) + "</section>";
}

/* Cria o editor num elemento, com toolbar já ligada. Devolve { editor,
   getJson, getHtml, inserirCampo, inserirTabela, inserirAssinaturas }. */
export function criarEditorContrato(elEditor, conteudoInicialJson) {
  const editor = new Editor({
    element: elEditor,
    extensions: [StarterKit, TextAlign.configure({ types: ["heading", "paragraph"], defaultAlignment: "justify" }), Campo, TabelaItens, BlocoAssinaturas],
    content: conteudoInicialJson || "<p></p>"
  });

  return {
    editor: editor,
    getJson: function () { return editor.getJSON(); },
    getHtml: function () { return jsonParaHtml(editor.getJSON()); },
    negrito: function () { editor.chain().focus().toggleBold().run(); },
    italico: function () { editor.chain().focus().toggleItalic().run(); },
    heading: function (nivel) { editor.chain().focus().toggleHeading({ level: nivel }).run(); },
    /* set (não toggle): o dropdown de estilo escolhe um valor, não alterna —
       "Texto normal" precisa SEMPRE virar parágrafo, e pedir H2 estando em H2
       não pode desfazer pra parágrafo sem querer */
    paragrafo: function () { editor.chain().focus().setParagraph().run(); },
    definirEstilo: function (estilo) {
      if (estilo === "p") { editor.chain().focus().setParagraph().run(); return; }
      var nivel = Number(String(estilo).replace("h", ""));
      editor.chain().focus().setNode("heading", { level: nivel }).run();
    },
    /* "p" | "h1" | "h2" | "h3" — pro dropdown mostrar onde o cursor está */
    estiloAtual: function () {
      for (var n = 1; n <= 3; n++) if (editor.isActive("heading", { level: n })) return "h" + n;
      return "p";
    },
    listaPontos: function () { editor.chain().focus().toggleBulletList().run(); },
    listaNumerada: function () { editor.chain().focus().toggleOrderedList().run(); },
    /* alinhamento do bloco. "justify" é o padrão do contrato, então é o que
       vale quando nenhum alinhamento foi escolhido */
    alinhamentoAtual: function () {
      const opcoes = ["left", "center", "right", "justify"];
      for (const a of opcoes) if (editor.isActive({ textAlign: a })) return a;
      return "justify";
    },
    definirAlinhamento: function (valor) { editor.chain().focus().setTextAlign(valor).run(); },
    /* pros ícones de negrito/itálico acenderem quando o formato já está
       aplicado onde o cursor está (igual ao Docs) */
    marcasAtivas: function () {
      return { negrito: editor.isActive("bold"), italico: editor.isActive("italic") };
    },
    /* "nenhuma" | "pontos" | "numerada" — pro dropdown de lista mostrar em que
       tipo o cursor está */
    listaAtual: function () {
      if (editor.isActive("bulletList")) return "pontos";
      if (editor.isActive("orderedList")) return "numerada";
      return "nenhuma";
    },
    /* escolhe o tipo em vez de alternar: pedir "numerada" estando em numerada
       não pode desligar a lista sem querer, e "nenhuma" sempre desliga */
    definirLista: function (tipo) {
      var ehPontos = editor.isActive("bulletList");
      var ehNumerada = editor.isActive("orderedList");
      if (tipo === "pontos") { if (!ehPontos) editor.chain().focus().toggleBulletList().run(); return; }
      if (tipo === "numerada") { if (!ehNumerada) editor.chain().focus().toggleOrderedList().run(); return; }
      if (ehPontos) editor.chain().focus().toggleBulletList().run();
      else if (ehNumerada) editor.chain().focus().toggleOrderedList().run();
    },
    inserirCampo: function (nome) { editor.chain().focus().insertContent({ type: "campo", attrs: { campo: nome } }).run(); },
    inserirTabela: function () { editor.chain().focus().insertContent({ type: "tabelaItens" }).run(); },
    inserirAssinaturas: function () { editor.chain().focus().insertContent({ type: "blocoAssinaturas" }).run(); },
    destroy: function () { editor.destroy(); }
  };
}

/* Converte o HTML fixo do contrato-template.js (via CONTRATO_TEMPLATE.html)
   pro doc do Tiptap, pra dar bootstrap no editor na primeira vez que alguém
   abre /configuracoes sem nenhum template salvo ainda. Reaproveita o próprio
   parseHTML dos nós (Campo/TabelaItens/BlocoAssinaturas) + StarterKit: cria
   um editor "descartável" só pra fazer o parse e devolve o JSON. */
export function htmlParaJson(html) {
  const div = document.createElement("div");
  div.style.display = "none";
  document.body.appendChild(div);
  const temporario = new Editor({
    element: div,
    extensions: [StarterKit, TextAlign.configure({ types: ["heading", "paragraph"], defaultAlignment: "justify" }), Campo, TabelaItens, BlocoAssinaturas],
    content: html
  });
  const json = temporario.getJSON();
  temporario.destroy();
  div.remove();
  return json;
}

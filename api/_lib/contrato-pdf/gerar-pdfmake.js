/*
  Monta o PDF do contrato quando o template do TEXTO é o editável do Jordan
  (contrato_templates, editor Tiptap em /configuracoes) em vez do
  contrato-template.js hardcoded.

  gerar.js escreve valores num PDF vetorial pré-paginado (template.pdf/coords.json,
  gerados offline a partir do contrato-template.js fixo). Aqui não existe PDF
  pré-paginado nenhum — o texto muda a qualquer momento — então o documento é
  montado do zero, direto do doc do Tiptap (conteudo_json), via pdfmake.

  Contrato com template_id usa este módulo; contrato sem template_id (o texto
  fixo de sempre) continua em gerar.js, intocado.
*/
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import PdfPrinter from "pdfmake";
import {
  ehPacote, moeda, cpfFormatado, cepFormatado, dataExtenso, dataEventoExtenso
} from "./gerar.js";

const AQUI = dirname(fileURLToPath(import.meta.url));

const FONTES = {
  Roboto: {
    normal: join(AQUI, "fonts", "Roboto-Regular.ttf"),
    bold: join(AQUI, "fonts", "Roboto-Medium.ttf"),
    italics: join(AQUI, "fonts", "Roboto-Italic.ttf"),
    bolditalics: join(AQUI, "fonts", "Roboto-MediumItalic.ttf")
  }
};

const TINTA = "#1D1D1B";
const LINHA = "#C9C4BD";
const FUNDO_TH = "#F6F3F0";

/* Todo campo que o texto do contrato pode referenciar (nó "campo" do editor),
   igual à lista de lacunas de gerar.js — mas aqui devolve string direto pro
   pdfmake, sem coordenada nenhuma envolvida. Sem valor: "—" (convenção de
   dado ausente, exceção do tom de voz — não é prosa). */
function valorDoCampo(nome, dados, extra) {
  const soNoiva = !dados.noivo && !!dados.noiva;
  switch (nome) {
    case "noivo": return dados.noivo || "";
    case "cpf-noivo": return dados.cpf_noivo ? cpfFormatado(dados.cpf_noivo) : "";
    case "noiva": return dados.noiva || "";
    case "cpf-noiva": return dados.cpf_noiva ? cpfFormatado(dados.cpf_noiva) : "";
    case "endereco": return dados.endereco || "—";
    case "numero": return dados.numero || "—";
    case "bairro": return dados.bairro || "—";
    case "cidade": return dados.cidade || "—";
    case "complemento": return dados.complemento || "N/A";
    case "estado": return dados.estado || "—";
    case "cep": return dados.cep ? cepFormatado(dados.cep) : "—";
    case "tel-noivo": return soNoiva ? "" : (dados.tel_noivo || "");
    case "tel-noiva": return soNoiva ? (dados.tel_noiva || dados.tel_noivo || "") : (dados.tel_noiva || "");
    case "data-formatada": return dataEventoExtenso(dados.data_evento) || "—";
    case "local": return dados.local_evento || "—";
    case "horario": return dados.horario ? String(dados.horario).slice(0, 5) : "—";
    case "valor-total": return moeda(valorTotal(dados));
    case "valor-entrada": return moeda(valorEntrada(dados));
    case "cidade-assinatura": return dados.cidade || "—";
    case "data-assinatura": return dataExtenso(extra.assinadoEm) + ".";
    default: return "—";
  }
}

function valorTotal(dados) { return Number(dados.total) || 0; }
function valorEntrada(dados) {
  const total = valorTotal(dados);
  return (dados.entrada != null && dados.entrada !== "") ? Number(dados.entrada) : total * 0.3;
}

/* marks do Tiptap (bold/italic) → run inline do pdfmake */
function inlineDe(node, dados, extra) {
  if (node.type === "text") {
    const run = { text: node.text || "" };
    (node.marks || []).forEach(function (m) {
      if (m.type === "bold") run.bold = true;
      if (m.type === "italic") run.italics = true;
    });
    return run;
  }
  if (node.type === "campo") {
    return { text: valorDoCampo((node.attrs || {}).campo, dados, extra) };
  }
  if (node.type === "hardBreak") return { text: "\n" };
  return { text: "" };
}

function tabelaItens(dados) {
  const itens = Array.isArray(dados.itens) ? dados.itens : [];
  const pacote = itens.find(ehPacote);
  const adicionais = itens.filter(function (i) { return !ehPacote(i); });
  const linhas = [
    { desc: pacote ? (pacote.nome || pacote.id) : "Serviços fotográficos contratados" }
  ].concat(adicionais.map(function (a) { return { desc: a.nome || a.id }; }));

  const cab = function (t) { return { text: t, bold: true, fontSize: 8.5, fillColor: FUNDO_TH }; };
  const body = [
    [cab("QTD"), cab("DESCRIÇÃO DOS SERVIÇOS"), cab("VALOR TOTAL")]
  ].concat(linhas.map(function (l) {
    return [
      { text: "1" }, { text: l.desc }, { text: "" }
    ];
  })).concat([
    [{ text: "" }, { text: "VALOR TOTAL", bold: true }, { text: moeda(valorTotal(dados)), bold: true }]
  ]);

  return {
    table: { widths: ["auto", "*", "auto"], body: body },
    layout: {
      hLineColor: function () { return LINHA; },
      vLineColor: function () { return LINHA; },
      hLineWidth: function () { return 0.75; },
      vLineWidth: function () { return 0.75; }
    },
    margin: [0, 4, 0, 10]
  };
}

function blocoAssinaturas(dados, extra, assinaturaCasalDataUrl, assinaturaJordanDataUrl) {
  const conteudo = [
    { text: valorDoCampo("cidade-assinatura", dados, extra) + ", " + valorDoCampo("data-assinatura", dados, extra), margin: [0, 10, 0, 14] },
    { text: extra.signatario.nome + (extra.signatario.cpf ? " – CPF " + cpfFormatado(extra.signatario.cpf) : "") + " – CONTRATANTE", margin: [0, 0, 0, 4] }
  ];
  if (assinaturaCasalDataUrl) {
    conteudo.push({ image: assinaturaCasalDataUrl, width: 160, margin: [0, 2, 0, 8] });
  }
  conteudo.push({ text: "Jordan Santos – CONTRATADA", margin: [0, 8, 0, 4] });
  if (assinaturaJordanDataUrl) {
    conteudo.push({ image: assinaturaJordanDataUrl, width: 160, margin: [0, 2, 0, 8] });
  }
  return conteudo;
}

/* converte content[] do Tiptap (doc.content) pra content[] do pdfmake, nó a
   nó — a mesma estrutura que configuracoes-editor.js sabe montar */
function converterNos(nos, dados, extra, assinaturas) {
  const saida = [];
  (nos || []).forEach(function (no) {
    saida.push.apply(saida, converterNo(no, dados, extra, assinaturas));
  });
  return saida;
}

/* Alinhamento escolhido no editor do modelo (atributo textAlign do nó, posto
   pela extensão TextAlign em configuracoes-editor.js). O padrão do contrato é
   justificado, então é o que vale quando o nó não traz nada — sem isso, um
   parágrafo alinhado na tela sairia diferente no PDF assinado. */
function alinhamentoDo(no) {
  const a = (no.attrs || {}).textAlign;
  return a === "left" || a === "center" || a === "right" ? a : "justify";
}

function converterNo(no, dados, extra, assinaturas) {
  if (!no || !no.type) return [];

  if (no.type === "paragraph") {
    const runs = converterInline(no.content, dados, extra);
    return [{ text: runs.length ? runs : "", alignment: alinhamentoDo(no), margin: [0, 0, 0, 8] }];
  }
  if (no.type === "heading") {
    const nivel = (no.attrs || {}).level || 2;
    const runs = converterInline(no.content, dados, extra);
    return [{ text: runs, bold: true, fontSize: nivel <= 2 ? 13 : 11, alignment: alinhamentoDo(no), margin: [0, 12, 0, 6] }];
  }
  if (no.type === "bulletList" || no.type === "orderedList") {
    const itens = (no.content || []).map(function (li) {
      return converterNos(li.content, dados, extra, assinaturas);
    });
    const chave = no.type === "orderedList" ? "ol" : "ul";
    return [{ [chave]: itens, margin: [0, 0, 0, 8] }];
  }
  if (no.type === "tabelaItens") {
    return [tabelaItens(dados)];
  }
  if (no.type === "blocoAssinaturas") {
    return blocoAssinaturas(dados, extra, assinaturas.casal, assinaturas.jordan);
  }
  /* nó desconhecido: ignora em vez de quebrar a geração do PDF inteiro */
  return [];
}

function converterInline(nos, dados, extra) {
  return (nos || []).map(function (n) { return inlineDe(n, dados, extra); });
}

/* mesma página de auditoria final de gerar.js, sem IP (fica só na tabela
   contratos) */
function paginaAuditoria(extra) {
  const linhas = [["Signatário:", extra.signatario.nome]];
  if (extra.signatario.cpf) linhas.push(["CPF:", cpfFormatado(extra.signatario.cpf)]);
  if (extra.signatario.email) linhas.push(["E-mail:", extra.signatario.email]);
  const quando = extra.assinadoEm.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
  linhas.push(["Data e hora:", quando + " (horário de Brasília)"]);
  linhas.push(["Verificação:", "acesso por link eletrônico exclusivo, entregue ao contratante"]);
  linhas.push(["Aceite:", "os termos foram lidos e aceitos, com reconhecimento da validade da"]);
  linhas.push(["", "assinatura eletrônica (MP 2.200-2/2001, art. 10, §2º)"]);

  return {
    pageBreak: "before",
    stack: linhas.map(function (par) {
      return {
        columns: [
          { text: par[0], bold: true, width: 90 },
          { text: par[1] }
        ],
        margin: [0, 0, 0, 6]
      };
    })
  };
}

export async function gerarContratoPdfDinamico({
  templateJson,
  snapshot,
  assinaturaCasalDataUrl,
  assinaturaJordanDataUrl,
  signatario,
  assinadoEm
}) {
  const dados = snapshot || {};
  const extra = { signatario: signatario, assinadoEm: assinadoEm };
  const doc = templateJson && templateJson.type === "doc" ? templateJson : { content: [] };

  const corpo = converterNos(doc.content, dados, extra, {
    casal: assinaturaCasalDataUrl || null, jordan: assinaturaJordanDataUrl || null
  });

  const printer = new PdfPrinter(FONTES);
  const docDefinition = {
    pageSize: "A4",
    pageMargins: [56, 56, 56, 56],
    defaultStyle: { font: "Roboto", fontSize: 10, color: TINTA },
    content: corpo.concat([paginaAuditoria(extra)])
  };

  const pdfDoc = printer.createPdfKitDocument(docDefinition);
  const chunks = [];
  return new Promise(function (resolve, reject) {
    pdfDoc.on("data", function (c) { chunks.push(c); });
    pdfDoc.on("end", function () { resolve(Buffer.concat(chunks)); });
    pdfDoc.on("error", reject);
    pdfDoc.end();
  });
}

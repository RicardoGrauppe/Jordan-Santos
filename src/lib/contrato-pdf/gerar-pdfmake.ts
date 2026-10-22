/*
  Monta o PDF do contrato quando o template do TEXTO é o editável do Jordan
  (contrato_templates, editor Tiptap em /painel/configuracoes/contrato) em vez
  do contrato-template.ts hardcoded.

  gerar.ts escreve valores num PDF vetorial pré-paginado (template.pdf/coords.json,
  gerados offline a partir do contrato-template.ts fixo). Aqui não existe PDF
  pré-paginado nenhum — o texto muda a qualquer momento — então o documento é
  montado do zero, direto do doc do Tiptap (conteudo_json), via pdfmake.

  Contrato com template_id usa este módulo; contrato sem template_id (o texto
  fixo de sempre) continua em gerar.ts, intocado.

  Veio do estúdio do Jordan em JavaScript e foi passado pra TypeScript em
  16/09/2026, comportamento idêntico — ver o cabeçalho de gerar.ts.
*/
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import PdfPrinter from "pdfmake";
import type { Content, ContentText, TDocumentDefinitions, TFontDictionary } from "pdfmake/interfaces";
import {
  ehPacote, moeda, cpfFormatado, cepFormatado, dataExtenso, dataEventoExtenso,
  type ItemContrato, type SnapshotContrato, type Signatario,
} from "./gerar";

const AQUI = dirname(fileURLToPath(import.meta.url));

const FONTES: TFontDictionary = {
  Roboto: {
    normal: join(AQUI, "fonts", "Roboto-Regular.ttf"),
    bold: join(AQUI, "fonts", "Roboto-Medium.ttf"),
    italics: join(AQUI, "fonts", "Roboto-Italic.ttf"),
    bolditalics: join(AQUI, "fonts", "Roboto-MediumItalic.ttf"),
  },
};

const TINTA = "#1D1D1B";
const LINHA = "#C9C4BD";
const FUNDO_TH = "#F6F3F0";

/* O que o resto do módulo precisa saber do documento do Tiptap. É de
   propósito frouxo: o JSON vem do banco, escrito por uma versão do editor que
   pode ser mais nova que este código, e `converterNo` já ignora nó que não
   conhece em vez de derrubar a geração. */
type NoTiptap = {
  type?: string;
  text?: string;
  attrs?: Record<string, unknown> | null;
  marks?: { type?: string }[] | null;
  content?: NoTiptap[] | null;
};

/** o que não vem do snapshot: quem assinou e quando */
type Extra = { signatario: Signatario; assinadoEm: Date };
/** as duas assinaturas já em data URL, prontas pra virar `image` do pdfmake */
type Assinaturas = { casal: string | null; jordan: string | null };

/* Todo campo que o texto do contrato pode referenciar (nó "campo" do editor),
   igual à lista de lacunas de gerar.ts — mas aqui devolve string direto pro
   pdfmake, sem coordenada nenhuma envolvida. Sem valor: "—" (convenção de
   dado ausente, exceção do tom de voz — não é prosa). */
function valorDoCampo(nome: string, dados: SnapshotContrato, extra: Extra): string {
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

function valorTotal(dados: SnapshotContrato): number { return Number(dados.total) || 0; }
function valorEntrada(dados: SnapshotContrato): number {
  const total = valorTotal(dados);
  return (dados.entrada != null && (dados.entrada as unknown) !== "") ? Number(dados.entrada) : total * 0.3;
}

/* marks do Tiptap (bold/italic) → run inline do pdfmake */
function inlineDe(node: NoTiptap, dados: SnapshotContrato, extra: Extra): ContentText {
  if (node.type === "text") {
    const run: ContentText = { text: node.text || "" };
    (node.marks || []).forEach(function (m) {
      if (m.type === "bold") run.bold = true;
      if (m.type === "italic") run.italics = true;
    });
    return run;
  }
  if (node.type === "campo") {
    return { text: valorDoCampo(String((node.attrs || {}).campo ?? ""), dados, extra) };
  }
  if (node.type === "hardBreak") return { text: "\n" };
  return { text: "" };
}

type LinhaManual = { qtd?: unknown; descricao?: unknown; valor?: unknown };

/* `manuais`: linhas que o fotógrafo digitou no editor do contrato do cliente
   (attrs.linhas do nó). Sem elas, a tabela sai do pacote e dos adicionais. */
function tabelaItens(dados: SnapshotContrato, manuais?: LinhaManual[] | null): Content {
  const itens: ItemContrato[] = Array.isArray(dados.itens) ? dados.itens : [];
  const pacote = itens.find(ehPacote);
  const adicionais = itens.filter(function (i) { return !ehPacote(i); });
  const linhas: { qtd: string; desc: string; valor: string }[] = manuais
    ? manuais.map(function (l) {
        const v = l.valor == null || l.valor === "" ? null : Number(l.valor);
        return { qtd: String(l.qtd ?? ""), desc: String(l.descricao ?? ""), valor: v != null && isFinite(v) ? moeda(v) : "" };
      })
    : [{ qtd: "1", desc: pacote ? (pacote.nome || pacote.id || "") : "Serviços fotográficos contratados", valor: "" }]
      .concat(adicionais.map(function (a) { return { qtd: "1", desc: a.nome || a.id || "", valor: "" }; }));

  const cab = function (t: string): ContentText {
    return { text: t, bold: true, fontSize: 8.5, fillColor: FUNDO_TH };
  };
  const body: ContentText[][] = ([
    [cab("QTD"), cab("DESCRIÇÃO DOS SERVIÇOS"), cab("VALOR TOTAL")],
  ] as ContentText[][]).concat(linhas.map(function (l): ContentText[] {
    return [
      { text: l.qtd }, { text: l.desc }, { text: l.valor },
    ];
  })).concat([
    [{ text: "" }, { text: "VALOR TOTAL", bold: true }, { text: moeda(valorTotal(dados)), bold: true }],
  ]);

  return {
    table: { widths: ["auto", "*", "auto"], body: body },
    layout: {
      hLineColor: function () { return LINHA; },
      vLineColor: function () { return LINHA; },
      hLineWidth: function () { return 0.75; },
      vLineWidth: function () { return 0.75; },
    },
    margin: [0, 4, 0, 10],
  };
}

function blocoAssinaturas(
  dados: SnapshotContrato, extra: Extra,
  assinaturaCasalDataUrl: string | null, assinaturaJordanDataUrl: string | null,
): Content[] {
  const conteudo: Content[] = [
    { text: valorDoCampo("cidade-assinatura", dados, extra) + ", " + valorDoCampo("data-assinatura", dados, extra), margin: [0, 10, 0, 14] },
    /* PDF que vai pra Autentique sai sem signatário (ninguém assinou ainda):
       o nome é o do casal, senão a linha ficava só " – CONTRATANTE" */
    { text: (extra.signatario.nome || [dados.noivo, dados.noiva].filter(Boolean).join(" e ") || "Contratante") +
        (extra.signatario.cpf ? " – CPF " + cpfFormatado(extra.signatario.cpf) : "") + " – CONTRATANTE", margin: [0, 0, 0, 4] },
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
   nó — a mesma estrutura que o editor do modelo sabe montar */
function converterNos(
  nos: NoTiptap[] | null | undefined, dados: SnapshotContrato, extra: Extra, assinaturas: Assinaturas,
): Content[] {
  const saida: Content[] = [];
  (nos || []).forEach(function (no) {
    saida.push(...converterNo(no, dados, extra, assinaturas));
  });
  return saida;
}

/* Alinhamento escolhido no editor do modelo (atributo textAlign do nó, posto
   pela extensão TextAlign do Tiptap). O padrão do contrato é justificado,
   então é o que vale quando o nó não traz nada — sem isso, um parágrafo
   alinhado na tela sairia diferente no PDF assinado. */
function alinhamentoDo(no: NoTiptap): "left" | "center" | "right" | "justify" {
  const a = (no.attrs || {}).textAlign;
  return a === "left" || a === "center" || a === "right" ? a : "justify";
}

function converterNo(
  no: NoTiptap, dados: SnapshotContrato, extra: Extra, assinaturas: Assinaturas,
): Content[] {
  if (!no || !no.type) return [];

  if (no.type === "paragraph") {
    const runs = converterInline(no.content, dados, extra);
    return [{ text: runs.length ? runs : "", alignment: alinhamentoDo(no), margin: [0, 0, 0, 8] }];
  }
  if (no.type === "heading") {
    const nivel = Number((no.attrs || {}).level) || 2;
    const runs = converterInline(no.content, dados, extra);
    return [{ text: runs, bold: true, fontSize: nivel <= 2 ? 13 : 11, alignment: alinhamentoDo(no), margin: [0, 12, 0, 6] }];
  }
  if (no.type === "bulletList" || no.type === "orderedList") {
    const itens = (no.content || []).map(function (li) {
      return converterNos(li.content, dados, extra, assinaturas);
    });
    return no.type === "orderedList"
      ? [{ ol: itens, margin: [0, 0, 0, 8] }]
      : [{ ul: itens, margin: [0, 0, 0, 8] }];
  }
  if (no.type === "tabelaItens") {
    const manuais = (no.attrs || {}).linhas;
    return [tabelaItens(dados, Array.isArray(manuais) ? (manuais as LinhaManual[]) : null)];
  }
  if (no.type === "blocoAssinaturas") {
    return blocoAssinaturas(dados, extra, assinaturas.casal, assinaturas.jordan);
  }
  /* nó desconhecido: ignora em vez de quebrar a geração do PDF inteiro */
  return [];
}

function converterInline(
  nos: NoTiptap[] | null | undefined, dados: SnapshotContrato, extra: Extra,
): ContentText[] {
  return (nos || []).map(function (n) { return inlineDe(n, dados, extra); });
}

/* mesma página de auditoria final de gerar.ts, sem IP (fica só na tabela
   contratos) */
function paginaAuditoria(extra: Extra): Content {
  const linhas: [string, string][] = [["Signatário:", extra.signatario.nome]];
  if (extra.signatario.cpf) linhas.push(["CPF:", cpfFormatado(extra.signatario.cpf)]);
  if (extra.signatario.email) linhas.push(["E-mail:", extra.signatario.email]);
  const quando = extra.assinadoEm.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
  linhas.push(["Data e hora:", quando + " (horário de Brasília)"]);
  linhas.push(["Verificação:", "acesso por link eletrônico exclusivo, entregue ao contratante"]);
  linhas.push(["Aceite:", "os termos foram lidos e aceitos, com reconhecimento da validade da"]);
  linhas.push(["", "assinatura eletrônica (MP 2.200-2/2001, art. 10, §2º)"]);

  return {
    pageBreak: "before",
    stack: linhas.map(function (par): Content {
      return {
        columns: [
          { text: par[0], bold: true, width: 90 },
          { text: par[1] },
        ],
        margin: [0, 0, 0, 6],
      };
    }),
  };
}

export async function gerarContratoPdfDinamico({
  templateJson,
  snapshot,
  assinaturaCasalDataUrl,
  assinaturaJordanDataUrl,
  signatario,
  assinadoEm,
  semComprovante,
}: {
  templateJson: unknown;
  snapshot: SnapshotContrato;
  assinaturaCasalDataUrl?: string | null;
  assinaturaJordanDataUrl?: string | null;
  signatario: Signatario;
  assinadoEm: Date;
  /** PDF que vai PRA Autentique assinar: a folha de comprovante é dela, não
   *  nossa, e sair uma em branco no meio do caminho só confunde. */
  semComprovante?: boolean;
}): Promise<Buffer> {
  const dados: SnapshotContrato = snapshot || {};
  const extra: Extra = { signatario: signatario, assinadoEm: assinadoEm };
  const entrada = templateJson as NoTiptap | null | undefined;
  const doc: NoTiptap = entrada && entrada.type === "doc" ? entrada : { content: [] };

  const corpo = converterNos(doc.content, dados, extra, {
    casal: assinaturaCasalDataUrl || null, jordan: assinaturaJordanDataUrl || null,
  });

  const printer = new PdfPrinter(FONTES);
  const docDefinition: TDocumentDefinitions = {
    pageSize: "A4",
    pageMargins: [56, 56, 56, 56],
    defaultStyle: { font: "Roboto", fontSize: 10, color: TINTA },
    content: semComprovante ? corpo : corpo.concat([paginaAuditoria(extra)]),
  };

  const pdfDoc = printer.createPdfKitDocument(docDefinition);
  const chunks: Buffer[] = [];
  return new Promise<Buffer>(function (resolve, reject) {
    pdfDoc.on("data", function (c: Buffer) { chunks.push(c); });
    pdfDoc.on("end", function () { resolve(Buffer.concat(chunks)); });
    pdfDoc.on("error", reject);
    pdfDoc.end();
  });
}

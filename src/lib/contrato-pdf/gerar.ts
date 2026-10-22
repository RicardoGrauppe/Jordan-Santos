/*
  Monta o PDF do contrato assinado — roda no SERVIDOR, na hora da assinatura.

  Antes (até 2026-07-31) o PDF era um screenshot: o assinar.html fotografava a
  tela do celular do casal com html2pdf/html2canvas e mandava 2,9 MB de imagem
  pro backend. Saía pesado, sem texto selecionável, e a quebra de página era
  por pixel (linha cortada ao meio). Agora:

    1. tools/contrato-template/ gera, OFFLINE, um PDF vetorial já paginado a
       partir do contrato-template.ts, com os campos variáveis em branco;
    2. este módulo abre esse template e escreve os valores nas lacunas.

  Resultado: ~240 KB, texto de verdade (selecionável e pesquisável) e sempre
  idêntico, independente do aparelho de quem assina.

  O template.pdf / coords.json desta pasta são GERADOS — não edite à mão.
  Mexeu numa cláusula do contrato-template.ts? Regere (veja
  tools/contrato-template/README.md), senão o PDF sai com o texto antigo.

  Template ÚNICO desde 2026-08-08. Existiam três (P/M/G) porque a tabela de
  serviços crescia uma linha por item e empurrava a paginação. Hoje a tabela
  lista o pacote e os adicionais (sem valor unitário — só o total), mas mora
  numa caixa de altura FIXA e se encaixa nela: um contrato de 1 item sai
  folgado, um de 10 sai apertado, e os dois ocupam o mesmo espaço na folha.

  Veio do estúdio do Jordan em JavaScript e foi passado pra TypeScript em
  16/09/2026 — o comportamento é o mesmo, linha por linha; o que mudou é que
  agora o `tsc` enxerga o miolo, que antes ficava fora do typecheck atrás de um
  `gerar.d.ts` escrito à mão.
*/
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage, type PDFPage } from "pdf-lib";

export type ItemContrato = { id?: string; nome?: string } & Record<string, unknown>;

export type SnapshotContrato = {
  noivo?: string | null; noiva?: string | null;
  cpf_noivo?: string | null; cpf_noiva?: string | null;
  tel_noivo?: string | null; tel_noiva?: string | null;
  endereco?: string | null; numero?: string | null; bairro?: string | null;
  cidade?: string | null; complemento?: string | null; estado?: string | null; cep?: string | null;
  data_evento?: string | null; local_evento?: string | null; horario?: string | null;
  itens?: ItemContrato[]; total?: number | null; entrada?: number | null;
} & Record<string, unknown>;

export type Signatario = { nome: string; cpf?: string | null; email?: string | null };

/* Formato do coords.json GERADO pela ferramenta. Medidas em px de CSS; quem
   converte pra ponto é este módulo. */
type CampoCoord = {
  campo: string; pagina: number;
  x: number; y: number; w: number; h: number;
  fontePx: number; centrado: boolean;
};
type CaixaCoord = { box: string; pagina: number; x: number; y: number; w: number; h: number };
type Coords = {
  larguraPaginaPx: number; alturaPaginaPx: number;
  margemTopoMm?: number; margemEsquerdaMm?: number;
  campos: CampoCoord[]; boxes: CaixaCoord[];
};

/* relativo a ESTE módulo, nunca ao cwd: o diretório de trabalho difere entre
   o dev-server local e a lambda da Vercel */
const AQUI = dirname(fileURLToPath(import.meta.url));

/* Quais itens são PACOTE (o resto é adicional). O catalogo.ts é a fonte única
   dos produtos, mas ele é browser-only e esta function roda no servidor — daí
   a lista aqui. Pacote novo no catálogo? Acrescente o id.
   O fallback pelo nome cobre o esquecimento sem quebrar o contrato. */
export const PACOTES: Set<string> = new Set(["eternal", "heritage"]);
export function ehPacote(item: ItemContrato): boolean {
  return PACOTES.has(String(item.id)) || /^pacote\b/i.test(String(item.nome || ""));
}

const TINTA = rgb(0.114, 0.114, 0.106);      /* --ink  #1D1D1B */
const LINHA = rgb(0.788, 0.769, 0.741);      /* grade da tabela #C9C4BD */
const FUNDO_TH = rgb(0.965, 0.953, 0.941);   /* cabeçalho da tabela #F6F3F0 */

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function moeda(v: number | null | undefined): string {
  /* o Intl separa "R$" do número com espaço fino (U+00A0); troca por espaço
     normal só pra não depender de encoding exótico na fonte do PDF */
  return brl.format(Number(v) || 0).replace(/ /g, " ");
}
export function cpfFormatado(v: string | null | undefined): string {
  const d = String(v || "").replace(/\D/g, "");
  return d.length === 11 ? d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4") : String(v || "");
}
export function cepFormatado(v: string | null | undefined): string {
  const d = String(v || "").replace(/\D/g, "");
  return d.length === 8 ? d.replace(/(\d{5})(\d{3})/, "$1-$2") : String(v || "");
}
export function dataExtenso(d: Date): string {
  return d.getDate() + " de " + MESES[d.getMonth()] + " de " + d.getFullYear();
}
export function dataEventoExtenso(iso: string | null | undefined): string {
  if (!iso) return "";
  const [a, m, dia] = String(iso).split("-").map(Number);
  return dia + " de " + MESES[m - 1] + " de " + a;
}

/* As fontes padrão do PDF usam WinAnsi, que cobre o português inteiro mas não
   emoji nem alfabetos fora do latim-1. O pdf-lib LANÇA ERRO ao topar com um
   caractere que não consegue codificar — e o nome/local vêm do casal, texto
   livre. Sem esta limpeza, um emoji no nome derrubaria a assinatura. */
function paraWinAnsi(texto: unknown): string {
  return String(texto == null ? "" : texto)
    .normalize("NFC")
    .replace(/[‘’‛]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–]/g, "-")
    .replace(/[—]/g, "—")   /* travessão existe no WinAnsi */
    .replace(/ /g, " ")
    /* o que sobrar fora do latim-1 imprimível vira "?" em vez de estourar */
    .replace(/[^\x20-\x7E -ÿ€—…]/g, "?");
}

function bytesDeDataUrl(dataUrl: string | null | undefined): Buffer {
  const base64 = String(dataUrl || "").split(",")[1];
  if (!base64) throw new Error("assinatura sem conteúdo");
  return Buffer.from(base64, "base64");
}

export async function gerarContratoPdf({
  snapshot,
  assinaturaCasalDataUrl,
  assinaturaJordanDataUrl,
  signatario,
  assinadoEm,
  semComprovante,
}: {
  snapshot: SnapshotContrato;
  assinaturaCasalDataUrl?: string | null;
  assinaturaJordanDataUrl?: string | null;
  signatario: Signatario;
  assinadoEm: Date;
  /** PDF que vai PRA Autentique assinar: tira a última folha, que é o nosso
   *  comprovante de assinatura eletrônica. Quem comprova ali passa a ser ela. */
  semComprovante?: boolean;
}): Promise<Uint8Array> {
  const dados: SnapshotContrato = snapshot || {};
  const itens: ItemContrato[] = Array.isArray(dados.itens) ? dados.itens : [];

  /* um template só: a tabela tem altura fixa (pacote + total), então a
     paginação não depende mais da quantidade de itens */
  const coords = JSON.parse(readFileSync(join(AQUI, "coords.json"), "utf8")) as Coords;
  const doc = await PDFDocument.load(readFileSync(join(AQUI, "template.pdf")));

  const pages = doc.getPages();
  const { height: pageH } = pages[0].getSize();
  /* o mapa foi medido em px de CSS; o PDF trabalha em pontos */
  const sx = pages[0].getSize().width / coords.larguraPaginaPx;
  const sy = pageH / coords.alturaPaginaPx;
  /* as coordenadas do mapa são relativas à ÁREA DE CONTEÚDO da página (não à
     borda da folha): é o que evita acumular erro de arredondamento página a
     página. Aqui somamos de volta a margem pra chegar na folha. */
  const mm = 72 / 25.4;
  const margemX = (coords.margemEsquerdaMm || 0) * mm;
  const margemTopo = (coords.margemTopoMm || 0) * mm;

  const helv = await doc.embedFont(StandardFonts.Helvetica);
  const helvBold = await doc.embedFont(StandardFonts.HelveticaBold);

  /* ---------- primitivas ---------- */
  function campoDe(nome: string): CampoCoord {
    const c = coords.campos.find((x) => x.campo === nome);
    if (!c) throw new Error("campo sem coordenada no template: " + nome);
    return c;
  }

  /* `opcional` deixa a lacuna em branco em vez de escrever "—". É o caso da
     segunda pessoa quando o contrato tem um contratante só (2026-08-08): a
     linha NOIVA/TELEFONE NOIVA existe no template impresso, e um travessão
     ali pareceria dado faltando em vez de campo que não se aplica. */
  function escreverCampo(nome: string, texto: unknown, opcional?: boolean): void {
    const c = campoDe(nome);
    if (opcional && !texto) return;
    const valor = paraWinAnsi(texto === 0 ? "0" : (texto || "—"));
    let size = c.fontePx * 0.92 * 0.75;
    const maxW = (c.w - 6) * sx;
    while (size > 6 && helv.widthOfTextAtSize(valor, size) > maxW) size -= 0.25;
    const larguraTexto = helv.widthOfTextAtSize(valor, size);
    const x = margemX + (c.centrado ? (c.x + c.w / 2) * sx - larguraTexto / 2 : (c.x + 3) * sx);
    pages[c.pagina].drawText(valor, {
      x,
      y: pageH - margemTopo - (c.y + c.h) * sy + 2.5,   /* um tico acima do sublinhado */
      size, font: helv, color: TINTA,
    });
  }

  type Caixa = { page: PDFPage; x: number; largura: number; topo: number; altura: number };
  function caixaDe(nome: string): Caixa {
    const b = coords.boxes.find((x) => x.box === nome);
    if (!b) throw new Error("caixa sem coordenada no template: " + nome);
    return {
      page: pages[b.pagina],
      x: margemX + b.x * sx, largura: b.w * sx,
      topo: pageH - margemTopo - b.y * sy, altura: b.h * sy,
    };
  }

  function quebrarEmLinhas(texto: unknown, fonte: PDFFont, size: number, maxW: number): string[] {
    const linhas: string[] = [];
    let atual = "";
    for (const palavra of paraWinAnsi(texto).split(" ")) {
      const tentativa = atual ? atual + " " + palavra : palavra;
      if (fonte.widthOfTextAtSize(tentativa, size) <= maxW) atual = tentativa;
      else { if (atual) linhas.push(atual); atual = palavra; }
    }
    if (atual) linhas.push(atual);
    return linhas.length ? linhas : [""];
  }

  function carimbarAssinatura(nomeCaixa: string, dataUrl: string | null | undefined): void {
    if (!dataUrl) return;              /* sem assinatura, fica só a linha */
    const b = caixaDe(nomeCaixa);
    const png = pngsEmbutidos[nomeCaixa];
    const escala = Math.min((b.largura * 0.75) / png.width, (b.altura - 8) / png.height);
    const w = png.width * escala, h = png.height * escala;
    b.page.drawImage(png, {
      x: b.x + (b.largura - w) / 2,
      y: b.topo - b.altura + 2,
      width: w, height: h,
    });
  }

  /* as duas assinaturas já chegam como PNG (o canvas do /assinar pro casal, o
     dataurl guardado no banco pro Jordan) — o servidor só carimba imagem, por
     isso não precisa de fontkit nem de fonte cursiva aqui */
  const pngsEmbutidos: Record<string, PDFImage> = {};
  if (assinaturaCasalDataUrl) {
    pngsEmbutidos["assinatura-casal"] = await doc.embedPng(bytesDeDataUrl(assinaturaCasalDataUrl));
  }
  if (assinaturaJordanDataUrl) {
    pngsEmbutidos["assinatura-jordan"] = await doc.embedPng(bytesDeDataUrl(assinaturaJordanDataUrl));
  }

  /* ---------- lacunas ---------- */
  const total = Number(dados.total) || 0;
  const entrada = (dados.entrada != null && (dados.entrada as unknown) !== "")
    ? Number(dados.entrada) : total * 0.3;

  /* contratantes: os dois lados são opcionais (basta um), então a lacuna de
     quem não existe fica vazia em vez de levar um travessão */
  escreverCampo("noivo", dados.noivo, true);
  escreverCampo("cpf-noivo", cpfFormatado(dados.cpf_noivo), true);
  escreverCampo("noiva", dados.noiva, true);
  escreverCampo("cpf-noiva", cpfFormatado(dados.cpf_noiva), true);
  escreverCampo("endereco", dados.endereco);
  escreverCampo("numero", dados.numero);
  escreverCampo("bairro", dados.bairro);
  escreverCampo("cidade", dados.cidade);
  escreverCampo("complemento", dados.complemento || "N/A");
  escreverCampo("estado", dados.estado);
  escreverCampo("cep", cepFormatado(dados.cep));
  /* o /cadastro coleta UM telefone só e ele sempre cai em tel_noivo. Num
     contrato só da noiva isso imprimiria o número dela na linha do noivo e um
     traço na dela — então o contato solto vai pra linha de quem existe. */
  const soNoiva = !dados.noivo && !!dados.noiva;
  escreverCampo("tel-noivo", soNoiva ? "" : dados.tel_noivo, true);
  escreverCampo("tel-noiva", soNoiva ? (dados.tel_noiva || dados.tel_noivo) : dados.tel_noiva, true);
  escreverCampo("data-formatada", dataEventoExtenso(dados.data_evento));
  escreverCampo("local", dados.local_evento);
  escreverCampo("horario", dados.horario ? String(dados.horario).slice(0, 5) : "");
  escreverCampo("valor-total", moeda(total));
  escreverCampo("valor-entrada", moeda(entrada));
  escreverCampo("cidade-assinatura", dados.cidade);
  escreverCampo("data-assinatura", dataExtenso(assinadoEm) + ".");
  /* sem CPF sai só o nome (o CPF virou opcional em 2026-08-11) — deixar
     "— CPF —" pendurado na linha da assinatura pareceria dado faltando */
  escreverCampo(
    "ass-casal-rotulo",
    signatario.nome + (signatario.cpf ? " — CPF " + cpfFormatado(signatario.cpf) : "")
  );

  /* ---------- tabela de itens ---------- */
  {
    const b = caixaDe("tabela-servicos");
    const pad = 6;
    const colQtd = 34 * sx, colVal = 105 * sx;
    const colDesc = b.largura - colQtd - colVal;

    /* O contrato LISTA o pacote e os adicionais, um por linha, mas NENHUM
       valor unitário — só o VALOR TOTAL no rodapé da tabela (2026-08-11).
       Imprimir o preço de tabela de cada item ao lado de um total diferente
       levantaria a pergunta "de onde vem a diferença?", que é justamente o
       que se quer omitir.

       O pacote vem primeiro; sem pacote nenhum (contrato só de adicionais) a
       primeira linha é um rótulo genérico. */
    const pacote = itens.find(ehPacote);
    const adicionais = itens.filter((i) => !ehPacote(i));
    const itensDaTabela = [
      { desc: pacote ? (pacote.nome || pacote.id) : "Serviços fotográficos contratados" },
      ...adicionais.map((a) => ({ desc: a.nome || a.id })),
    ];

    /* A caixa do template tem altura FIXA — é ela que mantém a paginação igual
       pra todo contrato e permitiu acabar com as três variantes P/M/G. Como a
       tabela voltou a crescer com a quantidade de itens, ela agora se ENCAIXA
       na caixa: aperta primeiro o respiro das linhas, depois a fonte, até
       caber. Um contrato de 1 item sai folgado, um de 10 sai apertado, e os
       dois ocupam exatamente o mesmo espaço na folha. */
    const N_FIXAS = 2;                         /* cabeçalho + VALOR TOTAL */
    let fs = 9.8, respiro = 10;
    let quebras: string[][] = [];
    for (;;) {
      quebras = itensDaTabela.map((l) => quebrarEmLinhas(l.desc, helv, fs, colDesc - pad * 2));
      const linhasDeTexto = quebras.reduce((s, q) => s + q.length, 0) + N_FIXAS;
      const altura = (itensDaTabela.length + N_FIXAS) * respiro + linhasDeTexto * (fs + 3.5);
      if (altura <= b.altura) break;
      if (respiro > 4) { respiro -= 1; continue; }
      if (fs > 6.8) { fs -= 0.3; continue; }
      break;   /* piso: melhor um leve transbordo do que texto ilegível */
    }

    type LinhaTabela = {
      qtd: string; desc: unknown; val: string;
      cabecalho?: boolean; destaque?: boolean; quebra?: string[];
    };
    const linhas: LinhaTabela[] = [
      { cabecalho: true, qtd: "QTD", desc: "DESCRIÇÃO DOS SERVIÇOS", val: "VALOR TOTAL" },
      ...itensDaTabela.map((l, i): LinhaTabela => ({ qtd: "1", desc: l.desc, val: "", quebra: quebras[i] })),
      { destaque: true, qtd: "", desc: "VALOR TOTAL", val: moeda(total) },
    ];

    let topo = b.topo;
    for (const l of linhas) {
      const nLinhas = l.quebra ? l.quebra.length : 1;
      const alturaLinha = respiro + nLinhas * (fs + 3.5);
      const base = topo - alturaLinha;

      if (l.cabecalho) {
        b.page.drawRectangle({ x: b.x, y: base, width: b.largura, height: alturaLinha, color: FUNDO_TH });
      }
      b.page.drawRectangle({
        x: b.x, y: base, width: b.largura, height: alturaLinha,
        borderColor: LINHA, borderWidth: 0.75,
      });
      for (const dx of [colQtd, colQtd + colDesc]) {
        b.page.drawLine({
          start: { x: b.x + dx, y: base }, end: { x: b.x + dx, y: base + alturaLinha },
          color: LINHA, thickness: 0.75,
        });
      }

      const fonte = (l.cabecalho || l.destaque) ? helvBold : helv;
      const size = l.cabecalho ? Math.min(8, fs) : fs;
      const y = base + alturaLinha - size - 5;
      const qtd = paraWinAnsi(l.qtd);
      b.page.drawText(qtd, {
        x: b.x + colQtd - pad - fonte.widthOfTextAtSize(qtd, size),
        y, size, font: fonte, color: TINTA,
      });
      (l.quebra || [paraWinAnsi(l.desc)]).forEach((linha, i) => {
        b.page.drawText(linha, {
          x: b.x + colQtd + pad, y: y - i * (fs + 3.5), size, font: fonte, color: TINTA,
        });
      });
      const val = paraWinAnsi(l.val);
      b.page.drawText(val, {
        x: b.x + b.largura - pad - fonte.widthOfTextAtSize(val, size),
        y, size, font: fonte, color: TINTA,
      });

      topo = base;
    }
  }

  /* ---------- assinaturas ---------- */
  carimbarAssinatura("assinatura-casal", assinaturaCasalDataUrl);
  carimbarAssinatura("assinatura-jordan", assinaturaJordanDataUrl);

  /* ---------- página de auditoria ----------
     IP, dispositivo e hash NÃO são impressos aqui de propósito: ficam só na
     tabela contratos, e o selo do rodapé (que vem no template) diz isso. O
     carimbo de data/hora é o do SERVIDOR — o mesmo instante que vai pra
     coluna assinado_em —, não o relógio do celular de quem assinou. */
  {
    const b = caixaDe("auditoria");
    const quando = assinadoEm.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
    const linhas: [string, string][] = [
      ["Signatário:", signatario.nome],
      ...(signatario.cpf ? [["CPF:", cpfFormatado(signatario.cpf)] as [string, string]] : []),
      ...(signatario.email ? [["E-mail:", signatario.email] as [string, string]] : []),
      ["Data e hora:", quando + " (horário de Brasília)"],
      ["Verificação:", "acesso por link eletrônico exclusivo, entregue ao contratante"],
      ["Aceite:", "os termos foram lidos e aceitos, com reconhecimento da validade da"],
      ["", "assinatura eletrônica (MP 2.200-2/2001, art. 10, §2º)"],
    ];
    let y = b.topo - 16;
    for (const [rotulo, valor] of linhas) {
      if (rotulo) {
        b.page.drawText(paraWinAnsi(rotulo), { x: b.x, y, size: 9.5, font: helvBold, color: TINTA });
      }
      b.page.drawText(paraWinAnsi(valor), { x: b.x + 78, y, size: 9.5, font: helv, color: TINTA });
      y -= 17;
    }
  }

  /* a última folha do template é o nosso comprovante de assinatura; indo pra
     Autentique, quem comprova é ela, então a folha sai */
  if (semComprovante) doc.removePage(doc.getPageCount() - 1);

  return doc.save();
}

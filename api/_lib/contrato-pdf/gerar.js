/*
  Monta o PDF do contrato assinado — roda no SERVIDOR, na hora da assinatura.

  Antes (até 2026-07-31) o PDF era um screenshot: o assinar.html fotografava a
  tela do celular do casal com html2pdf/html2canvas e mandava 2,9 MB de imagem
  pro backend. Saía pesado, sem texto selecionável, e a quebra de página era
  por pixel (linha cortada ao meio). Agora:

    1. tools/contrato-template/ gera, OFFLINE, um PDF vetorial já paginado a
       partir do contrato-template.js, com os campos variáveis em branco;
    2. este módulo abre esse template e escreve os valores nas lacunas.

  Resultado: ~240 KB, texto de verdade (selecionável e pesquisável) e sempre
  idêntico, independente do aparelho de quem assina.

  Os arquivos template-*.pdf / coords-*.json desta pasta são GERADOS — não
  edite à mão. Mexeu numa cláusula do contrato-template.js? Regere (veja
  tools/contrato-template/README.md), senão o PDF sai com o texto antigo.
*/
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

/* relativo a ESTE módulo, nunca ao cwd: o diretório de trabalho difere entre
   o dev-server local e a lambda da Vercel */
const AQUI = dirname(fileURLToPath(import.meta.url));

/* Faixa de itens -> variante do template. A caixa da tabela é um bloco
   atômico; reservar sempre o pior caso (9 itens) deixava um vão enorme na
   página 1 dos contratos pequenos. Ver tools/contrato-template/README.md. */
function varianteDe(qtdItens) {
  if (qtdItens <= 3) return "P";
  if (qtdItens <= 6) return "M";
  return "G";
}

const TINTA = rgb(0.114, 0.114, 0.106);      /* --ink  #1D1D1B */
const LINHA = rgb(0.788, 0.769, 0.741);      /* grade da tabela #C9C4BD */
const FUNDO_TH = rgb(0.965, 0.953, 0.941);   /* cabeçalho da tabela #F6F3F0 */

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

function moeda(v) {
  /* o Intl separa "R$" do número com espaço fino (U+00A0); troca por espaço
     normal só pra não depender de encoding exótico na fonte do PDF */
  return brl.format(Number(v) || 0).replace(/ /g, " ");
}
function cpfFormatado(v) {
  const d = String(v || "").replace(/\D/g, "");
  return d.length === 11 ? d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4") : String(v || "");
}
function cepFormatado(v) {
  const d = String(v || "").replace(/\D/g, "");
  return d.length === 8 ? d.replace(/(\d{5})(\d{3})/, "$1-$2") : String(v || "");
}
function dataExtenso(d) {
  return d.getDate() + " de " + MESES[d.getMonth()] + " de " + d.getFullYear();
}
function dataEventoExtenso(iso) {
  if (!iso) return "";
  const [a, m, dia] = String(iso).split("-").map(Number);
  return dia + " de " + MESES[m - 1] + " de " + a;
}

/* As fontes padrão do PDF usam WinAnsi, que cobre o português inteiro mas não
   emoji nem alfabetos fora do latim-1. O pdf-lib LANÇA ERRO ao topar com um
   caractere que não consegue codificar — e o nome/local vêm do casal, texto
   livre. Sem esta limpeza, um emoji no nome derrubaria a assinatura. */
function paraWinAnsi(texto) {
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

function bytesDeDataUrl(dataUrl) {
  const base64 = String(dataUrl || "").split(",")[1];
  if (!base64) throw new Error("assinatura sem conteúdo");
  return Buffer.from(base64, "base64");
}

export async function gerarContratoPdf({
  snapshot,
  assinaturaCasalDataUrl,
  assinaturaJordanDataUrl,
  signatario,
  assinadoEm
}) {
  const dados = snapshot || {};
  const itens = Array.isArray(dados.itens) ? dados.itens : [];
  const variante = varianteDe(itens.length);

  const coords = JSON.parse(
    readFileSync(join(AQUI, `coords-${variante}.json`), "utf8")
  );
  const doc = await PDFDocument.load(readFileSync(join(AQUI, `template-${variante}.pdf`)));

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
  function campoDe(nome) {
    const c = coords.campos.find((x) => x.campo === nome);
    if (!c) throw new Error("campo sem coordenada no template: " + nome);
    return c;
  }

  function escreverCampo(nome, texto) {
    const c = campoDe(nome);
    const valor = paraWinAnsi(texto === 0 ? "0" : (texto || "—"));
    let size = c.fontePx * 0.92 * 0.75;
    const maxW = (c.w - 6) * sx;
    while (size > 6 && helv.widthOfTextAtSize(valor, size) > maxW) size -= 0.25;
    const larguraTexto = helv.widthOfTextAtSize(valor, size);
    const x = margemX + (c.centrado ? (c.x + c.w / 2) * sx - larguraTexto / 2 : (c.x + 3) * sx);
    pages[c.pagina].drawText(valor, {
      x,
      y: pageH - margemTopo - (c.y + c.h) * sy + 2.5,   /* um tico acima do sublinhado */
      size, font: helv, color: TINTA
    });
  }

  function caixaDe(nome) {
    const b = coords.boxes.find((x) => x.box === nome);
    if (!b) throw new Error("caixa sem coordenada no template: " + nome);
    return {
      page: pages[b.pagina],
      x: margemX + b.x * sx, largura: b.w * sx,
      topo: pageH - margemTopo - b.y * sy, altura: b.h * sy
    };
  }

  function quebrarEmLinhas(texto, fonte, size, maxW) {
    const linhas = [];
    let atual = "";
    for (const palavra of paraWinAnsi(texto).split(" ")) {
      const tentativa = atual ? atual + " " + palavra : palavra;
      if (fonte.widthOfTextAtSize(tentativa, size) <= maxW) atual = tentativa;
      else { if (atual) linhas.push(atual); atual = palavra; }
    }
    if (atual) linhas.push(atual);
    return linhas.length ? linhas : [""];
  }

  function carimbarAssinatura(nomeCaixa, dataUrl) {
    if (!dataUrl) return;              /* sem assinatura, fica só a linha */
    const b = caixaDe(nomeCaixa);
    const png = pngsEmbutidos[nomeCaixa];
    const escala = Math.min((b.largura * 0.75) / png.width, (b.altura - 8) / png.height);
    const w = png.width * escala, h = png.height * escala;
    b.page.drawImage(png, {
      x: b.x + (b.largura - w) / 2,
      y: b.topo - b.altura + 2,
      width: w, height: h
    });
  }

  /* as duas assinaturas já chegam como PNG (o canvas do /assinar pro casal, o
     dataurl guardado no banco pro Jordan) — o servidor só carimba imagem, por
     isso não precisa de fontkit nem de fonte cursiva aqui */
  const pngsEmbutidos = {};
  if (assinaturaCasalDataUrl) {
    pngsEmbutidos["assinatura-casal"] = await doc.embedPng(bytesDeDataUrl(assinaturaCasalDataUrl));
  }
  if (assinaturaJordanDataUrl) {
    pngsEmbutidos["assinatura-jordan"] = await doc.embedPng(bytesDeDataUrl(assinaturaJordanDataUrl));
  }

  /* ---------- lacunas ---------- */
  const total = Number(dados.total) || 0;
  const entrada = (dados.entrada != null && dados.entrada !== "")
    ? Number(dados.entrada) : total * 0.3;

  escreverCampo("noivo", dados.noivo);
  escreverCampo("cpf-noivo", cpfFormatado(dados.cpf_noivo));
  escreverCampo("noiva", dados.noiva);
  escreverCampo("cpf-noiva", cpfFormatado(dados.cpf_noiva));
  escreverCampo("endereco", dados.endereco);
  escreverCampo("numero", dados.numero);
  escreverCampo("bairro", dados.bairro);
  escreverCampo("cidade", dados.cidade);
  escreverCampo("complemento", dados.complemento || "N/A");
  escreverCampo("estado", dados.estado);
  escreverCampo("cep", cepFormatado(dados.cep));
  escreverCampo("tel-noivo", dados.tel_noivo);
  escreverCampo("tel-noiva", dados.tel_noiva);
  escreverCampo("data-formatada", dataEventoExtenso(dados.data_evento));
  escreverCampo("local", dados.local_evento);
  escreverCampo("horario", dados.horario ? String(dados.horario).slice(0, 5) : "");
  escreverCampo("valor-total", moeda(total));
  escreverCampo("valor-entrada", moeda(entrada));
  escreverCampo("cidade-assinatura", dados.cidade);
  escreverCampo("data-assinatura", dataExtenso(assinadoEm) + ".");
  escreverCampo(
    "ass-casal-rotulo",
    signatario.nome + " — CPF " + cpfFormatado(signatario.cpf)
  );

  /* ---------- tabela de itens ---------- */
  {
    const b = caixaDe("tabela-servicos");
    const fs = 9.8, pad = 6;
    const colQtd = 34 * sx, colVal = 105 * sx;
    const colDesc = b.largura - colQtd - colVal;

    const linhas = [{ cabecalho: true, qtd: "QTD", desc: "DESCRIÇÃO DOS SERVIÇOS", val: "VALOR TOTAL" }];
    for (const item of itens) {
      linhas.push({
        qtd: "1",
        desc: item.nome || item.id || "Serviço",
        val: moeda(item.valor),
        quebra: quebrarEmLinhas(item.nome || item.id || "Serviço", helv, fs, colDesc - pad * 2)
      });
    }
    linhas.push({ destaque: true, qtd: "", desc: "VALOR TOTAL", val: moeda(total) });

    let topo = b.topo;
    for (const l of linhas) {
      const nLinhas = l.quebra ? l.quebra.length : 1;
      const alturaLinha = 10 + nLinhas * (fs + 3.5);
      const base = topo - alturaLinha;

      if (l.cabecalho) {
        b.page.drawRectangle({ x: b.x, y: base, width: b.largura, height: alturaLinha, color: FUNDO_TH });
      }
      b.page.drawRectangle({
        x: b.x, y: base, width: b.largura, height: alturaLinha,
        borderColor: LINHA, borderWidth: 0.75
      });
      for (const dx of [colQtd, colQtd + colDesc]) {
        b.page.drawLine({
          start: { x: b.x + dx, y: base }, end: { x: b.x + dx, y: base + alturaLinha },
          color: LINHA, thickness: 0.75
        });
      }

      const fonte = (l.cabecalho || l.destaque) ? helvBold : helv;
      const size = l.cabecalho ? 8 : fs;
      const y = base + alturaLinha - size - 5;
      const qtd = paraWinAnsi(l.qtd);
      b.page.drawText(qtd, {
        x: b.x + colQtd - pad - fonte.widthOfTextAtSize(qtd, size),
        y, size, font: fonte, color: TINTA
      });
      (l.quebra || [paraWinAnsi(l.desc)]).forEach((linha, i) => {
        b.page.drawText(linha, {
          x: b.x + colQtd + pad, y: y - i * (fs + 3.5), size, font: fonte, color: TINTA
        });
      });
      const val = paraWinAnsi(l.val);
      b.page.drawText(val, {
        x: b.x + b.largura - pad - fonte.widthOfTextAtSize(val, size),
        y, size, font: fonte, color: TINTA
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
    const linhas = [
      ["Signatário:", signatario.nome],
      ["CPF:", cpfFormatado(signatario.cpf)],
      ...(signatario.email ? [["E-mail:", signatario.email]] : []),
      ["Data e hora:", quando + " (horário de Brasília)"],
      ["Verificação:", "acesso por link eletrônico exclusivo, entregue ao contratante"],
      ["Aceite:", "os termos foram lidos e aceitos, com reconhecimento da validade da"],
      ["", "assinatura eletrônica (MP 2.200-2/2001, art. 10, §2º)"]
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

  return doc.save();
}

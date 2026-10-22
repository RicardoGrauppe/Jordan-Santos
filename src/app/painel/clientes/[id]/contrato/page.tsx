/*
  Revisão do contrato pelo fotógrafo, /painel/clientes/<id>/contrato.
  Portado de `revisar-contrato.html` do estúdio do Jordan Santos.

  Fluxo: o contrato já existe (status "rascunho", salvo desde o "Gerar
  contrato" na ficha do cliente). Aqui o fotógrafo confere, edita campos
  clicando neles, "assina" (cursiva com o nome ou traço na mão) e pega o link
  de assinatura do casal. Depois acompanha o status (enviado, visualizado,
  assinado) e, assinado pelos dois, baixa a via em PDF.

  Decisões herdadas do original, que não devem ser redescobertas:
  - O documento (#documento) é HTML cru vindo do snapshot do contrato (ou do
    texto fixo em `lib/contrato-template.ts`), preenchido via [data-campo] e
    dividido em folhas A4 por MEDIÇÃO real de altura (paginarDocumento). Por
    isso ele vive fora do React: a gente escreve innerHTML uma vez por carga e
    nunca deixa o React tocar nos filhos dele.
  - Paginar precisa acontecer com o container VISÍVEL e já com os valores de
    verdade preenchidos (placeholder "________" mede altura errada) e com as
    imagens carregadas (logo sem altura também mede errado).
  - Assinatura padrão (salva em /configuracoes) só entra quando o contrato
    ainda NÃO foi confirmado: a assinatura deste contrato manda sobre a padrão.
  - Um contrato aceita UMA assinatura do fotógrafo e UMA do casal; reconfirmar
    só acontece quando a ficha muda depois de confirmado (o servidor zera a
    confirmação e sobe a versão).
  - No celular, menu "Opções" e modal de assinatura viram bottom sheet.
*/
"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ButtonHTMLAttributes } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Dancing_Script } from "next/font/google";
import SignaturePad from "signature_pad";
import {
  ArrowLeft, Check, CircleX, Copy, Download, EllipsisVertical, ExternalLink, Eye, FileCheck,
  Info, Pencil, Send, ShieldCheck, TriangleAlert, Users, X,
} from "lucide-react";
import { useVoltar } from "@/lib/voltar";
import { Aviso, Botao, Campo, Cartao, Estado, Selo } from "@/components/ui";
import { LateralAssinantes, type AssinanteLateral, type ItemAuditoria } from "@/components/LateralAssinantes";
import { useConfirmar } from "@/components/ModalConfirmar";
import { fmtData, moeda } from "@/lib/util";
import { htmlContratoTemplate } from "@/lib/contrato-template";
import { urlNoAutentique } from "@/lib/painel";


/* a cursiva da assinatura: a mesma fonte alimenta o preview na tela e o canvas
   que vira o PNG gravado no contrato */
const cursiva = Dancing_Script({ subsets: ["latin"], weight: "600", display: "swap" });

/* Nome do fotógrafo. Herdado do app original; quando o perfil em /api/config
   tiver nome, ele substitui isto (ver carregarPerfil). */
const NOME_FOTOGRAFO_PADRAO = "Jordan Santos";

/* ---------- tipos (mesma forma que /api/estudio devolve) ---------- */

type StatusContrato = "rascunho" | "enviado" | "visualizado" | "assinado" | "cancelado";
type TipoAssinatura = "cursiva" | "manual";

type ItemContratado = { id?: string | null; nome?: string | null };

type Snapshot = {
  noivo?: string | null; cpf_noivo?: string | null; noiva?: string | null; cpf_noiva?: string | null;
  tel_noivo?: string | null; tel_noiva?: string | null; email?: string | null;
  cep?: string | null; endereco?: string | null; numero?: string | null; complemento?: string | null;
  bairro?: string | null; cidade?: string | null; estado?: string | null;
  data_evento?: string | null; horario?: string | null; local_evento?: string | null;
  itens?: ItemContratado[] | null; total?: number | string | null; entrada?: number | string | null;
};

type Contrato = {
  id: string;
  token: string;
  status: StatusContrato;
  versao?: number | null;
  criado_em?: string | null;
  enviado_em?: string | null;
  visualizado_em?: string | null;
  assinado_em?: string | null;
  expira_em?: string | null;
  snapshot?: Snapshot | null;
  jordan_confirmado_em?: string | null;
  jordan_assinatura_tipo?: TipoAssinatura | null;
  jordan_assinatura_dataurl?: string | null;
  jordan_assinatura_nome?: string | null;
  signatario_nome?: string | null;
  signatario_cpf?: string | null;
  signatario_email?: string | null;
  assinante_ip?: string | null;
  assinante_ua?: string | null;
  doc_sha256?: string | null;
  aceite_texto?: string | null;
  aceite_em?: string | null;
  verificado_em?: string | null;
  verificacao_metodo?: string | null;
  template_id?: string | null;
  template_nome?: string | null;
  template_html?: string | null;
  /* documento na Autentique (desde 21/10/2026) */
  autentique_id?: string | null;
  autentique_link?: string | null;
  recusado_em?: string | null;
};

type Cliente = { id?: string; noivo?: string | null; noiva?: string | null };

type RespostaEstudio = { cliente?: Cliente; contrato?: Contrato | null; erro?: string };
type RespostaLiberar = { ok?: boolean; link?: string; mensagem?: string; assinado?: boolean; telefone?: string; erro?: string };
type RespostaPdf = { pdf?: string; arquivo?: string; erro?: string };
type AssinaturaPadrao = { tipo?: "cursiva" | "rubrica" | "imagem"; valor?: string | null; nome?: string | null };
type RespostaTemplates = { assinatura?: AssinaturaPadrao | null };
type RespostaConfig = { perfil?: { nome?: string | null } | null };

type Tela =
  | { tipo: "carregando" }
  | { tipo: "erro"; texto: string; sessao?: boolean }
  | { tipo: "ok" };

type Mensagem = { texto: string; tom?: "ok" | "erro" };

const SEM_MENSAGEM: Mensagem = { texto: "" };
const ABERTOS: StatusContrato[] = ["rascunho", "enviado", "visualizado", "assinado"];

/* ---------- helpers puros (mesmos do original) ---------- */

async function api<T extends { erro?: string }>(corpo: Record<string, unknown>): Promise<T> {
  const r = await fetch("/api/estudio", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(corpo),
  });
  const j = (await r.json()) as T;
  if (!r.ok) throw new Error(j.erro || "Não foi possível completar a ação.");
  return j;
}

function fmtDataHora(iso: string | null | undefined): string {
  if (!iso) return "";
  return new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

function formatarCpf(v: unknown): string {
  const d = String(v ?? "").replace(/\D/g, "").slice(0, 11);
  if (d.length !== 11) return d || "________________";
  return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
}

function dataExtenso(d: Date): string {
  const meses = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
  return d.getDate() + " de " + meses[d.getMonth()] + " de " + d.getFullYear();
}

function dataEventoExtenso(iso: string | null | undefined): string {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return "________________";
  const p = iso.split("-");
  return dataExtenso(new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2])));
}

/* O contrato LISTA o pacote e os adicionais, um por linha, mas sem NENHUM
   valor unitário, só o VALOR TOTAL no rodapé. Tem que bater EXATAMENTE com o
   gerador de PDF (lib/contrato-pdf): o que se lê na tela é o que vai pro PDF
   assinado. A detecção de pacote é a mesma do servidor: id conhecido, com o
   nome como rede de segurança. */
const IDS_PACOTE: Record<string, true> = { eternal: true, heritage: true };
function ehPacote(it: ItemContratado | null | undefined): boolean {
  return !!(it && it.id && IDS_PACOTE[it.id]) || /^pacote\b/i.test(String(it?.nome ?? ""));
}

function montaTabela(container: HTMLElement, itens: ItemContratado[], total: number) {
  const tbody = container.querySelector<HTMLTableSectionElement>("#tabela-servicos");
  if (!tbody) return;
  tbody.innerHTML = "";
  const pacote = itens.filter(ehPacote)[0];
  const descricoes = [pacote ? (pacote.nome || pacote.id || "") : "Serviços fotográficos contratados"];
  itens.filter((i) => !ehPacote(i)).forEach((a) => { descricoes.push(a.nome || a.id || ""); });

  descricoes.forEach((texto) => {
    const tr = document.createElement("tr");
    const qtd = document.createElement("td"); qtd.textContent = "1"; qtd.className = "num";
    const desc = document.createElement("td"); desc.textContent = texto;
    const val = document.createElement("td"); val.className = "num";
    tr.append(qtd, desc, val);
    tbody.appendChild(tr);
  });

  const trTotal = document.createElement("tr");
  const v = document.createElement("td");
  const r = document.createElement("td"); r.textContent = "VALOR TOTAL"; r.style.fontWeight = "500";
  const t = document.createElement("td"); t.textContent = moeda(total); t.className = "num"; t.style.fontWeight = "500";
  trTotal.append(v, r, t);
  tbody.appendChild(trTotal);
}

function preencherCampo(container: HTMLElement, nome: string, valor: string | null | undefined) {
  container.querySelectorAll<HTMLElement>('[data-campo="' + nome + '"]').forEach((span) => {
    span.textContent = valor || "________________";
  });
}

/* ---------- folhas A4 ----------
   Medição na mão (o Paged.js foi tentado e revertido no original: ele larga
   uma cópia do documento em document.body por fora de qualquer container).
   Mede a altura real de cada nó e só deixa passar do limite da folha se não
   tiver jeito. Um <ol> com vários itens vira uma unidade por <li>, que pode
   ficar numa folha e continuar na próxima com a numeração preservada. */
type Unidade =
  | { no: HTMLElement; li?: undefined }
  | { li: HTMLElement; tag: "OL" | "UL"; classe: string; numero: number | null; no?: undefined };

function paginarDocumento(container: HTMLElement) {
  /* template salvo pelo editor exporta tudo dentro de um <section class="secao">
     só; sem desembrulhar, a paginação vê UM nó gigante */
  const secao = container.querySelector<HTMLElement>(":scope > .secao");
  if (secao) {
    while (secao.firstChild) container.appendChild(secao.firstChild);
    secao.remove();
  }
  const filhos = Array.from(container.children) as HTMLElement[];

  const unidades: Unidade[] = [];
  filhos.forEach((no) => {
    if ((no.tagName === "OL" || no.tagName === "UL") && no.children.length > 1) {
      const tag = no.tagName as "OL" | "UL";
      const numeroBase = tag === "OL" ? (parseInt(no.getAttribute("start") ?? "", 10) || 1) : null;
      (Array.from(no.children) as HTMLElement[]).forEach((li, i) => {
        unidades.push({ li, tag, classe: no.className, numero: numeroBase !== null ? numeroBase + i : null });
      });
      no.remove();
    } else {
      unidades.push({ no });
    }
  });

  const sonda = document.createElement("div");
  sonda.className = "folha";
  container.appendChild(sonda);
  const sondaRect = sonda.getBoundingClientRect();
  const sondaCs = getComputedStyle(sonda);
  const folhaLargura = sondaRect.width;
  const folhaAltura = folhaLargura * 297 / 210;
  const padEsq = parseFloat(sondaCs.paddingLeft) || 0;
  const padDir = parseFloat(sondaCs.paddingRight) || 0;
  const padTopo = parseFloat(sondaCs.paddingTop) || 0;
  const padBase = parseFloat(sondaCs.paddingBottom) || 0;
  const alturaUtil = folhaAltura - padTopo - padBase;
  sonda.remove();

  const medidor = document.createElement("div");
  medidor.style.cssText =
    "position:absolute;visibility:hidden;pointer-events:none;top:-99999px;left:-99999px;" +
    "width:" + (folhaLargura - padEsq - padDir) + "px;";
  container.appendChild(medidor);

  function alturaDoNo(no: HTMLElement): number {
    medidor.appendChild(no);
    const cs = getComputedStyle(no);
    return no.getBoundingClientRect().height + (parseFloat(cs.marginTop) || 0) + (parseFloat(cs.marginBottom) || 0);
  }
  /* mede o <li> dentro de um <ol>/<ul> descartável (só assim ele ganha o
     marcador e o padding certos) e devolve o <li> solto em seguida */
  function alturaDoLi(u: Extract<Unidade, { li: HTMLElement }>): number {
    const wrapper = document.createElement(u.tag);
    if (u.classe) wrapper.className = u.classe;
    wrapper.appendChild(u.li);
    medidor.appendChild(wrapper);
    const cs = getComputedStyle(wrapper);
    const altura = wrapper.getBoundingClientRect().height + (parseFloat(cs.marginTop) || 0) + (parseFloat(cs.marginBottom) || 0);
    medidor.appendChild(u.li);
    wrapper.remove();
    return altura;
  }
  const alturaDaUnidade = (u: Unidade) => (u.li ? alturaDoLi(u) : alturaDoNo(u.no));

  /* prioriza quebrar em fronteira de seção, mas NUNCA deixa passar do limite
     da folha mesmo no meio de uma cláusula: texto cortado (invisível, por
     causa do overflow:hidden) é bem pior do que uma cláusula atravessar a
     virada de página */
  const folhas: Unidade[][] = [];
  let atual: Unidade[] = [];
  let alturaAtual = 0;
  unidades.forEach((u) => {
    const altura = alturaDaUnidade(u);
    if (atual.length && alturaAtual + altura > alturaUtil) {
      folhas.push(atual);
      atual = []; alturaAtual = 0;
    }
    atual.push(u);
    alturaAtual += altura;
  });
  if (atual.length) folhas.push(atual);
  medidor.remove();

  function montarConteudoFolha(folha: HTMLElement, grupo: Unidade[]) {
    let i = 0;
    while (i < grupo.length) {
      const u = grupo[i];
      if (u.no) { folha.appendChild(u.no); i++; continue; }
      const lista = document.createElement(u.tag);
      if (u.classe) lista.className = u.classe;
      if (u.tag === "OL" && u.numero !== null) lista.setAttribute("start", String(u.numero));
      const tagAtual = u.tag, classeAtual = u.classe;
      while (i < grupo.length) {
        const g = grupo[i];
        if (!g.li || g.tag !== tagAtual || g.classe !== classeAtual) break;
        lista.appendChild(g.li);
        i++;
      }
      folha.appendChild(lista);
    }
  }

  const frag = document.createDocumentFragment();
  folhas.forEach((grupo, i) => {
    const folha = document.createElement("div");
    folha.className = "folha";
    montarConteudoFolha(folha, grupo);
    const numero = document.createElement("span");
    numero.className = "pagina-numero";
    numero.textContent = (i + 1) + " / " + folhas.length;
    folha.appendChild(numero);
    frag.appendChild(folha);
  });
  container.appendChild(frag);
}

/* ---------- edição inline ---------- */

type TipoCampo = "texto" | "cpf" | "data" | "hora" | "moeda";
type ColunaEditavel = keyof Snapshot;
const CAMPO_EDITAVEL: Record<string, { col: ColunaEditavel; tipo: TipoCampo }> = {
  "noivo": { col: "noivo", tipo: "texto" },
  "noiva": { col: "noiva", tipo: "texto" },
  "cpf-noivo": { col: "cpf_noivo", tipo: "cpf" },
  "cpf-noiva": { col: "cpf_noiva", tipo: "cpf" },
  "endereco": { col: "endereco", tipo: "texto" },
  "numero": { col: "numero", tipo: "texto" },
  "bairro": { col: "bairro", tipo: "texto" },
  "cidade": { col: "cidade", tipo: "texto" },
  "complemento": { col: "complemento", tipo: "texto" },
  "estado": { col: "estado", tipo: "texto" },
  "cep": { col: "cep", tipo: "texto" },
  "tel-noivo": { col: "tel_noivo", tipo: "texto" },
  "tel-noiva": { col: "tel_noiva", tipo: "texto" },
  "data-formatada": { col: "data_evento", tipo: "data" },
  "local": { col: "local_evento", tipo: "texto" },
  "horario": { col: "horario", tipo: "hora" },
  "valor-total": { col: "total", tipo: "moeda" },
  "valor-entrada": { col: "entrada", tipo: "moeda" },
};

function valorParaInput(tipo: TipoCampo, cru: unknown): string {
  if (tipo === "moeda") return (Number(cru) || 0).toFixed(2);
  if (tipo === "data") return /^\d{4}-\d{2}-\d{2}$/.test(String(cru ?? "")) ? String(cru) : "";
  if (tipo === "hora") return cru ? String(cru).slice(0, 5) : "";
  return cru ? String(cru) : "";
}
function tipoDoInput(tipo: TipoCampo): string {
  if (tipo === "moeda") return "number";
  if (tipo === "data") return "date";
  if (tipo === "hora") return "time";
  return "text";
}
function larguraChute(tipo: TipoCampo, valor: string): string | null {
  if (tipo === "data" || tipo === "hora") return null;
  return Math.max(valor.length, 3) + 1.5 + "ch";
}

/* Copia de verdade em qualquer cenário. navigator.clipboard só existe em
   contexto seguro (HTTPS ou localhost); no celular, testando por IP local,
   ele não está lá. Daí o caminho legado com execCommand, SÍNCRONO (só funciona
   dentro do gesto). */
function copiaLegado(texto: string): boolean {
  const ta = document.createElement("textarea");
  ta.value = texto;
  ta.setAttribute("aria-hidden", "true");
  ta.style.cssText = "position:fixed;top:0;left:0;width:1px;height:1px;padding:0;border:0;opacity:0";
  document.body.appendChild(ta);
  const focoAnterior = document.activeElement;
  ta.focus({ preventScroll: true });
  ta.select();
  ta.setSelectionRange(0, texto.length);
  let copiou = false;
  try { copiou = document.execCommand("copy"); } catch { copiou = false; }
  document.body.removeChild(ta);
  if (focoAnterior instanceof HTMLElement) focoAnterior.focus({ preventScroll: true });
  return copiou;
}
function copiarTexto(texto: string): Promise<boolean> {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    return navigator.clipboard.writeText(texto).then(() => true, () => copiaLegado(texto));
  }
  return Promise.resolve(copiaLegado(texto));
}

/* renderiza o nome em cursiva num canvas, pra virar PNG igual ao formato da
   assinatura desenhada (mesmo "shape" de dado no banco) */
async function cursivaParaDataUrl(nome: string): Promise<string> {
  const fonte = "600 64px " + cursiva.style.fontFamily;
  try { await document.fonts.load(fonte, nome); } catch { /* segue com a fallback */ }
  const canvas = document.createElement("canvas");
  canvas.width = 600; canvas.height = 160;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";
  ctx.font = fonte;
  ctx.fillStyle = "#1D1D1B";
  ctx.textBaseline = "middle";
  ctx.textAlign = "center";
  ctx.fillText(nome, canvas.width / 2, canvas.height / 2);
  return canvas.toDataURL("image/png");
}

const ROTULO_STATUS: Record<StatusContrato, string> = {
  rascunho: "Rascunho", enviado: "Enviado", visualizado: "Visualizado", assinado: "Assinado", cancelado: "Cancelado",
};
/* rascunho fica neutro de propósito: é o único estado que ainda não saiu das
   mãos do fotógrafo */
const TOM_STATUS: Record<StatusContrato, "neutro" | "ok" | "atencao" | "erro" | "accent"> = {
  rascunho: "neutro", enviado: "atencao", visualizado: "accent", assinado: "ok", cancelado: "erro",
};
function IconeStatus({ status }: { status: StatusContrato }) {
  const p = { size: 11, strokeWidth: 2 };
  if (status === "enviado") return <Send {...p} />;
  if (status === "visualizado") return <Eye {...p} />;
  if (status === "assinado") return <Check {...p} strokeWidth={2.5} />;
  if (status === "cancelado") return <CircleX {...p} />;
  return <Pencil {...p} />;
}

/* ---------- CSS do documento e da impressão ----------
   Vive num <style> da própria tela: o conteúdo de #documento é HTML cru (não
   passa pelo Tailwind), e as regras de impressão precisam esconder a moldura
   do painel inteira. O interior do documento tem cara de contrato de
   propósito (Times New Roman, tabela com grade, linha de assinatura): isso é
   conteúdo do documento, não UI, e por isso escapa da regra "sem borda". */
const CSS_DOCUMENTO = `
#documento{font-family:"Times New Roman",Times,Georgia,serif}
#documento.folhas{display:flex;flex-direction:column;align-items:center;gap:26px;max-width:none;padding:0}
#documento .folha{width:100%;max-width:794px;aspect-ratio:210/297;background:var(--color-paper);box-shadow:var(--shadow-alta);padding:52px 58px 46px;position:relative;overflow:hidden}
#documento .pagina-numero{position:absolute;bottom:16px;right:22px;font-size:10px;letter-spacing:.05em;color:var(--color-ink-soft)}
#documento .logo-contrato{display:block;margin:0 auto 14px;width:190px;height:auto}
#documento h2{font-family:inherit;font-weight:700;font-size:21px;letter-spacing:.06em;text-align:center;margin:0 0 26px}
#documento h3{font-size:14.5px;font-weight:500;letter-spacing:.05em;margin:24px 0 10px;break-after:avoid}
#documento .folha:first-child h3:first-child{margin-top:0}
#documento p,#documento li{font-size:13.6px;line-height:1.8;margin:0 0 10px;text-align:justify}
#documento .al-left{text-align:left}
#documento .al-center{text-align:center}
#documento .al-right{text-align:right}
#documento .al-justify{text-align:justify}
#documento ol,#documento ul{padding-left:22px;margin:0 0 10px}
#documento .campo{font-weight:500;border-bottom:1px solid var(--color-line);padding:0 4px;white-space:pre-wrap}
#documento table{width:100%;border-collapse:collapse;margin:14px 0 18px;font-size:13.6px;break-inside:avoid}
#documento th,#documento td{border:1px solid #C9C4BD;padding:8px 10px;text-align:left}
#documento th{font-weight:500;letter-spacing:.08em;font-size:11.5px;text-transform:uppercase;background:#F6F3F0}
#documento td.num{text-align:right;white-space:nowrap}
#documento .assinaturas{margin-top:48px;break-inside:avoid}
#documento .assinaturas p{text-align:center;margin-bottom:40px}
#documento .linha-ass{border-top:1px solid var(--color-ink);max-width:420px;margin:0 auto;padding-top:6px;text-align:center;font-size:12.5px}
#documento .campo.editavel{cursor:text;border-radius:3px;transition:background .12s}
@media (hover:hover){#documento .campo.editavel:hover{background:#FBF6EE}}
#documento .campo-inline-edit{font:inherit;font-size:inherit;color:inherit;background:#FBF6EE;border:0;outline:0;border-radius:4px;padding:0 3px;width:auto;min-width:2.4em;box-shadow:0 1px 2px rgba(29,29,27,.12)}
#documento .link-itens-estudio{display:block;text-align:right;font-size:12px;color:var(--color-accent);margin:-6px 0 14px;text-decoration:none;font-family:var(--font-sans)}
@media (hover:hover){#documento .link-itens-estudio:hover{text-decoration:underline}}
@media (max-width:959px){#documento .folha{padding:30px 22px 40px}}
@media (max-width:820px){#documento .campo-inline-edit{font-size:16px}}
@media print{
  body *{visibility:hidden}
  #documento,#documento *{visibility:visible}
  #documento{position:absolute;left:0;top:0;width:100%}
  #documento.folhas{gap:0}
  #documento .folha{box-shadow:none;page-break-after:always;break-after:page}
  #documento .folha:last-child{page-break-after:auto;break-after:auto}
  #documento .pagina-numero,#documento .link-itens-estudio{display:none}
}
@page{size:A4;margin:0}
`;

/* ============================================================ */

export default function PaginaRevisarContrato() {
  const params = useParams<{ id: string }>();
  const clienteId = params?.id ?? "";
  const router = useRouter();
  const confirmar = useConfirmar();

  const [tela, setTela] = useState<Tela>({ tipo: "carregando" });
  const [cliente, setCliente] = useState<Cliente>({});
  const [contrato, setContrato] = useState<Contrato | null>(null);
  const [nomeFotografo, setNomeFotografo] = useState(NOME_FOTOGRAFO_PADRAO);

  const [sidebarAberta, setSidebarAberta] = useState(false);
  const [menuAberto, setMenuAberto] = useState(false);
  const [modalAberto, setModalAberto] = useState(false);

  const [modo, setModo] = useState<TipoAssinatura>("cursiva");
  const [nomeCursiva, setNomeCursiva] = useState(NOME_FOTOGRAFO_PADRAO);
  const [avisoPadrao, setAvisoPadrao] = useState<string | null>(null);
  const [confirmando, setConfirmando] = useState(false);
  const [confirmadoDataUrl, setConfirmadoDataUrl] = useState<string | null>(null);

  const [linkCasal, setLinkCasal] = useState("");
  const [mensagemCasal, setMensagemCasal] = useState("");
  const [linkDeViaAssinada, setLinkDeViaAssinada] = useState(false);
  const [baixando, setBaixando] = useState(false);

  const [avisoDoc, setAvisoDoc] = useState<Mensagem>(SEM_MENSAGEM);
  const [avisoConfirmar, setAvisoConfirmar] = useState<Mensagem>(SEM_MENSAGEM);
  const [avisoLink, setAvisoLink] = useState<Mensagem>(SEM_MENSAGEM);
  const [avisoBaixar, setAvisoBaixar] = useState<Mensagem>(SEM_MENSAGEM);

  const documentoRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const padRef = useRef<SignaturePad | null>(null);
  /* imagem da assinatura padrão (rubrica/imagem) esperando o pad existir */
  const imagemPendenteRef = useRef<string | null>(null);
  /* valores CRUS do último render, pra pré-preencher o input de edição */
  const snapshotRef = useRef<Snapshot>({});
  const travadoRef = useRef(false);
  const nomeFotografoRef = useRef(NOME_FOTOGRAFO_PADRAO);
  const confirmadoRef = useRef<string | null>(null);
  const renderTokenRef = useRef(0);

  useEffect(() => { nomeFotografoRef.current = nomeFotografo; }, [nomeFotografo]);
  useEffect(() => { confirmadoRef.current = confirmadoDataUrl; }, [confirmadoDataUrl]);

  const hrefCliente = "/painel/clientes/" + encodeURIComponent(clienteId);
  /* sem histórico nosso (link aberto direto) a seta cai na ficha do cliente */
  const voltarDaqui = useVoltar(hrefCliente);

  /* ---------- link pro casal ----------
     Mesma ação da ficha ("liberar-contrato-cliente"), com dois modos:
     - `apenasLink` (ao ABRIR a tela): só pergunta se já existe link, nunca
       cria nada. Desde que a assinatura é da Autentique, criar aqui
       significaria mandar o contrato pro casal porque alguém abriu a revisão.
     - sem ele (no clique de "Copiar link"): sobe o documento, assina pelo
       fotógrafo e devolve o link do casal. */
  const carregarLinkDoCasal = useCallback(async (apenasLink?: boolean) => {
    setAvisoLink({ texto: apenasLink ? "" : "Enviando pra assinatura..." });
    try {
      const j = await api<RespostaLiberar>({ acao: "liberar-contrato-cliente", id: clienteId, apenasLink });
      setMensagemCasal(j.mensagem || j.link || "");
      setLinkCasal(j.link || "");
      setLinkDeViaAssinada(!!j.assinado);
      setAvisoLink(SEM_MENSAGEM);
    } catch (e) {
      if (apenasLink) { setAvisoLink(SEM_MENSAGEM); return; }
      const msg = e instanceof Error ? e.message : "";
      setAvisoLink({
        texto: !msg || msg === "Não foi possível completar a ação."
          ? "Não deu pra enviar pra assinatura agora. Volte pra ficha do cliente e tente por lá."
          : msg,
        tom: "erro",
      });
    }
  }, [clienteId]);

  /* ---------- assinatura padrão (salva em /configuracoes) ----------
     `cursiva` cai na aba de cursiva; `rubrica` e `imagem` são as duas uma
     IMAGEM de manuscrito, então entram no pad da aba manual (o banco só
     conhece cursiva|manual). Só roda quando o contrato ainda não foi
     confirmado. */
  const aplicarAssinaturaPadrao = useCallback(async () => {
    try {
      const r = await fetch("/api/templates", { credentials: "include" });
      if (!r.ok) return;
      const d = (await r.json()) as RespostaTemplates;
      const a = d.assinatura;
      if (!a || !a.valor) return;
      if (a.tipo === "cursiva") {
        setNomeCursiva(a.valor);
        setModo("cursiva");
      } else {
        imagemPendenteRef.current = a.valor;
        setModo("manual");
        if (padRef.current) {
          const pad = padRef.current;
          imagemPendenteRef.current = null;
          Promise.resolve(pad.fromDataURL(a.valor)).catch(() => { /* imagem salva corrompida */ });
        }
      }
      setAvisoPadrao("Aplicada a sua assinatura padrão (" + (a.nome || "sem nome") + "). Dá pra trocar aqui embaixo.");
    } catch { /* sem padrão salva ou API fora: segue o fluxo manual */ }
  }, []);

  /* ---------- carregar/recarregar o contrato ----------
     Toda edição inline chama de novo depois de salvar, pra a tela refletir o
     que o servidor decidiu (nova versão, confirmação zerada, trava se virou
     "assinado" no meio do caminho) em vez de o JS adivinhar. */
  const carregarContrato = useCallback(async () => {
    try {
      const r = await fetch("/api/estudio?id=" + encodeURIComponent(clienteId));
      if (r.status === 401) {
        setTela({ tipo: "erro", texto: "Sua sessão expirou. Entre de novo e abra o contrato pela ficha do cliente.", sessao: true });
        return;
      }
      const j = (await r.json()) as RespostaEstudio;
      if (!r.ok) { setTela({ tipo: "erro", texto: j.erro || "Não foi possível abrir este contrato." }); return; }
      const c = j.contrato;
      if (!c || !ABERTOS.includes(c.status)) {
        setTela({ tipo: "erro", texto: "Não há contrato ativo pra revisar. Gere um novo em \"Gerar contrato\", na ficha do cliente." });
        return;
      }
      setCliente(j.cliente ?? {});
      setContrato(c);
      setTela({ tipo: "ok" });
      setAvisoPadrao(null);
      /* reseta os painéis a cada carga: editar um contrato já confirmado (que
         zera jordan_confirmado_em) não pode deixar o "já assinado" preso */
      if (c.jordan_confirmado_em && c.jordan_assinatura_dataurl) {
        setNomeCursiva(c.jordan_assinatura_nome || nomeFotografoRef.current);
        setConfirmadoDataUrl(c.jordan_assinatura_dataurl);
        /* o link continua valendo depois de assinado: aí ele abre a tela de
           baixar a via, e é assim que o casal pede a segunda via */
        void carregarLinkDoCasal(true);
      } else {
        setConfirmadoDataUrl(null);
        setLinkCasal("");
        setMensagemCasal("");
        /* a assinatura DESTE contrato manda sobre a padrão; a padrão só entra
           quando ainda falta assinar */
        void aplicarAssinaturaPadrao();
      }
    } catch {
      setTela({ tipo: "erro", texto: "Não foi possível abrir este contrato. Tente de novo." });
    }
  }, [clienteId, carregarLinkDoCasal, aplicarAssinaturaPadrao]);

  /* nome do fotógrafo pelo perfil, best-effort */
  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const r = await fetch("/api/config");
        if (!r.ok) return;
        const j = (await r.json()) as RespostaConfig;
        const nome = j.perfil?.nome?.trim();
        if (vivo && nome) {
          setNomeFotografo(nome);
          setNomeCursiva((atual) => (atual === NOME_FOTOGRAFO_PADRAO ? nome : atual));
        }
      } catch { /* sem perfil: fica o padrão */ }
    })();
    return () => { vivo = false; };
  }, []);

  /* carga inicial: uma por cliente, pela referência mais recente da função */
  const carregarRef = useRef(carregarContrato);
  useEffect(() => { carregarRef.current = carregarContrato; }, [carregarContrato]);
  useEffect(() => {
    if (clienteId) void carregarRef.current();
  }, [clienteId]);

  /* Autentique: pergunta se o casal já viu, assinou ou recusou e recarrega a
     tela quando mudou. Num efeito próprio de propósito: dentro do
     `carregarContrato` ele leria o `carregarRef`, que é alimentado com o
     próprio `carregarContrato`, e o compilador do React barra esse laço.
     Sem chave configurada o servidor responde que não sincronizou. */
  const statusContrato = contrato?.status;
  useEffect(() => {
    if (!clienteId) return;
    if (statusContrato !== "enviado" && statusContrato !== "visualizado") return;
    let vivo = true;
    void fetch("/api/estudio", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ acao: "sincronizar-contrato", id: clienteId }),
    })
      .then((res) => res.json())
      .then((sinc: { sincronizado?: boolean; status?: string }) => {
        if (!vivo || !sinc?.sincronizado) return;
        if (sinc.status && sinc.status !== statusContrato) void carregarRef.current();
      })
      .catch(() => { /* rede fora: segue com o que está na tela */ });
    return () => { vivo = false; };
  }, [clienteId, statusContrato]);

  /* ---------- salvar um campo editado inline ---------- */
  const salvarCampo = useCallback(async (col: ColunaEditavel, valor: string | number, span: HTMLElement, textoOriginal: string) => {
    setAvisoDoc({ texto: "Salvando..." });
    try {
      await api<{ ok?: boolean; erro?: string }>({ acao: "atualizar", id: clienteId, cliente: { [col]: valor } });
      setAvisoDoc({ texto: "Salvo." });
      await carregarContrato();
    } catch (e) {
      span.textContent = textoOriginal;
      setAvisoDoc({ texto: e instanceof Error && e.message ? e.message : "Não foi possível salvar essa edição.", tom: "erro" });
    }
  }, [clienteId, carregarContrato]);

  const tornarEditavel = useCallback((span: HTMLElement, chave: string) => {
    const conf = CAMPO_EDITAVEL[chave];
    if (!conf || travadoRef.current || span.querySelector("input")) return;

    const valorCru = snapshotRef.current[conf.col];
    const input = document.createElement("input");
    input.className = "campo-inline-edit";
    input.type = tipoDoInput(conf.tipo);
    if (conf.tipo === "moeda") { input.step = "0.01"; input.min = "0"; }
    const valorInicial = valorParaInput(conf.tipo, valorCru);
    input.value = valorInicial;
    const largura = larguraChute(conf.tipo, valorInicial);
    if (largura) input.style.width = largura;

    const textoOriginal = span.textContent ?? "";
    span.textContent = "";
    span.appendChild(input);
    input.focus();
    input.select();

    let resolvido = false;
    const reverter = () => {
      if (resolvido) return;
      resolvido = true;
      span.textContent = textoOriginal;
    };
    const commit = () => {
      if (resolvido) return;
      resolvido = true;
      const novo: string | number = conf.tipo === "moeda" ? (Number(input.value) || 0) : input.value;
      /* nada mudou: não vale a pena versionar o contrato à toa */
      const antes = conf.tipo === "moeda" ? (Number(valorCru) || 0) : (valorCru ?? "");
      if (String(novo) === String(antes)) { span.textContent = textoOriginal; return; }
      void salvarCampo(conf.col, novo, span, textoOriginal);
    };
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); input.blur(); }
      else if (e.key === "Escape") { e.preventDefault(); reverter(); }
    });
    input.addEventListener("blur", commit);
  }, [salvarCampo]);

  /* clique-pra-editar: um listener só no documento, por delegação */
  useEffect(() => {
    const doc = documentoRef.current;
    if (!doc || tela.tipo !== "ok") return;
    const aoClicar = (e: MouseEvent) => {
      const alvo = e.target instanceof Element ? e.target : null;
      const span = alvo?.closest<HTMLElement>(".campo[data-campo]");
      if (!span || span.querySelector("input")) return;
      tornarEditavel(span, span.getAttribute("data-campo") ?? "");
    };
    doc.addEventListener("click", aoClicar);
    return () => doc.removeEventListener("click", aoClicar);
  }, [tela.tipo, tornarEditavel]);

  /* ---------- carimbos no documento (assinatura do fotógrafo e do casal) ----
     A IMAGEM da assinatura do casal não é guardada em lugar nenhum: ela é
     carimbada no PDF e descartada. Então aqui vai o que o banco tem de fato:
     nome, CPF e data. Quem quiser ver o traço abre o PDF. */
  const carimbarAssinaturas = useCallback((c: Contrato, dataurl: string | null) => {
    const doc = documentoRef.current;
    if (!doc) return;
    const area = doc.querySelector<HTMLElement>("#assinatura-jordan-area");
    if (area && dataurl) {
      area.innerHTML = "";
      const img = document.createElement("img");
      img.src = dataurl;
      img.alt = "assinatura " + nomeFotografoRef.current;
      img.style.cssText = "max-height:80px;max-width:280px;display:block;margin:0 auto 6px";
      const legenda = document.createElement("p");
      legenda.className = "linha-ass";
      legenda.style.marginTop = "0";
      legenda.textContent = "Jordan Santos – CONTRATADA";
      area.append(img, legenda);
    }
    if (c.status === "assinado") {
      const bloco = doc.querySelector<HTMLElement>("#bloco-assinaturas");
      const legenda = bloco?.querySelector<HTMLElement>(".linha-ass");
      if (legenda) {
        const nome = c.signatario_nome || "";
        const cpf = c.signatario_cpf ? formatarCpf(c.signatario_cpf) : "";
        const quando = c.assinado_em ? fmtDataHora(c.assinado_em) : "";
        legenda.innerHTML = "";
        legenda.append(document.createTextNode((nome || "Contratante") + (cpf ? " – CPF " + cpf : "")));
        legenda.append(document.createElement("br"));
        legenda.append(document.createTextNode("Assinado eletronicamente" + (quando ? " em " + quando : "")));
      }
    }
  }, []);

  /* ---------- render do documento ----------
     Roda com o container visível (tela ok) e DEPOIS de preencher os valores e
     esperar as imagens: paginar mede altura real em pixel. */
  useLayoutEffect(() => {
    const doc = documentoRef.current;
    if (!doc || !contrato || tela.tipo !== "ok") return;
    const token = ++renderTokenRef.current;

    doc.innerHTML = contrato.template_html || htmlContratoTemplate({ modo: "revisar" });

    const s: Snapshot = contrato.snapshot ?? {};
    const travado = contrato.status === "assinado";
    const total = Number(s.total) || 0;
    const entrada = s.entrada != null && s.entrada !== "" ? Number(s.entrada) : total * 0.3;
    snapshotRef.current = { ...s, total, entrada };
    travadoRef.current = travado;

    montaTabela(doc, Array.isArray(s.itens) ? s.itens : [], total);
    preencherCampo(doc, "noivo", s.noivo);
    preencherCampo(doc, "noiva", s.noiva);
    preencherCampo(doc, "cpf-noivo", s.cpf_noivo ? formatarCpf(s.cpf_noivo) : "");
    preencherCampo(doc, "cpf-noiva", s.cpf_noiva ? formatarCpf(s.cpf_noiva) : "");
    preencherCampo(doc, "endereco", s.endereco);
    preencherCampo(doc, "numero", s.numero);
    preencherCampo(doc, "bairro", s.bairro);
    preencherCampo(doc, "cidade", s.cidade);
    preencherCampo(doc, "complemento", s.complemento || "N/A");
    preencherCampo(doc, "estado", s.estado);
    preencherCampo(doc, "cep", s.cep);
    preencherCampo(doc, "tel-noivo", s.tel_noivo);
    preencherCampo(doc, "tel-noiva", s.tel_noiva);
    preencherCampo(doc, "data-formatada", dataEventoExtenso(s.data_evento));
    preencherCampo(doc, "local", s.local_evento);
    preencherCampo(doc, "horario", s.horario ? String(s.horario).slice(0, 5) : "");
    preencherCampo(doc, "valor-total", moeda(total));
    preencherCampo(doc, "valor-entrada", moeda(entrada));
    preencherCampo(doc, "cidade-assinatura", s.cidade);
    preencherCampo(doc, "data-assinatura", dataExtenso(new Date()));

    /* affordance de clique-pra-editar. cidade-assinatura e data-assinatura
       ficam de fora: são derivados (cidade e a data de hoje) */
    Object.keys(CAMPO_EDITAVEL).forEach((chave) => {
      doc.querySelectorAll<HTMLElement>('[data-campo="' + chave + '"]').forEach((span) => {
        span.classList.toggle("editavel", !travado);
      });
    });

    /* pacote/adicionais têm catálogo próprio: em vez de simular um campo de
       texto, aponta pro lugar certo. Só com o documento ainda editável. */
    const tabela = doc.querySelector("table");
    if (tabela && !travado) {
      const a = document.createElement("a");
      a.className = "link-itens-estudio";
      a.href = hrefCliente;
      a.textContent = "Editar pacote e itens na ficha do cliente →";
      tabela.parentNode?.insertBefore(a, tabela.nextSibling);
    }

    const jaConfirmado = contrato.jordan_confirmado_em && contrato.jordan_assinatura_dataurl
      ? contrato.jordan_assinatura_dataurl : null;
    carimbarAssinaturas(contrato, jaConfirmado);

    /* espera as imagens (logo, assinatura) antes de medir; se outra carga
       chegou no meio, esta desiste */
    const imgs = Array.from(doc.querySelectorAll("img"));
    Promise.all(imgs.map((i) => (i.complete ? Promise.resolve() : i.decode().catch(() => undefined))))
      .then(() => {
        if (renderTokenRef.current !== token || documentoRef.current !== doc) return;
        paginarDocumento(doc);
      });
  }, [contrato, tela.tipo, hrefCliente, carimbarAssinaturas]);

  /* confirmação feita agora (sem recarregar o documento): carimba na hora */
  useEffect(() => {
    if (contrato && confirmadoDataUrl) carimbarAssinaturas(contrato, confirmadoDataUrl);
  }, [confirmadoDataUrl, contrato, carimbarAssinaturas]);

  /* ---------- pad de assinatura manual ----------
     Criado na primeira vez que a aba manual abre e mantido até a tela fechar:
     trocar de aba não pode apagar um traço já desenhado. */
  const resizePadRef = useRef<(() => void) | null>(null);
  useEffect(() => {
    if (modo !== "manual" || padRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const pad = new SignaturePad(canvas, { penColor: "#1D1D1B", backgroundColor: "rgba(0,0,0,0)" });
    padRef.current = pad;
    const resize = () => {
      const ratio = Math.max(window.devicePixelRatio || 1, 1);
      canvas.width = canvas.offsetWidth * ratio;
      canvas.height = canvas.offsetHeight * ratio;
      canvas.getContext("2d")?.scale(ratio, ratio);
      pad.clear();
    };
    resizePadRef.current = resize;
    window.addEventListener("resize", resize);
    resize();
    if (imagemPendenteRef.current) {
      const valor = imagemPendenteRef.current;
      imagemPendenteRef.current = null;
      Promise.resolve(pad.fromDataURL(valor)).catch(() => { /* imagem salva corrompida */ });
    }
  }, [modo]);
  useEffect(() => () => {
    if (resizePadRef.current) window.removeEventListener("resize", resizePadRef.current);
    resizePadRef.current = null;
    padRef.current?.off();
    padRef.current = null;
  }, []);

  /* ---------- menu de opções: qualquer clique fora fecha ---------- */
  useEffect(() => {
    if (!menuAberto) return;
    const fechar = () => setMenuAberto(false);
    document.addEventListener("click", fechar);
    return () => document.removeEventListener("click", fechar);
  }, [menuAberto]);

  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => { if (e.key === "Escape") { setModalAberto(false); setMenuAberto(false); } };
    document.addEventListener("keydown", aoTeclar);
    return () => document.removeEventListener("keydown", aoTeclar);
  }, []);

  /* ---------- ações ---------- */

  async function confirmarAssinatura() {
    let dataurl: string;
    let nome: string;
    if (modo === "cursiva") {
      nome = nomeCursiva.trim() || nomeFotografo;
      dataurl = await cursivaParaDataUrl(nome);
    } else {
      if (!padRef.current || padRef.current.isEmpty()) {
        setAvisoConfirmar({ texto: "Desenhe a assinatura antes de confirmar.", tom: "erro" });
        return;
      }
      nome = nomeFotografo;
      dataurl = padRef.current.toDataURL("image/png");
    }
    setConfirmando(true);
    setAvisoConfirmar({ texto: "Confirmando..." });
    try {
      await api<{ ok?: boolean; erro?: string }>({
        acao: "confirmar-contrato", id: clienteId, tipoAssinatura: modo, assinaturaDataUrl: dataurl, nomeAssinatura: nome,
      });
      setAvisoConfirmar(SEM_MENSAGEM);
      setConfirmadoDataUrl(dataurl);
      /* confirmar é "assinei a minha parte", não "manda pro casal": quem
         envia pra Autentique é o botão abaixo, num clique só dele */
      void carregarLinkDoCasal(true);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      setAvisoConfirmar({ texto: !msg || msg === "Não foi possível completar a ação." ? "Não deu pra confirmar. Tente de novo." : msg, tom: "erro" });
    } finally {
      setConfirmando(false);
    }
  }

  async function baixarViaAssinada(token: string, aviso: (m: Mensagem) => void) {
    if (!token) return;
    setBaixando(true);
    aviso({ texto: "Preparando o arquivo..." });
    try {
      const r = await fetch("/api/assinatura?pdf=1&token=" + encodeURIComponent(token));
      const j = (await r.json()) as RespostaPdf;
      if (!r.ok || !j.pdf) throw new Error(j.erro || "falha");
      const bin = atob(j.pdf);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
      const a = document.createElement("a");
      a.href = url; a.download = j.arquivo || "Contrato assinado.pdf";
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      aviso(SEM_MENSAGEM);
    } catch (e) {
      const msg = e instanceof Error && e.message !== "falha" ? e.message : "Não deu pra baixar agora. Tente de novo.";
      aviso({ texto: msg, tom: "erro" });
    } finally {
      setBaixando(false);
    }
  }

  async function baixarPeloMenu() {
    setMenuAberto(false);
    /* contrato que passou pela Autentique baixa LÁ, no "Baixar arquivo" da
       página dela: é a via oficial, com o selo e a trilha deles. O download
       do nosso banco fica pros contratos velhos, assinados na tela antiga. */
    if (contrato?.autentique_id) {
      window.open(urlNoAutentique(contrato.autentique_id), "_blank", "noreferrer");
      return;
    }
    if (!contrato?.token) return;
    const ok = await confirmar({ titulo: "Baixar o contrato assinado?", texto: "O PDF com as duas assinaturas vai pro seu aparelho.", rotuloOk: "Baixar" });
    if (!ok) return;
    void baixarViaAssinada(contrato.token, setAvisoDoc);
  }

  async function cancelarContrato() {
    setMenuAberto(false);
    const ok = await confirmar({
      titulo: "Cancelar este contrato?",
      texto: "O casal não vai mais conseguir assinar pelo link atual.",
      rotuloOk: "Cancelar contrato",
      perigo: true,
    });
    if (!ok) return;
    try {
      await api<{ ok?: boolean; erro?: string }>({ acao: "cancelar-contrato", id: clienteId });
      router.push(hrefCliente);
    } catch (e) {
      setAvisoDoc({ texto: e instanceof Error && e.message ? e.message : "Não foi possível cancelar.", tom: "erro" });
    }
  }

  function copiarMensagem() {
    void copiarTexto(mensagemCasal).then((copiou) => {
      setAvisoLink(copiou
        ? { texto: "Mensagem copiada. É só colar pro casal.", tom: "ok" }
        : { texto: "Não consegui copiar sozinho, use o ícone ao lado do link." });
    });
  }
  function copiarSoLink() {
    void copiarTexto(linkCasal).then((copiou) => {
      setAvisoLink(copiou ? { texto: "Link copiado.", tom: "ok" } : { texto: "Não consegui copiar, selecione o link na mão.", tom: "erro" });
    });
  }

  /* ---------- derivados ---------- */

  const casal = [cliente.noivo, cliente.noiva].filter(Boolean).join(" e ");
  const status = contrato?.status ?? "rascunho";
  const assinadoPeloCasal = status === "assinado";
  const fotografoOk = !!contrato?.jordan_confirmado_em;
  const versao = contrato?.versao || 1;
  const podeCancelar = status !== "assinado" && status !== "cancelado";
  const fabVisivel = !!contrato && status !== "cancelado";
  /* o botão diz o PRÓXIMO passo, e desde a Autentique são três: assinar a
     minha parte, mandar pra assinatura, e depois copiar o link pro casal */
  const fabTexto = assinadoPeloCasal
    ? "Ver contrato assinado"
    : !confirmadoDataUrl
      ? "Assinar agora"
      : linkCasal ? "Copiar link do casal" : "Enviar pra assinatura";

  const eventos = contrato
    ? [
      { data: contrato.criado_em, titulo: "Contrato criado" },
      { data: contrato.jordan_confirmado_em, titulo: "Confirmado por você" },
      { data: contrato.enviado_em, titulo: "Enviado ao casal" },
      { data: contrato.visualizado_em, titulo: "Casal abriu o link" },
      { data: contrato.assinado_em, titulo: "Assinado pelo casal" },
    ].filter((e): e is { data: string; titulo: string } => !!e.data)
      .sort((a, b) => new Date(a.data).getTime() - new Date(b.data).getTime())
    : [];

  const textoCasal = assinadoPeloCasal ? "Assinado"
    : (status === "enviado" || status === "visualizado") ? "Aguardando" : "Pendente";

  /* O que a coluna lateral mostra. Fica aqui, e não dentro dela, porque é
     leitura do contrato: a tela do casal monta a mesma lista com as palavras
     dele ("entregue a você" em vez de "ao contratante"). */
  const assinantes: AssinanteLateral[] = [
    {
      nome: nomeFotografo,
      assinado: fotografoOk,
      situacao: fotografoOk ? "Assinado" : "Pendente",
      detalhes: [
        { rotulo: "Papel", valor: "Contratado (fotógrafo)" },
        ...(fotografoOk
          ? [
            { rotulo: "Forma", valor: contrato?.jordan_assinatura_tipo === "manual" ? "Traço manual" : "Nome em cursiva" },
            { rotulo: "Confirmado em", valor: fmtDataHora(contrato?.jordan_confirmado_em) },
          ]
          : [{ rotulo: "Status", valor: "Toque em \u201CAssinar agora\u201D, no canto da tela" }]),
      ],
    },
    {
      nome: casal || "Casal",
      assinado: assinadoPeloCasal,
      situacao: textoCasal,
      detalhes: [
        { rotulo: "Papel", valor: "Contratante" },
        ...(contrato?.snapshot?.email ? [{ rotulo: "E-mail", valor: contrato.snapshot.email }] : []),
        ...(assinadoPeloCasal
          ? [
            { rotulo: "Assinante", valor: contrato?.signatario_nome || "não informado" },
            ...(contrato?.signatario_cpf ? [{ rotulo: "CPF", valor: formatarCpf(contrato.signatario_cpf) }] : []),
            { rotulo: "Assinado em", valor: fmtDataHora(contrato?.assinado_em) },
          ]
          : contrato?.visualizado_em
            ? [{ rotulo: "Abriu o link em", valor: fmtDataHora(contrato.visualizado_em) }]
            : contrato?.enviado_em
              ? [{ rotulo: "Link enviado em", valor: fmtDataHora(contrato.enviado_em) }]
              : [{ rotulo: "Status", valor: "Ainda não recebeu o link" }]),
      ],
    },
  ];

  const auditoria: ItemAuditoria[] | null = assinadoPeloCasal && contrato
    ? [
      { rotulo: "Signatário", valor: contrato.signatario_nome || "não informado" },
      ...(contrato.signatario_cpf ? [{ rotulo: "CPF", valor: formatarCpf(contrato.signatario_cpf) }] : []),
      ...(contrato.signatario_email ? [{ rotulo: "E-mail", valor: contrato.signatario_email }] : []),
      {
        rotulo: "Verificação",
        valor: contrato.verificacao_metodo === "link-tokenizado"
          ? "Link exclusivo entregue ao contratante"
          : (contrato.verificacao_metodo || "não informado"),
      },
      { rotulo: "Endereço IP", valor: contrato.assinante_ip || "não registrado" },
      { rotulo: "Dispositivo", valor: contrato.assinante_ua || "não registrado", tecnico: true },
      { rotulo: "Hash SHA-256 do PDF", valor: contrato.doc_sha256 || "não informado", tecnico: true },
    ]
    : null;

  /* ---------- telas de estado ---------- */

  /* sem id na rota não tem o que carregar: erro derivado, sem passar por estado */
  const telaEfetiva: Tela = clienteId ? tela : { tipo: "erro", texto: "Link inválido." };

  if (telaEfetiva.tipo === "carregando") {
    return <div className="mx-auto max-w-[520px] py-20 text-center"><Estado texto="Carregando o contrato..." /></div>;
  }
  if (telaEfetiva.tipo === "erro") {
    const tela = telaEfetiva;
    return (
      <div className="mx-auto max-w-[520px] py-16">
        <Cartao className="text-center">
          <h2 className="m-0 mb-3 text-[26px] font-medium text-accent">Ops</h2>
          <p className="m-0 text-ink-soft">{tela.texto}</p>
          <p className="mt-4">
            <Link href={tela.sessao ? "/entrar" : hrefCliente} className="text-accent">
              {tela.sessao ? "Entrar de novo" : "← Voltar pra ficha do cliente"}
            </Link>
          </p>
        </Cartao>
      </div>
    );
  }

  return (
    <>
      <style>{CSS_DOCUMENTO}</style>

      <div className="xl:grid xl:grid-cols-[336px_minmax(0,1fr)] xl:items-start xl:gap-6">
        {/* Coluna de assinantes/histórico: a MESMA peça da tela do casal
            (components/LateralAssinantes). O que muda de lá pra cá é só o
            conteúdo e o topo do cartão. */}
        <LateralAssinantes
          aberta={sidebarAberta}
          aoFechar={() => setSidebarAberta(false)}
          topo={
            <Link
              href={hrefCliente}
              className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12.5px] text-ink-soft no-underline transition-colors hover:bg-line hover:text-accent"
              aria-label="Voltar pra ficha do cliente"
            >
              <ArrowLeft size={14} />
              Voltar
            </Link>
          }
          assinantes={assinantes}
          eventos={eventos.map((e) => ({ titulo: e.titulo, quando: fmtDataHora(e.data) }))}
          auditoria={auditoria}
        />

        {/* ---------- coluna principal ---------- */}
        <div className="min-w-0">
          <header className="mx-auto mb-4 w-full max-w-[794px]">
            <div className="flex items-start justify-between gap-4">
              <div className="flex min-w-0 items-start gap-2">
                {/* Esta tela roda SEM a moldura do app (ver `semNavegacao` no
                    AppShell), então o caminho de volta tem que ser dela. Até o
                    xl o "Voltar" da coluna lateral fica escondido na gaveta, e
                    sem esta seta só sobrava o gesto do sistema. Só o ícone,
                    como no resto do celular. */}
                <Link
                  href={hrefCliente}
                  aria-label="Voltar"
                  onClick={(ev) => {
                    if (ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return;
                    ev.preventDefault();
                    void voltarDaqui();
                  }}
                  className={`-ml-1.5 mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] text-ink-soft no-underline transition-colors xl:hidden hover:bg-line hover:text-accent`}
                >
                  <ArrowLeft size={18} />
                </Link>
              <div className="min-w-0">
                {/* No celular a frase inteira quebrava em quatro linhas e
                    empurrava o documento pra fora da primeira dobra. Ali ela
                    vira uma linha só, com o mesmo conteúdo em forma curta:
                    o que é (Contrato) e de quem (o casal). */}
                <h1 className="m-0 truncate text-[18px] font-bold leading-[1.3] tracking-[.01em] text-ink">
                  <span className="hidden md:inline">Contrato de Fotografia ({casal || "cliente sem nome"})</span>
                  <span className="md:hidden">Contrato{casal ? " · " + casal : ""}</span>
                </h1>
                <p className="m-0 mt-1.5 text-[12.5px] text-ink-soft">
                  {contrato?.criado_em ? "Criado em " + fmtData(contrato.criado_em) : ""}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Selo tom={TOM_STATUS[status]}>
                    <span className="inline-flex items-center gap-1 uppercase"><IconeStatus status={status} />{ROTULO_STATUS[status]}</span>
                  </Selo>
                  {versao > 1 ? <Selo><span className="uppercase">Versão {versao}</span></Selo> : null}
                </div>
              </div>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSidebarAberta(true)}
                  aria-label="Assinantes e histórico"
                  className={`inline-flex h-[38px] w-[38px] cursor-pointer items-center justify-center rounded-[10px] bg-soft text-ink-soft transition-colors xl:hidden hover:bg-line hover:text-accent`}
                >
                  <Users size={18} />
                </button>

                <div className="relative">
                  <button
                    type="button"
                    aria-haspopup="true"
                    aria-expanded={menuAberto}
                    aria-label="Opções"
                    onClick={(e) => { e.stopPropagation(); setMenuAberto((v) => !v); }}
                    className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12.5px] text-ink-soft transition-colors hover:bg-line hover:text-accent`}
                  >
                    Opções
                    <EllipsisVertical size={14} />
                  </button>

                  {/* no celular vira bottom sheet, com fundo escuro atrás */}
                  <div
                    className={"fixed inset-0 z-[70] bg-[rgba(29,29,27,.35)] transition-opacity duration-200 sm:hidden " +
                      (menuAberto ? "opacity-100" : "pointer-events-none opacity-0")}
                    onClick={() => setMenuAberto(false)}
                  />
                  <div
                    role="menu"
                    className={
                      "fixed inset-x-0 bottom-0 z-[80] flex flex-col rounded-t-[20px] bg-paper px-2.5 pb-[calc(10px+var(--sab))] pt-2.5 shadow-alta transition-transform duration-200 " +
                      "sm:absolute sm:inset-auto sm:right-0 sm:top-[calc(100%+8px)] sm:z-30 sm:min-w-[260px] sm:rounded-xl sm:p-1.5 sm:transition-none " +
                      (menuAberto ? "translate-y-0 sm:flex" : "pointer-events-none translate-y-full sm:hidden")
                    }
                  >
                    <span className="mx-auto mb-2.5 mt-1 block h-1 w-9 rounded-full bg-line sm:hidden" aria-hidden />
                    <ItemMenu onClick={() => { setMenuAberto(false); window.print(); }}>
                      <Download size={15} className="opacity-85" />
                      <span>Baixar rascunho em PDF</span>
                    </ItemMenu>
                    <ItemMenu
                      disabled={!assinadoPeloCasal}
                      title={assinadoPeloCasal ? undefined : "Disponível depois que os dois assinarem"}
                      onClick={() => void baixarPeloMenu()}
                    >
                      <FileCheck size={15} className="opacity-85" />
                      <span>{contrato?.autentique_id ? "Baixar na Autentique" : "Baixar contrato assinado"}</span>
                    </ItemMenu>
                    {contrato?.autentique_id ? (
                      /* link de verdade (e não botão): é saída pra fora do
                         app, abre em guia nova e o Jordan entra com a conta
                         dele. `noreferrer` porque é site de terceiro. */
                      <a
                        href={urlNoAutentique(contrato.autentique_id)}
                        target="_blank"
                        rel="noreferrer"
                        onClick={() => setMenuAberto(false)}
                        className="flex w-full cursor-pointer items-center gap-2.5 rounded-[10px] px-4 py-3.5 text-left text-[15px] text-ink no-underline transition-colors hover:bg-soft sm:py-2.5 sm:text-[13.5px]"
                      >
                        <ExternalLink size={15} className="opacity-85" />
                        <span>Abrir na Autentique</span>
                      </a>
                    ) : null}
                    {podeCancelar ? (
                      <ItemMenu perigo onClick={() => void cancelarContrato()}>
                        <X size={15} className="opacity-85" />
                        <span>Cancelar contrato</span>
                      </ItemMenu>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>

            {/* banner de rascunho: só enquanto o casal ainda não recebeu o link */}
            {status === "rascunho" ? (
              <div className="mt-3">
                <Aviso>
                  <Info size={16} className="mt-0.5 shrink-0 text-[#B99524]" strokeWidth={1.6} />
                  <span>Este contrato ainda é rascunho, você pode editar clicando nos campos. O casal só vê depois que você copiar e mandar o link.</span>
                </Aviso>
              </div>
            ) : null}
          </header>

          {/* O documento vive fora do React: innerHTML escrito no efeito acima,
              nunca filhos declarados aqui. */}
          <article ref={documentoRef} id="documento" className="folhas" />

          {/* selo de validação: só depois que o CASAL assina (doc_sha256 só
              existe nesse ponto). Sem QR nem "URL de validação" fingindo um
              serviço que este produto não opera: só o que a gente tem e pode
              provar. */}
          {assinadoPeloCasal && contrato?.doc_sha256 ? (
            <div className="mx-auto -mt-3.5 flex w-full max-w-[794px] items-center gap-3.5 bg-paper px-6 py-4 text-[11.5px] leading-[1.7] text-ink-soft shadow-alta">
              <ShieldCheck size={26} strokeWidth={1.6} className="shrink-0 text-accent" />
              <div>
                Assinado com assinatura eletrônica (MP 2.200-2/2001, art. 10, §2º)<br />
                Hash SHA-256 do PDF assinado: <strong className="break-all font-semibold text-ink">{contrato.doc_sha256}</strong><br />
                Assinado em {fmtDataHora(contrato.assinado_em)}
              </div>
            </div>
          ) : null}

          <div className="mx-auto mt-3 w-full max-w-[794px] px-[22px] text-right min-[960px]:px-[58px]">
            <Estado texto={avisoDoc.texto} tom={avisoDoc.tom} />
          </div>
        </div>
      </div>

      {/* ---------- FAB: a ação certa pro estado atual, sempre à mão ----------
          Com 6 ou 7 folhas de contrato, um botão no fim ficava enterrado. No
          celular sobe acima da barra de navegação do painel. */}
      {fabVisivel ? (
        <button
          type="button"
          onClick={() => setModalAberto(true)}
          className={
            "fixed bottom-[calc(76px+var(--sab))] right-[18px] z-[60] inline-flex cursor-pointer items-center gap-2 rounded-full bg-accent px-[22px] py-3.5 " +
            "text-[12.5px] uppercase tracking-[.08em] text-white shadow-[0_12px_30px_rgba(0,54,70,.28)] transition-[background,transform] duration-150 " +
            `md:bottom-7 md:right-7 hover:-translate-y-px hover:bg-accent-hover`
          }
        >
          <Pencil size={16} />
          <span>{fabTexto}</span>
        </button>
      ) : null}

      {/* ---------- modal de assinatura (bottom sheet no celular) ---------- */}
      <div
        className={"fixed inset-0 z-[70] bg-[rgba(29,29,27,.45)] transition-opacity duration-200 " +
          (modalAberto ? "opacity-100" : "pointer-events-none opacity-0")}
        onClick={() => setModalAberto(false)}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-assinatura"
        className={
          "fixed inset-x-0 bottom-0 z-[80] max-h-[88vh] overflow-y-auto rounded-t-[20px] bg-paper px-5 pb-[calc(20px+var(--sab))] pt-3.5 shadow-[0_24px_60px_rgba(0,0,0,.28)] transition-[opacity,transform] duration-200 " +
          "sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:max-h-[85vh] sm:w-[min(520px,92vw)] sm:rounded-2xl sm:px-[26px] sm:py-[30px] " +
          (modalAberto
            ? "translate-y-0 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:opacity-100"
            : "pointer-events-none translate-y-full sm:-translate-x-1/2 sm:-translate-y-[46%] sm:opacity-0")
        }
      >
        <span className="mx-auto mb-4 block h-1 w-9 rounded-full bg-line sm:hidden" aria-hidden />
        <button
          type="button"
          onClick={() => setModalAberto(false)}
          aria-label="Fechar"
          className={`absolute right-3.5 top-2.5 inline-flex h-[38px] w-[38px] cursor-pointer items-center justify-center rounded-[10px] bg-soft text-ink-soft transition-colors sm:top-3.5 hover:bg-line hover:text-accent`}
        >
          <X size={18} />
        </button>

        {confirmadoDataUrl ? (
          /* assinado: o link pro casal sai aqui mesmo. Não existe "assinar de
             novo": um contrato aceita UMA assinatura do fotógrafo e UMA do casal. */
          <div>
            <h2 id="titulo-assinatura" className="m-0 mb-1 pr-10 text-[20px] font-medium text-accent">
              {assinadoPeloCasal ? "Contrato assinado pelos dois ✓" : "Contrato assinado ✓"}
            </h2>
            <p className="m-0 mb-5 text-[13.5px] text-ink-soft">
              {assinadoPeloCasal
                ? "O casal já assinou. Baixe a via em PDF ou mande o link pra eles baixarem."
                : linkCasal
                  ? "O contrato já está com o casal. Mande o link por WhatsApp se quiser lembrar; a Autentique avisa quando eles assinarem."
                  : "Sua parte está assinada. Falta mandar pra assinatura do casal."}
            </p>
            <div className="rounded-xl bg-soft p-[18px] text-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={confirmadoDataUrl} alt="sua assinatura" className="mx-auto max-h-20 max-w-[280px]" />
            </div>

            {assinadoPeloCasal && contrato?.token ? (
              <>
                <Botao
                  className="mt-3.5 w-full"
                  disabled={baixando}
                  onClick={() => {
                    if (contrato.autentique_id) {
                      window.open(urlNoAutentique(contrato.autentique_id), "_blank", "noreferrer");
                      return;
                    }
                    void baixarViaAssinada(contrato.token, setAvisoBaixar);
                  }}
                >
                  {contrato.autentique_id ? "Ver contrato na Autentique" : "Baixar contrato assinado"}
                </Botao>
                <div className="mt-3"><Estado texto={avisoBaixar.texto} tom={avisoBaixar.tom} /></div>
              </>
            ) : null}

            {!linkCasal && !assinadoPeloCasal && confirmadoDataUrl ? (
              <>
                <Botao
                  className="mt-3.5 w-full"
                  disabled={!!avisoLink.texto}
                  onClick={() => void carregarLinkDoCasal()}
                >
                  Enviar pra assinatura
                </Botao>
                <p className="m-0 mt-2 text-[12.5px] leading-[1.5] text-ink-soft">
                  O contrato vai pra Autentique já assinado por você. O casal recebe o
                  pedido por e-mail, e o link também fica aqui pra mandar no WhatsApp.
                </p>
              </>
            ) : null}

            {linkCasal ? (
              <div className="mt-[18px]">
                <div className="relative">
                  <Campo readOnly value={linkCasal} aria-label="Link pro casal assinar" className="pr-10 text-[13px] text-ink-soft" />
                  <button
                    type="button"
                    onClick={copiarSoLink}
                    aria-label="Copiar link"
                    className={`absolute right-1.5 top-[7px] inline-flex h-[30px] w-[30px] cursor-pointer items-center justify-center rounded-[7px] text-ink-soft transition-colors hover:bg-line hover:text-ink`}
                  >
                    <Copy size={16} />
                  </button>
                </div>
                <Botao className="w-full" onClick={copiarMensagem}>
                  {linkDeViaAssinada ? "Copiar link da via pro casal" : "Copiar mensagem"}
                </Botao>
              </div>
            ) : null}
            <div className="mt-3"><Estado texto={avisoLink.texto} tom={avisoLink.tom} /></div>

            <Link href={hrefCliente} className={`mt-[18px] block text-center text-[13px] text-ink-soft no-underline hover:text-accent`}>
              {"← Voltar pra ficha do cliente"}
            </Link>
          </div>
        ) : (
          <div>
            <h2 id="titulo-assinatura" className="m-0 mb-1 pr-10 text-[20px] font-medium text-accent">Sua assinatura</h2>
            <p className="m-0 mb-5 text-[13.5px] text-ink-soft">Por padrão, seu nome em cursiva. Se preferir, desenhe a assinatura na mão.</p>

            {avisoPadrao ? (
              <div className="mb-4">
                <Aviso>
                  <TriangleAlert size={16} className="mt-px shrink-0 text-[#B99524]" />
                  <span>{avisoPadrao}</span>
                </Aviso>
              </div>
            ) : null}

            <div className="mb-[18px] flex gap-2">
              {([["cursiva", "Cursiva (nome)"], ["manual", "Assinar manualmente"]] as const).map(([chave, rotulo]) => (
                <button
                  key={chave}
                  type="button"
                  onClick={() => setModo(chave)}
                  className={
                    "flex-1 cursor-pointer rounded-[10px] px-2 py-[11px] text-[13px] tracking-[.03em] transition-colors " +
                    (modo === chave ? "bg-accent text-white" : `bg-soft text-ink-soft hover:bg-line`)
                  }
                >
                  {rotulo}
                </button>
              ))}
            </div>

            <div hidden={modo !== "cursiva"}>
              <Campo
                id="nome-cursiva"
                rotulo="Nome exibido na assinatura"
                value={nomeCursiva}
                onChange={(e) => setNomeCursiva(e.target.value)}
              />
              <div className="mb-4 rounded-xl bg-soft p-[22px] text-center">
                <span className={cursiva.className + " text-[38px] text-ink"}>{nomeCursiva.trim() || nomeFotografo}</span>
              </div>
            </div>

            <div hidden={modo !== "manual"}>
              <div className="relative mb-2 h-[180px] overflow-hidden rounded-xl bg-soft">
                <canvas ref={canvasRef} className="block h-full w-full touch-none" />
                <button
                  type="button"
                  onClick={() => padRef.current?.clear()}
                  className={`absolute right-2.5 top-2 cursor-pointer text-[12px] uppercase tracking-[.1em] text-ink-soft hover:text-accent`}
                >
                  Limpar
                </button>
              </div>
            </div>

            <Botao className="mt-3.5 w-full" disabled={confirmando} onClick={() => void confirmarAssinatura()}>
              Confirmar assinatura
            </Botao>
            <div className="mt-3"><Estado texto={avisoConfirmar.texto} tom={avisoConfirmar.tom} /></div>
          </div>
        )}
      </div>
    </>
  );
}

function ItemMenu({ perigo, className = "", children, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { perigo?: boolean }) {
  return (
    <button
      type="button"
      role="menuitem"
      className={
        "flex w-full cursor-pointer items-center gap-2.5 rounded-[10px] px-4 py-3.5 text-left text-[15px] transition-colors " +
        "sm:rounded-lg sm:px-3 sm:py-[9px] sm:text-[13.5px] disabled:cursor-not-allowed disabled:opacity-40 " +
        (perigo ? `bg-erro-tint text-erro hover:bg-[#F5D8D8]` : `text-ink hover:enabled:bg-soft`) +
        " " + className
      }
      {...props}
    >
      {children}
    </button>
  );
}

/*
  Assinatura do contrato pelo casal, /assinar?token=…
  Portado de `assinar.html` do estúdio do Jordan Santos. Tela que o CLIENTE
  do fotógrafo abre: sem AppShell, e a voz é a do estúdio em primeira pessoa
  do plural. É documento jurídico: o texto legal (aceite, base legal MP
  2.200-2/2001, selo de validação) foi copiado caractere por caractere.

  Fluxo: o fotógrafo gera o link no painel, o casal revisa o contrato aqui e
  assina. Assinatura eletrônica simples (MP 2.200-2/2001 art. 10 §2º). Dados
  vêm de GET /api/assinatura?token=; a assinatura é capturada com
  signature_pad (ou desenhada em cursiva num canvas) e enviada como PNG em
  POST {acao:"assinar"}. O PDF é montado no servidor.

  Decisões herdadas do original, que não devem ser redescobertas:
  - O #documento é HTML cru (template fixado neste contrato, ou o texto fixo
    em lib/contrato-template.ts), preenchido via [data-campo] e dividido em
    folhas A4 por MEDIÇÃO real (lib/documento-contrato). Vive fora do React.
  - Paginar precisa do container VISÍVEL, com os valores de verdade
    preenchidos e as imagens carregadas. A assinatura do fotógrafo entra no
    documento ANTES de paginar (no original entrava depois e podia vazar da
    última folha, que tem overflow:hidden).
  - Mesmo shell do painel (header + sidebar "Assinantes"/"Histórico" +
    folhas), sem edição inline e sem menu de opções. "Assinado" é o mesmo
    shell com selo de validação; só o painel de ação troca (assinar vs.
    baixar a via). A tela de sucesso logo após assinar é um take-over à
    parte, sem chrome.
  - Sem OTP: o fator de verificação é a posse do link exclusivo.
*/
"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ChangeEvent } from "react";
import SignaturePad from "signature_pad";
import { Check, Download, Eye, Pencil, Send, ShieldCheck, Users, X } from "lucide-react";
import { fonteCursiva, fonteSans, fonteSerif } from "@/lib/fontes-marca";
import { htmlContratoTemplate } from "@/lib/contrato-template";
import { LateralAssinantes, type AssinanteLateral, type ItemAuditoria } from "@/components/LateralAssinantes";
import {
  baixarPdfBase64, cursivaParaDataUrl, esperarImagens, fmtDataHora, formatarCpf,
  paginarDocumento, preencherContrato, type SnapshotContrato,
} from "@/lib/documento-contrato";

/* Nome do fotógrafo. Herdado do app original; o GET público de /api/assinatura
   não devolve perfil, e /api/config exige sessão. Quando o perfil chegar na
   resposta do contrato, é aqui que ele entra. */
const NOME_FOTOGRAFO = "Jordan Santos";

/* Texto do aceite: IDÊNTICO ao ACEITE_TEXTO gravado pela rota
   (src/app/api/assinatura/route.ts). O que o casal lê é o que fica no banco. */
const ACEITE_TEXTO =
  "Declaro que li e concordo com os termos deste contrato e reconheço a validade da " +
  "minha assinatura eletrônica realizada por este meio (MP 2.200-2/2001, art. 10, §2º).";

/* ---------- tipos (mesma forma que GET /api/assinatura devolve) ---------- */

type Meta = {
  status: string;
  versao?: number | null;
  criado_em?: string | null;
  enviado_em?: string | null;
  visualizado_em?: string | null;
  assinado_em?: string | null;
  jordan_confirmado_em?: string | null;
  jordan_assinatura_tipo?: string | null;
  signatario_nome?: string | null;
  signatario_cpf?: string | null;
  signatario_email?: string | null;
  assinante_ip?: string | null;
  assinante_ua?: string | null;
  doc_sha256?: string | null;
  verificacao_metodo?: string | null;
};

type RespostaGet = {
  status?: string;
  meta?: Meta;
  contrato?: SnapshotContrato;
  estudio?: { assinatura_jordan?: string | null };
  jordanAssinatura?: string | null;
  template_html?: string | null;
  erro?: string;
};
type RespostaPdf = { pdf?: string; arquivo?: string; erro?: string };

type Carga = {
  meta: Meta;
  dados: SnapshotContrato;
  /* a assinatura DESTE contrato (feita na revisão) manda sobre a padrão do estúdio */
  assinaturaJordan: string | null;
  templateHtml: string | null;
};

type Tela =
  | { tipo: "carregando" }
  | { tipo: "erro"; texto: string }
  | { tipo: "fluxo" }
  | { tipo: "sucesso" };

type Aviso = { texto: string; tom?: "ok" | "erro" };
const SEM_AVISO: Aviso = { texto: "" };

type ModoAssinatura = "cursiva" | "manual";

const ROTULO_STATUS: Record<string, string> = { enviado: "Enviado", visualizado: "Visualizado", assinado: "Assinado" };
const CLASSE_TAG_STATUS: Record<string, string> = { enviado: "pendente", visualizado: "info", assinado: "ok" };

function soDigitos(v: string): string { return v.replace(/\D/g, ""); }

function mascararCpf(valor: string): string {
  const digitos = soDigitos(valor).slice(0, 11);
  const padrao = "999.999.999-99";
  let out = "";
  let di = 0;
  for (let i = 0; i < padrao.length && di < digitos.length; i++) {
    if (padrao[i] === "9") { out += digitos[di]; di++; }
    else out += padrao[i];
  }
  return out;
}

/* ---------- carimbos no documento ---------- */

/* assinatura do fotógrafo: a que ele fez NESTE contrato, na revisão;
   server-side, funciona cross-device */
function aplicarAssinaturaJordan(doc: HTMLElement, img: string | null) {
  const area = doc.querySelector<HTMLElement>("#assinatura-jordan-area");
  if (!img || !area) return;
  area.innerHTML = "";
  const el = document.createElement("img");
  el.src = img;
  el.alt = "assinatura " + NOME_FOTOGRAFO;
  el.style.cssText = "max-height:80px;max-width:280px;display:block;margin:0 auto 6px";
  const legenda = document.createElement("p");
  legenda.className = "linha-ass";
  legenda.style.marginTop = "0";
  legenda.textContent = NOME_FOTOGRAFO + " – CONTRATADA";
  area.append(el, legenda);
}

/* Mostra no documento que o casal assinou. Só entra em cena reabrindo um
   link já assinado, com meta.signatario_* vindos do servidor: a IMAGEM da
   assinatura do casal não fica guardada, é carimbada no PDF e descartada. */
function marcarAssinaturaDoCasal(doc: HTMLElement, meta: Meta) {
  const bloco = doc.querySelector<HTMLElement>("#bloco-assinaturas");
  const legenda = bloco?.querySelector<HTMLElement>(".linha-ass");
  if (!legenda) return;
  const nome = meta.signatario_nome || "";
  const cpf = meta.signatario_cpf ? formatarCpf(meta.signatario_cpf) : "";
  const quando = meta.assinado_em ? fmtDataHora(meta.assinado_em) : "";
  legenda.innerHTML = "";
  legenda.append(document.createTextNode((nome || "Contratante") + (cpf ? " – CPF " + cpf : "")));
  legenda.append(document.createElement("br"));
  legenda.append(document.createTextNode("Assinado eletronicamente" + (quando ? " em " + quando : "")));
}

/* ---------- CSS ----------
   Portado do original com as regras da casa: nenhuma borda pra separar
   (sidebar, abas, cards e campos separam por fundo e sombra) e nenhum anel
   de foco. O interior do #documento é preservado como está (Times New
   Roman, tabela com grade, linha de assinatura): é conteúdo do documento,
   não UI, e por isso escapa da regra "sem borda". */
/* Tudo daqui vai numa CAMADA (@layer components), e isto não é detalhe.
   CSS sem camada vence QUALQUER utilitário do Tailwind, que mora em
   @layer utilities, por mais específico que o utilitário seja. Com a coluna
   de assinantes vinda do painel (feita de utilitários), o reset `.ass *` daqui
   comia o padding dela inteiro: o cartão do assinante nascia com 39px de
   altura. Dentro da camada, a ordem volta ao normal (components perde pra
   utilities) e cada peça manda na sua própria casa. */
const CSS = `
@layer components {
.ass{
  --sat:env(safe-area-inset-top,0px);--sab:env(safe-area-inset-bottom,0px);
  --paper:#FFFFFF;--ink:#1D1D1B;--ink-soft:#706F6F;--accent:#003646;--accent-deep:#4F6278;--noir:#1D1D1B;
  --cta:#E8622E;--cta-hover:#D14E1E;--line:#E8E1DC;--soft:#F6F3F0;--soft-foco:#EFEBE7;
  --erro:#A33B3B;--ok:#2E6B4F;--alerta:#9A7B1E;
  --sombra:0 10px 34px rgba(29,29,27,.14);
  --sombra-card:0 1px 2px rgba(29,29,27,.04),0 6px 16px rgba(29,29,27,.06);
  --serif:var(--fonte-serif),"Didot",Georgia,serif;
  --sans:var(--fonte-sans),"Helvetica Neue",sans-serif;
  --cursiva:var(--fonte-cursiva),"Segoe Script","Brush Script MT",cursive;
  /* só o TEXTO do contrato usa esta fonte: serifada clássica de documento
     jurídico, de propósito diferente da identidade da marca. O contrato em
     si deve parecer contrato, não peça de marketing. */
  --contrato:"Times New Roman",Times,Georgia,serif;
  /* A coluna de assinantes é um componente do painel e pinta com os tokens
     do brandbook (--color-alguma-coisa). Redefinidos aqui, ele veste a pele da marca
     sem saber que existe marca: papel quente, linha quente, o mesmo verde e
     o mesmo petróleo. É isto que deixa a peça ser uma só. */
  --color-paper:#FFFFFF;--color-ink:#1D1D1B;--color-ink-soft:#706F6F;
  --color-accent:#003646;--color-accent-tint:#EAF1F3;
  --color-line:#E8E1DC;--color-soft:#F6F3F0;
  --color-ok:#2E6B4F;--color-ok-tint:#EEF7F1;
  min-height:100dvh;background:var(--soft);color:var(--ink);font-family:var(--sans);
  font-weight:400;font-size:15px;line-height:1.6;-webkit-font-smoothing:antialiased;
}
.ass *{margin:0;padding:0;box-sizing:border-box}
.ass [hidden]{display:none !important}
.ass button{font:inherit;color:inherit;background:none;border:0;cursor:pointer}
.ass img{max-width:100%}

/* telas de estado isoladas (sem chrome) */
.ass .envelope-estado{max-width:520px;margin:0 auto;padding:calc(28px + var(--sat)) 18px calc(80px + var(--sab))}
.ass .estado{max-width:520px;margin:80px auto;text-align:center;padding:0 20px}
.ass .estado h2{font-family:var(--serif);font-weight:500;font-size:26px;color:var(--accent);margin-bottom:12px}
.ass .estado p{color:var(--ink-soft)}
.ass.tela-final .envelope-estado{min-height:100vh;min-height:100dvh;display:flex;align-items:center;justify-content:center;padding-top:calc(20px + var(--sat));padding-bottom:calc(20px + var(--sab))}
.ass.tela-final .estado{margin:0}
.ass .botao{display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:12px 20px;border-radius:999px;font-size:13px;letter-spacing:.14em;text-transform:uppercase;transition:opacity .2s ease,background .2s ease,filter .2s ease}
.ass .botao svg{width:16px;height:16px;flex-shrink:0}
.ass .botao-2{background:var(--accent);color:#fff}
@media (hover:hover){.ass .botao-2:hover{filter:brightness(.88)}}
.ass .botao-2:focus-visible{background:#0B4A5C}
.ass .botao-1{background:var(--noir);color:#fff;width:100%;margin-top:14px}
@media (hover:hover){.ass .botao-1:hover{opacity:.88}}
.ass .botao-1:focus-visible{background:#333331}
.ass .botao:disabled{opacity:.4;cursor:default}
.ass .aviso{font-size:13.5px;margin-top:12px;min-height:18px}
.ass .aviso.erro{color:var(--erro)}
.ass .aviso.ok{color:var(--ok)}

/* shell: row, a sidebar é irmã da coluna principal e vai até o topo */
/* Rolagem é da PÁGINA, como no painel: só assim a coluna lateral pode ser
   um cartão sticky com a altura do próprio conteúdo. Antes o shell tinha
   altura de tela e a área do documento rolava por dentro, o que obrigava a
   lateral a ser uma coluna de altura cheia. */
.ass .shell{padding:0 0 calc(40px + var(--sab))}
@media (min-width:1280px){
  .ass .shell{display:grid;grid-template-columns:336px minmax(0,1fr);align-items:start;gap:24px;padding:24px 24px calc(40px + var(--sab))}
}
.ass .coluna-principal{min-width:0}
.ass .topbar{padding:calc(18px + var(--sat)) 24px 16px}
.ass .topbar-inner{max-width:794px;margin:0 auto;width:100%;display:flex;align-items:flex-start;justify-content:space-between;gap:16px}
.ass .topbar-titulo h1{font-family:var(--serif);font-weight:500;font-size:18px;color:var(--ink);letter-spacing:.01em;line-height:1.3}
.ass .topbar-meta{margin-top:6px;font-size:12.5px;color:var(--ink-soft)}
.ass .topbar-tags{margin-top:8px;display:flex;flex-wrap:wrap;align-items:center;gap:8px}
.ass .tag{display:inline-flex;align-items:center;gap:5px;padding:3px 10px;border-radius:8px;background:var(--paper);font-size:10.5px;letter-spacing:.05em;text-transform:uppercase;color:var(--ink-soft)}
.ass .tag svg{width:11px;height:11px;flex-shrink:0}
.ass .tag.ok{color:var(--ok);background:#EEF7F1}
.ass .tag.pendente{color:var(--alerta);background:#FBF6E8}
.ass .tag.info{color:var(--accent);background:#EAF1F3}
.ass .btn-icone{width:38px;height:38px;border-radius:10px;background:var(--paper);display:inline-flex;align-items:center;justify-content:center;color:var(--ink-soft);flex-shrink:0;transition:background .15s,color .15s;box-shadow:var(--sombra-card)}
@media (hover:hover){.ass .btn-icone:hover{background:var(--line);color:var(--accent)}}
.ass .btn-icone:focus-visible{background:var(--line);color:var(--accent)}
.ass .btn-icone svg{width:18px;height:18px}
@media (min-width:1280px){.ass .btn-sidebar-mobile{display:none}}


/* área do documento */
.ass .documento-area{min-width:0;padding:30px 24px 60px}
/* barra de rolagem fina no documento, só aparece ao passar o mouse */
.ass .documento-area{scrollbar-width:thin;scrollbar-color:transparent transparent}
@media (hover:hover){.ass .documento-area:hover{scrollbar-color:var(--line) transparent}}

/* ---------- #documento: folha do contrato (preservado do original) ---------- */
.ass #documento{font-family:var(--contrato)}
.ass #documento.folhas{display:flex;flex-direction:column;align-items:center;gap:26px;max-width:none;padding:0}
.ass .folha{width:100%;max-width:794px;aspect-ratio:210/297;background:var(--paper);box-shadow:var(--sombra);padding:52px 58px 46px;position:relative;overflow:hidden}
.ass .pagina-numero{position:absolute;bottom:16px;right:22px;font-size:10px;letter-spacing:.05em;color:var(--ink-soft)}
.ass #documento .logo-contrato{display:block;margin:0 auto 14px;width:190px;height:auto}
.ass #documento h2{font-family:var(--contrato);font-weight:700;font-size:21px;letter-spacing:.06em;text-align:center;margin-bottom:26px}
.ass #documento h3{font-size:14.5px;font-weight:500;letter-spacing:.05em;margin:24px 0 10px}
.ass #documento .folha:first-child h3:first-child{margin-top:0}
.ass #documento p,.ass #documento li{font-size:13.6px;line-height:1.8;margin-bottom:10px;text-align:justify}
/* alinhamento escolhido no editor do modelo (classe .al-*). Sem classe =
   justificado, que é o padrão do contrato. */
.ass #documento .al-left{text-align:left}
.ass #documento .al-center{text-align:center}
.ass #documento .al-right{text-align:right}
.ass #documento .al-justify{text-align:justify}
.ass #documento ol,.ass #documento ul{padding-left:22px;margin-bottom:10px}
.ass #documento .campo{font-weight:500;border-bottom:1px solid var(--line);padding:0 4px;white-space:pre-wrap}
.ass #documento table{width:100%;border-collapse:collapse;margin:14px 0 18px;font-size:13.6px}
.ass #documento th,.ass #documento td{border:1px solid #C9C4BD;padding:8px 10px;text-align:left}
.ass #documento th{font-weight:500;letter-spacing:.08em;font-size:11.5px;text-transform:uppercase;background:#F6F3F0}
.ass #documento td.num{text-align:right;white-space:nowrap}
.ass #documento .assinaturas{margin-top:48px}
.ass #documento .assinaturas p{text-align:center;margin-bottom:40px}
.ass #documento .linha-ass{border-top:1px solid var(--ink);max-width:420px;margin:0 auto;padding-top:6px;text-align:center;font-size:12.5px}

/* selo de validação: só depois de assinado. Sem QR/URL de validação
   fingindo um serviço que este produto não roda; só o que dá pra provar de
   verdade: hash, base legal (MP 2.200-2/2001, não eIDAS), data. */
.ass .selo-validacao{width:100%;max-width:794px;margin:-14px auto 0;background:var(--paper);padding:16px 24px;font-size:11.5px;color:var(--ink-soft);line-height:1.7;display:flex;align-items:center;gap:14px;box-shadow:var(--sombra)}
.ass .selo-validacao svg{width:26px;height:26px;color:var(--accent);flex-shrink:0}
.ass .selo-validacao strong{color:var(--ink);font-weight:600;word-break:break-all}

/* botão flutuante + modal/sheet de assinatura */
.ass .assinar-fab{position:fixed;right:28px;bottom:28px;z-index:60;display:inline-flex;align-items:center;gap:9px;padding:14px 22px;border-radius:999px;background:var(--cta);color:#fff;font-size:12.5px;letter-spacing:.08em;text-transform:uppercase;box-shadow:0 12px 30px rgba(181,80,46,.35);transition:background .15s,transform .15s}
@media (hover:hover){.ass .assinar-fab:hover{background:var(--cta-hover);transform:translateY(-1px)}}
.ass .assinar-fab:focus-visible{background:var(--cta-hover)}
.ass .assinar-fab svg{width:16px;height:16px;flex-shrink:0}
.ass .modal-backdrop{position:fixed;inset:0;background:rgba(29,29,27,.45);z-index:70;opacity:0;pointer-events:none;transition:opacity .2s}
.ass .modal-backdrop.aberto{opacity:1;pointer-events:auto}
.ass .modal-assinatura{position:fixed;z-index:80;left:50%;top:50%;transform:translate(-50%,-46%);width:min(520px,92vw);max-height:85vh;overflow-y:auto;background:var(--paper);border-radius:16px;box-shadow:0 24px 60px rgba(0,0,0,.28);padding:30px 26px;opacity:0;pointer-events:none;transition:opacity .2s,transform .25s}
.ass .modal-assinatura.aberto{opacity:1;pointer-events:auto;transform:translate(-50%,-50%)}
.ass .modal-fechar{position:absolute;top:14px;right:14px;background:var(--soft);box-shadow:none}
.ass .sheet-alca{display:none}

/* painel de ação (assinatura / download) */
.ass .painel h2{font-family:var(--serif);font-weight:500;font-size:20px;color:var(--accent);margin-bottom:4px;padding-right:40px}
.ass .painel .sub{color:var(--ink-soft);font-size:13.5px;margin-bottom:20px}
.ass .grade2{display:grid;grid-template-columns:1fr 1fr;gap:14px 16px}
@media (max-width:560px){.ass .grade2{grid-template-columns:1fr}}
.ass .campo-form{display:flex;flex-direction:column}
.ass .campo-form label{font-size:12.5px;color:var(--ink-soft);margin-bottom:6px}
.ass .campo-form input{font:inherit;font-size:15px;color:var(--ink);background:var(--soft);border:0;border-radius:10px;padding:11px 13px;-webkit-appearance:none;appearance:none;transition:background .15s}
.ass .campo-form input::placeholder{color:var(--ink-soft);opacity:.6}
.ass .campo-form input:focus,.ass .campo-form input:focus-visible{outline:none;background:var(--soft-foco)}
.ass .aceite{display:flex;gap:10px;align-items:flex-start;margin:20px 0;font-size:13.5px;color:var(--ink);cursor:pointer;line-height:1.5}
.ass .aceite input{margin-top:3px;width:18px;height:18px;flex-shrink:0;accent-color:var(--accent)}
.ass .abas{display:flex;gap:8px;margin:18px 0 14px}
.ass .aba{flex:1;padding:11px;border-radius:10px;background:var(--soft);color:var(--ink-soft);font-size:13px;letter-spacing:.03em;transition:background .15s,color .15s}
@media (hover:hover){.ass .aba:hover{background:var(--line)}}
.ass .aba.ativa{background:var(--accent);color:#fff}
.ass .aba.ativa:focus-visible{background:var(--accent)}
.ass .preview-cursiva{border-radius:12px;background:var(--soft);padding:22px;text-align:center;min-height:110px;display:flex;align-items:center;justify-content:center}
.ass .preview-cursiva span{font-family:var(--cursiva);font-size:38px;color:var(--ink);line-height:1.3;word-break:break-word}
.ass .preview-cursiva .vazio{font-family:var(--sans);font-size:13.5px;color:var(--ink-soft)}
.ass .assina-area{margin:18px 0 8px}
.ass .assina-rot{font-size:12.5px;color:var(--ink-soft);margin-bottom:8px}
.ass .canvas-box{position:relative;border-radius:12px;background:var(--soft);height:180px;overflow:hidden}
.ass .canvas-box canvas{width:100%;height:100%;touch-action:none;display:block}
.ass .limpar-ass{position:absolute;top:8px;right:10px;font-size:12px;letter-spacing:.1em;text-transform:uppercase;color:var(--ink-soft)}
@media (hover:hover){.ass .limpar-ass:hover{color:var(--accent)}}
.ass .selo-seg{font-size:12px;color:var(--ink-soft);text-align:center;margin-top:16px;line-height:1.6}

/* ============================= MOBILE ============================= */
@media (max-width:1279px){
  .ass .documento-area{padding:20px 14px 50px}
  .ass .folha{padding:30px 22px 40px}
}
/* sheet de baixo pra cima: aqui é onde mais importa, o casal quase sempre
   assina pelo celular */
@media (max-width:640px){
  .ass .assinar-fab{right:18px;bottom:calc(18px + var(--sab))}
  .ass .modal-assinatura{left:0;right:0;top:auto;bottom:0;transform:translateY(100%);width:100%;max-width:none;border-radius:20px 20px 0 0;max-height:88vh;padding:14px 20px calc(20px + var(--sab))}
  .ass .modal-assinatura.aberto{transform:translateY(0)}
  .ass .sheet-alca{display:block;width:36px;height:4px;border-radius:99px;background:var(--line);margin:0 auto 16px}
  .ass .modal-fechar{top:10px}
}
/* iOS dá zoom ao focar campo com fonte menor que 16px e não desfaz sozinho */
@media (max-width:820px){.ass input,.ass select,.ass textarea{font-size:16px !important}}
}
`;

/* ============================================================ */

export function Assinar({ token }: { token: string }) {
  const [tela, setTela] = useState<Tela>({ tipo: "carregando" });
  const [carga, setCarga] = useState<Carga | null>(null);

  const [sidebarAberta, setSidebarAberta] = useState(false);
  const [modalAberto, setModalAberto] = useState(false);

  const [modo, setModo] = useState<ModoAssinatura>("cursiva");
  const [nome, setNome] = useState("");
  const [cpf, setCpf] = useState("");
  const [aceite, setAceite] = useState(false);
  const [padVazio, setPadVazio] = useState(true);
  const [assinando, setAssinando] = useState(false);
  const [baixando, setBaixando] = useState(false);
  const [avisoAssinar, setAvisoAssinar] = useState<Aviso>(SEM_AVISO);
  const [avisoBaixarSucesso, setAvisoBaixarSucesso] = useState<Aviso>(SEM_AVISO);
  const [avisoBaixarModal, setAvisoBaixarModal] = useState<Aviso>(SEM_AVISO);

  const documentoRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const padRef = useRef<SignaturePad | null>(null);
  const cpfRef = useRef<HTMLInputElement>(null);
  const caretRef = useRef<number | null>(null);
  const renderTokenRef = useRef(0);

  /* ---------- boot: obter o contrato ---------- */
  useEffect(() => {
    /* sem token não tem o que carregar: o erro é derivado no render (ver
       telaEfetiva), sem passar por estado */
    if (!token) return;
    let vivo = true;
    (async () => {
      try {
        const r = await fetch("/api/assinatura?token=" + encodeURIComponent(token));
        const j = (await r.json()) as RespostaGet;
        if (!vivo) return;
        if (!r.ok) {
          setTela({ tipo: "erro", texto: j.erro || "Não foi possível abrir este contrato." });
          return;
        }
        const meta: Meta = j.meta || { status: j.status || "" };
        const dados: SnapshotContrato = j.contrato || {};
        setCarga({
          meta,
          dados,
          assinaturaJordan: j.jordanAssinatura || j.estudio?.assinatura_jordan || null,
          templateHtml: j.template_html || null,
        });
        /* pré-preenche com quem estiver no contrato; pode ser só a noiva */
        setNome(dados.noivo || dados.noiva || "");
        setTela({ tipo: "fluxo" });
        if (document.fonts && document.fonts.load) void document.fonts.load("600 64px " + fonteCursiva.style.fontFamily);
      } catch {
        if (vivo) setTela({ tipo: "erro", texto: "Não foi possível abrir este contrato. Tente de novo." });
      }
    })();
    return () => { vivo = false; };
  }, [token]);

  /* ---------- render do documento ----------
     Roda com o container visível (tela fluxo) e DEPOIS de preencher os
     valores e esperar as imagens: paginar mede altura real em pixel. */
  useLayoutEffect(() => {
    const doc = documentoRef.current;
    if (!doc || !carga || tela.tipo !== "fluxo") return;
    const tk = ++renderTokenRef.current;

    /* texto do contrato: o FIXADO neste contrato (template_html) quando
       existir, senão o fixo de sempre; mesma regra do painel */
    doc.innerHTML = carga.templateHtml || htmlContratoTemplate({ modo: "assinar" });
    preencherContrato(doc, carga.dados);
    aplicarAssinaturaJordan(doc, carga.assinaturaJordan);
    if (carga.meta.status === "assinado") marcarAssinaturaDoCasal(doc, carga.meta);

    void esperarImagens(doc).then(() => {
      if (renderTokenRef.current !== tk || documentoRef.current !== doc) return;
      paginarDocumento(doc);
    });
  }, [carga, tela.tipo]);

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
    /* redimensionar limpa o traço (o buffer do canvas é recriado), como no
       original. O pad acabou de nascer vazio, então só o resize de verdade
       (evento de janela) precisa avisar o estado. */
    const redimensionar = () => {
      const ratio = Math.max(window.devicePixelRatio || 1, 1);
      canvas.width = canvas.offsetWidth * ratio;
      canvas.height = canvas.offsetHeight * ratio;
      canvas.getContext("2d")?.scale(ratio, ratio);
      pad.clear();
    };
    const aoRedimensionar = () => { redimensionar(); setPadVazio(true); };
    resizePadRef.current = aoRedimensionar;
    window.addEventListener("resize", aoRedimensionar);
    redimensionar();
    pad.addEventListener("endStroke", () => setPadVazio(pad.isEmpty()));
  }, [modo]);
  useEffect(() => () => {
    if (resizePadRef.current) window.removeEventListener("resize", resizePadRef.current);
    resizePadRef.current = null;
    padRef.current?.off();
    padRef.current = null;
  }, []);

  /* ---------- CPF com máscara, preservando o cursor ao editar no meio ---------- */
  function mudarCpf(ev: ChangeEvent<HTMLInputElement>) {
    const input = ev.target;
    const pos = input.selectionStart;
    const antes = input.value.length;
    const novo = mascararCpf(input.value);
    caretRef.current = pos !== null && pos < antes ? pos + (novo.length - antes) : null;
    setCpf(novo);
  }
  useLayoutEffect(() => {
    const c = caretRef.current;
    if (c !== null && cpfRef.current) {
      cpfRef.current.setSelectionRange(c, c);
      caretRef.current = null;
    }
  }, [cpf]);

  /* Escape fecha o modal e o drawer */
  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setModalAberto(false); setSidebarAberta(false); }
    };
    document.addEventListener("keydown", aoTeclar);
    return () => document.removeEventListener("keydown", aoTeclar);
  }, []);

  /* ---------- ações ---------- */

  function nomeArquivoPdf(): string {
    const casal = [carga?.dados.noivo, carga?.dados.noiva].filter(Boolean).join(" e ");
    return "Contrato assinado" + (casal ? " - " + casal : "") + ".pdf";
  }

  async function baixar(slot: "sucesso" | "modal") {
    const setAviso = slot === "sucesso" ? setAvisoBaixarSucesso : setAvisoBaixarModal;
    setBaixando(true);
    setAviso({ texto: "Preparando o arquivo..." });
    try {
      const r = await fetch("/api/assinatura?pdf=1&token=" + encodeURIComponent(token));
      const j = (await r.json()) as RespostaPdf;
      if (!r.ok || !j.pdf) throw new Error(j.erro || "falha");
      baixarPdfBase64(j.pdf, j.arquivo || nomeArquivoPdf());
      setAviso(SEM_AVISO);
    } catch (e) {
      const msg = e instanceof Error && e.message !== "falha"
        ? e.message
        : "Não deu pra baixar agora. Tente de novo ou fale com a gente pra pedir a via.";
      setAviso({ texto: msg, tom: "erro" });
    } finally {
      setBaixando(false);
    }
  }

  async function assinar() {
    const nomeLimpo = nome.trim();
    const cpfDigitos = soDigitos(cpf);
    let assinaturaImg: string;
    if (modo === "cursiva") {
      assinaturaImg = await cursivaParaDataUrl(nomeLimpo, fonteCursiva.style.fontFamily);
    } else {
      if (!padRef.current || padRef.current.isEmpty()) return;
      assinaturaImg = padRef.current.toDataURL("image/png");
    }
    setAssinando(true);
    setAvisoAssinar({ texto: "Registrando sua assinatura..." });
    try {
      const r = await fetch("/api/assinatura", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          acao: "assinar",
          token,
          aceite,
          assinaturaDataUrl: assinaturaImg,
          nomeSignatario: nomeLimpo,
          cpfSignatario: cpfDigitos,
        }),
      });
      const j = (await r.json().catch(() => ({}))) as { erro?: string };
      if (!r.ok) throw new Error(j.erro || "falha");
      setModalAberto(false);
      setTela({ tipo: "sucesso" });
      window.scrollTo(0, 0);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "falha";
      setAvisoAssinar({ texto: msg === "falha" ? "Não deu pra assinar agora. Tente de novo." : msg, tom: "erro" });
    } finally {
      setAssinando(false);
    }
  }

  /* ---------- derivados ---------- */

  const meta = carga?.meta;
  const dados = carga?.dados ?? {};
  const casal = [dados.noivo, dados.noiva].filter(Boolean).join(" e ");
  const jaAssinado = meta?.status === "assinado";
  const jordanOk = !!meta?.jordan_confirmado_em;
  const versao = meta?.versao || 1;
  const classeStatus = meta ? CLASSE_TAG_STATUS[meta.status] : undefined;

  const cpfDigitos = soDigitos(cpf);
  const assinaturaPronta = modo === "cursiva" ? !!nome.trim() : !padVazio;
  const podeAssinar = aceite && !!nome.trim() && (cpfDigitos.length === 0 || cpfDigitos.length === 11) && assinaturaPronta && !assinando;

  const eventos = meta
    ? [
      { data: meta.criado_em, titulo: "Contrato criado" },
      { data: meta.jordan_confirmado_em, titulo: "Confirmamos o contrato" },
      { data: meta.enviado_em, titulo: "Enviado a você" },
      { data: meta.visualizado_em, titulo: "Você abriu o link" },
      { data: meta.assinado_em, titulo: "Assinado por você" },
    ].filter((e): e is { data: string; titulo: string } => !!e.data)
      .sort((a, b) => new Date(a.data).getTime() - new Date(b.data).getTime())
    : [];

  /* O que a coluna lateral mostra. Mesma peça do painel, texto na voz do
     casal: aqui ele é "você", lá é "o contratante". */
  const assinantes: AssinanteLateral[] = [
    {
      nome: NOME_FOTOGRAFO,
      assinado: jordanOk,
      situacao: jordanOk ? "Assinado" : "Pendente",
      detalhes: [
        { rotulo: "Papel", valor: "Contratado (fotógrafo)" },
        { rotulo: "Forma", valor: meta?.jordan_assinatura_tipo === "manual" ? "Traço manual" : "Nome em cursiva" },
        ...(meta?.jordan_confirmado_em ? [{ rotulo: "Confirmado em", valor: fmtDataHora(meta.jordan_confirmado_em) }] : []),
      ],
    },
    {
      nome: casal || "Você",
      assinado: jaAssinado,
      situacao: jaAssinado ? "Assinado" : "Pendente",
      detalhes: [
        { rotulo: "Papel", valor: "Contratante" },
        ...(dados.email ? [{ rotulo: "E-mail", valor: dados.email }] : []),
        ...(jaAssinado
          ? [
            { rotulo: "Assinante", valor: meta?.signatario_nome || "não informado" },
            ...(meta?.signatario_cpf ? [{ rotulo: "CPF", valor: formatarCpf(meta.signatario_cpf) }] : []),
            { rotulo: "Assinado em", valor: fmtDataHora(meta?.assinado_em) },
          ]
          : [{ rotulo: "Status", valor: "Toque em \u201CAssinar agora\u201D, no canto da tela" }]),
      ],
    },
  ];

  const auditoria: ItemAuditoria[] | null = jaAssinado && meta
    ? [
      { rotulo: "Signatário", valor: meta.signatario_nome || "não informado" },
      ...(meta.signatario_cpf ? [{ rotulo: "CPF", valor: formatarCpf(meta.signatario_cpf) }] : []),
      ...(meta.signatario_email ? [{ rotulo: "E-mail", valor: meta.signatario_email }] : []),
      {
        rotulo: "Verificação",
        valor: meta.verificacao_metodo === "link-tokenizado"
          ? "Link exclusivo entregue a você"
          : (meta.verificacao_metodo || "não informado"),
      },
      { rotulo: "Endereço IP", valor: meta.assinante_ip || "não registrado" },
      { rotulo: "Dispositivo", valor: meta.assinante_ua || "não registrado", tecnico: true },
      { rotulo: "Hash SHA-256 do PDF", valor: meta.doc_sha256 || "não informado", tecnico: true },
    ]
    : null;

  /* ---------- telas de estado (sem chrome) ---------- */

  /* sem token na URL não tem o que carregar: erro derivado, sem passar por estado */
  const telaEfetiva: Tela = token ? tela : { tipo: "erro", texto: "Link inválido. Peça um link novo pra gente." };
  const telaFinal = telaEfetiva.tipo !== "fluxo";
  const raiz = `ass ${fonteSerif.variable} ${fonteSans.variable} ${fonteCursiva.variable}` + (telaFinal ? " tela-final" : "");

  if (telaEfetiva.tipo === "carregando") {
    return (
      <div className={raiz}>
        <style>{CSS}</style>
        <div className="envelope-estado"><div className="estado"><p>Carregando seu contrato...</p></div></div>
      </div>
    );
  }
  if (telaEfetiva.tipo === "erro") {
    return (
      <div className={raiz}>
        <style>{CSS}</style>
        <div className="envelope-estado">
          <div className="estado"><h2>Ops</h2><p>{telaEfetiva.texto}</p></div>
        </div>
      </div>
    );
  }
  if (telaEfetiva.tipo === "sucesso") {
    return (
      <div className={raiz}>
        <style>{CSS}</style>
        <div className="envelope-estado">
          <div className="estado">
            <h2>Assinado! 🤍</h2>
            <p>Recebemos sua assinatura e o contrato já está guardado com a gente. Será uma honra eternizar seu momento.</p>
            <button type="button" className="botao botao-2" style={{ marginTop: 20 }} disabled={baixando} onClick={() => void baixar("sucesso")}>
              <Download />
              Baixar contrato assinado
            </button>
            <p className={"aviso" + (avisoBaixarSucesso.tom ? " " + avisoBaixarSucesso.tom : "")}>{avisoBaixarSucesso.texto}</p>
          </div>
        </div>
      </div>
    );
  }

  /* ---------- fluxo: header + sidebar + documento ---------- */

  return (
    <div className={raiz}>
      <style>{CSS}</style>
      <div className="shell">
        {/* A MESMA coluna do painel (components/LateralAssinantes), vestida
            com a pele da marca pelos tokens redefinidos no `.ass`. */}
        <LateralAssinantes
          aberta={sidebarAberta}
          aoFechar={() => setSidebarAberta(false)}
          topo={
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src="/img/logo-principal-petroleo.png" alt="Jordan Santos Fotografia" className="block h-[26px] w-auto" />
          }
          assinantes={assinantes}
          eventos={eventos.map((e) => ({ titulo: e.titulo, quando: fmtDataHora(e.data) }))}
          auditoria={auditoria}
        />

        <div className="coluna-principal">
          <header className="topbar">
            <div className="topbar-inner">
              <div className="topbar-titulo">
                <h1>{casal ? "Contrato de Fotografia (" + casal + ")" : "Contrato de Fotografia"}</h1>
                <div className="topbar-meta">
                  <span>{meta?.criado_em ? "Criado em " + new Date(meta.criado_em).toLocaleDateString("pt-BR") : ""}</span>
                </div>
                <div className="topbar-tags">
                  {meta ? (
                    <span className={"tag" + (classeStatus ? " " + classeStatus : "")}>
                      <IconeStatus status={meta.status} />
                      <span>{ROTULO_STATUS[meta.status] || meta.status}</span>
                    </span>
                  ) : null}
                  {versao > 1 ? <span className="tag">Versão {versao}</span> : null}
                </div>
              </div>
              <button type="button" className="btn-icone btn-sidebar-mobile" aria-label="Assinantes e histórico" onClick={() => setSidebarAberta(true)}>
                <Users />
              </button>
            </div>
          </header>

          <main className="documento-area">
            {/* O documento vive fora do React: innerHTML escrito no efeito
                acima, nunca filhos declarados aqui. */}
            <article ref={documentoRef} id="documento" className="folhas" />

            {jaAssinado && meta?.doc_sha256 ? (
              <div className="selo-validacao">
                <ShieldCheck strokeWidth={1.6} />
                <div>
                  Assinado com assinatura eletrônica (MP 2.200-2/2001, art. 10, §2º)<br />
                  Hash SHA-256 do PDF assinado: <strong>{meta.doc_sha256}</strong><br />
                  Assinado em {fmtDataHora(meta.assinado_em)}
                </div>
              </div>
            ) : null}

            {/* Botão flutuante: com várias folhas de contrato, a ação de
                assinar/baixar não pode depender de rolar até o fim procurando. */}
            <button type="button" className="assinar-fab" onClick={() => setModalAberto(true)}>
              <Pencil />
              <span>{jaAssinado ? "Ver contrato assinado" : "Assinar agora"}</span>
            </button>

            <div className={"modal-backdrop" + (modalAberto ? " aberto" : "")} onClick={() => setModalAberto(false)} />
            <div className={"modal-assinatura" + (modalAberto ? " aberto" : "")} role="dialog" aria-modal="true" aria-labelledby="titulo-painel">
              <div className="sheet-alca" />
              <button type="button" className="btn-icone modal-fechar" aria-label="Fechar" onClick={() => setModalAberto(false)}>
                <X />
              </button>

              {jaAssinado ? (
                /* já assinado: baixar a via, em vez do formulário de assinar */
                <div className="painel">
                  <h2 id="titulo-painel">Contrato assinado ✓</h2>
                  <p className="sub">Este contrato já foi assinado e está guardado com a gente.</p>
                  <button type="button" className="botao botao-2" style={{ width: "100%" }} disabled={baixando} onClick={() => void baixar("modal")}>
                    <Download />
                    Baixar contrato assinado
                  </button>
                  <p className={"aviso" + (avisoBaixarModal.tom ? " " + avisoBaixarModal.tom : "")}>{avisoBaixarModal.texto}</p>
                </div>
              ) : (
                /* painel de assinatura do casal */
                <div className="painel">
                  <h2 id="titulo-painel">Sua assinatura</h2>
                  <p className="sub">Confira seus dados, aceite os termos e assine no quadro.</p>

                  <div className="grade2">
                    <div className="campo-form">
                      <label htmlFor="a-nome">Seu nome completo</label>
                      <input id="a-nome" type="text" autoComplete="name" value={nome} onChange={(e) => setNome(e.target.value)} />
                    </div>
                    <div className="campo-form">
                      <label htmlFor="a-cpf">Seu CPF (opcional)</label>
                      <input ref={cpfRef} id="a-cpf" type="text" inputMode="numeric" placeholder="000.000.000-00" maxLength={14} autoComplete="off" value={cpf} onChange={mudarCpf} />
                    </div>
                  </div>

                  <label className="aceite">
                    <input type="checkbox" id="a-aceite" checked={aceite} onChange={(e) => setAceite(e.target.checked)} />
                    <span>{ACEITE_TEXTO}</span>
                  </label>

                  <div className="abas">
                    <button type="button" className={"aba" + (modo === "cursiva" ? " ativa" : "")} onClick={() => setModo("cursiva")}>Usar meu nome</button>
                    <button type="button" className={"aba" + (modo === "manual" ? " ativa" : "")} onClick={() => setModo("manual")}>Assinar na mão</button>
                  </div>

                  <div hidden={modo !== "cursiva"}>
                    <div className="preview-cursiva">
                      {nome.trim()
                        ? <span>{nome.trim()}</span>
                        : <span className="vazio">Preencha seu nome completo acima pra ver a assinatura.</span>}
                    </div>
                  </div>

                  <div className="assina-area" hidden={modo !== "manual"}>
                    <div className="assina-rot">Assine com o dedo ou o mouse:</div>
                    <div className="canvas-box">
                      <canvas ref={canvasRef} />
                      <button type="button" className="limpar-ass" onClick={() => { padRef.current?.clear(); setPadVazio(true); }}>Limpar</button>
                    </div>
                  </div>

                  <button type="button" className="botao botao-1" disabled={!podeAssinar} onClick={() => void assinar()}>Assinar contrato</button>
                  <p className={"aviso" + (avisoAssinar.tom ? " " + avisoAssinar.tom : "")}>{avisoAssinar.texto}</p>
                  <p className="selo-seg">🔒 Assinatura eletrônica com link exclusivo, registro de data/hora, IP e dispositivo, e impressão digital (hash) do documento, conforme a MP 2.200-2/2001.</p>
                </div>
              )}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}

/* ---------- peças ---------- */

/* badge de status: ok = check, senão relógio ("waiting"); mesma lógica do painel */
function IconeStatus({ status }: { status: string }) {
  if (status === "enviado") return <Send strokeWidth={2} />;
  if (status === "visualizado") return <Eye strokeWidth={2} />;
  if (status === "assinado") return <Check strokeWidth={2.5} />;
  return null;
}


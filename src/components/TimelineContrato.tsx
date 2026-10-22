/*
  Cartão "Contrato" da ficha: a situação em uma frase (com a ação que a
  resolve), a linha do tempo deitada (criado → enviado → aberto →
  assinado, desde 22/10/2026), selo de versão, comprovante de
  assinatura (trilha de auditoria) e as ações de abrir o contrato / copiar o
  link do casal. Portado de preencherTimelineContrato() e
  desenharTrilhaAuditoria() do estudio.html.

  Decisões herdadas:
  - Só aparece quando existe contrato de verdade (o bloco antigo mostrava
    "Contrato criado" sempre marcado, mesmo sem nada gerado).
  - "Enviado" só marca com a data real do disparo, nunca deduzida do status.
  - O selo de versão só aparece da v2 em diante: a v1 é o estado normal.
  - "Copiar link" vale a partir da confirmação do fotógrafo e CONTINUA valendo
    depois de o casal assinar, quando o mesmo link vira a via deles.
  - O comprovante existe só depois que o casal assinou e sobrevive ao
    cancelamento: um contrato que chegou a ser assinado continua valendo.
  - "não registrado" é dito com todas as letras: inventar um "?" seria afirmar
    que existe um dado que ninguém tem.
*/
"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Check, ChevronDown, ChevronRight, CircleDashed, Copy, ExternalLink, Eye, FileCheck, FilePlus, FileText, Lock, Mail, Pencil, RotateCw, EllipsisVertical, Send } from "lucide-react";
import { Botao } from "./ui";
import { copiarTexto, fmtDataHora, mascarar, type Contrato } from "@/lib/ficha";


/* Tom do quadro de situação: a cor diz em que pé está antes de qualquer
   texto. Âmbar só quando o fotógrafo precisa agir; verde só no assinado. */
const TONS = {
  neutro: { caixa: "bg-soft", icone: "bg-paper text-ink-soft", titulo: "text-ink" },
  accent: { caixa: "bg-accent-tint", icone: "bg-accent text-white", titulo: "text-accent" },
  ok: { caixa: "bg-ok-tint", icone: "bg-ok text-white", titulo: "text-ok" },
  atencao: { caixa: "bg-[#FBF6E8]", icone: "bg-[#B7861F] text-white", titulo: "text-[#7A5A11]" },
} as const;

/* Casca comum ao cartão com contrato e ao "ainda sem contrato": cabeçalho
   no padrão dos cartões da ficha (SecaoFicha), sem colapsar, porque é o
   cartão de onde sai a próxima ação. */
function CascaContrato({ extra, children }: { extra?: ReactNode; children: ReactNode }) {
  return (
    <section className="mb-4 rounded-[22px] bg-paper p-5 md:px-6">
      <div className="mb-4 flex items-center gap-3">
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[13px] bg-accent-tint text-accent">
          <FileText size={16} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[14.5px] font-semibold leading-[1.3] text-ink">Contrato</span>
          <span className="block truncate text-[12.5px] leading-[1.4] text-ink-soft">Assinatura pela Autentique</span>
        </span>
        {extra}
      </div>
      {children}
    </section>
  );
}

function Situacao({ tom, Icone, titulo, texto, acao }: { tom: keyof typeof TONS; Icone: typeof Mail; titulo: string; texto?: ReactNode; acao?: { rotulo: string; aoClicar: () => void } }) {
  const t = TONS[tom];
  return (
    <div className={"flex items-start gap-3 rounded-2xl px-4 py-3.5 " + t.caixa}>
      <span className={"inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full " + t.icone}>
        <Icone size={15} />
      </span>
      <div className="min-w-0 pt-[1px]">
        <div className={"text-[15px] font-semibold leading-[1.3] " + t.titulo}>{titulo}</div>
        {texto ? <div className="mt-0.5 text-[12.5px] leading-[1.5] text-ink-soft">{texto}</div> : null}
        {/* a ação que resolve o recado mora no próprio recado */}
        {acao ? (
          <button type="button" onClick={acao.aoClicar}
            className={"mt-2 inline-flex cursor-pointer items-center gap-1 text-[13px] font-semibold underline-offset-2 hover:underline " + t.titulo}>
            {acao.rotulo} <ChevronRight size={14} />
          </button>
        ) : null}
      </div>
    </div>
  );
}

/** Ficha sem contrato ainda: o mesmo cartão, dizendo o próximo passo. */
export function ContratoVazio({ podeCriar, onCriar }: { podeCriar: boolean; onCriar: () => void }) {
  return (
    <CascaContrato>
      <Situacao tom="neutro" Icone={CircleDashed} titulo="Ainda sem contrato"
        texto={podeCriar ? "Monte o contrato, escolha o pacote e mande pro casal assinar." : "Salve o cliente pra montar o contrato."} />
      <Botao className="mt-4 w-full" disabled={!podeCriar} onClick={onCriar}>
        <FilePlus size={16} /> Criar contrato
      </Botao>
    </CascaContrato>
  );
}

export function TimelineContrato({
  contrato, onAbrirContrato, onEditarContrato, onTrocarEmail, onReenviarEmail, onCopiarLink, avisar,
}: {
  contrato: Contrato;
  onAbrirContrato: () => void;
  /** abre o editor do contrato (texto + campos), pra mexer depois de enviado */
  onEditarContrato?: () => void;
  /** e-mail do casal errado num contrato já enviado (ver ModalTrocarEmail) */
  onTrocarEmail?: () => void;
  /** manda de novo pro mesmo e-mail (casal não recebeu, caixa cheia...) */
  onReenviarEmail?: () => void;
  onCopiarLink: () => void;
  avisar: (texto: string, opts?: { ok?: boolean }) => void;
}) {
  const versao = contrato.versao || 1;
  const jaAssinado = contrato.status === "assinado";
  const jaLiberado = contrato.status === "enviado" || contrato.status === "visualizado";
  const assinadoFotografo = !!contrato.jordan_confirmado_em;
  const cancelado = contrato.status === "cancelado";
  const precisaReconfirmar = jaLiberado && !assinadoFotografo && !jaAssinado;
  const editadoDepois = !!contrato.autentique_id && !!contrato.alterado_desde_envio && !jaAssinado;

  const email = statusDoEmail(contrato.autentique_email);
  const aguardandoCasal = !!contrato.autentique_id && (contrato.status === "enviado" || contrato.status === "visualizado");

  /* A SITUAÇÃO vem primeiro e em uma frase: é a pergunta com que se abre
     a ficha ("e aí, assinaram?"). A linha do tempo embaixo é o detalhe. */
  const situacao: { tom: keyof typeof TONS; Icone: typeof Mail; titulo: string; texto?: ReactNode; acao?: { rotulo: string; aoClicar: () => void } } =
    cancelado ? { tom: "neutro", Icone: CircleDashed, titulo: "Contrato cancelado" }
    : jaAssinado ? { tom: "ok", Icone: FileCheck, titulo: "Assinado pelo casal", texto: contrato.assinado_em ? "Em " + fmtDataHora(contrato.assinado_em) : undefined }
    : editadoDepois || precisaReconfirmar ? { tom: "atencao", Icone: Pencil, titulo: "Você editou depois de enviar", texto: "O casal ainda vê a versão anterior. Atualize na Autentique pra mandar a nova.", acao: onEditarContrato && contrato.editavel ? { rotulo: "Abrir o editor", aoClicar: onEditarContrato } : undefined }
    : email?.erro ? { tom: "atencao", Icone: Mail, titulo: "O e-mail não chegou", texto: email.texto, acao: onTrocarEmail ? { rotulo: "Trocar e-mail e reenviar", aoClicar: onTrocarEmail } : undefined }
    : contrato.status === "visualizado" ? { tom: "accent", Icone: Eye, titulo: "O casal abriu, falta assinar", texto: contrato.visualizado_em ? "Aberto em " + fmtDataHora(contrato.visualizado_em) : undefined }
    : contrato.status === "enviado" ? { tom: "accent", Icone: Send, titulo: "Esperando o casal assinar", texto: email?.texto ?? (contrato.enviado_em ? "Enviado em " + fmtDataHora(contrato.enviado_em) : undefined) }
    : { tom: "neutro", Icone: FileText, titulo: "Rascunho, ainda não enviado", texto: "Abra, ajuste o texto e clique em “Assinar e enviar”." };

  const passos: { titulo: string; data: string | null | undefined; ok?: boolean }[] = [
    { titulo: "Criado", data: contrato.criado_em },
    { titulo: "Enviado", data: contrato.enviado_em },
    { titulo: "Aberto", data: contrato.visualizado_em },
    { titulo: "Assinado", data: contrato.assinado_em, ok: true },
  ];
  const curta = (d: string) => new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" });

  return (
    <CascaContrato extra={
      <>
        {versao > 1 ? (
          <span className="rounded-full bg-soft px-2.5 py-0.5 text-[11.5px] font-semibold text-ink-soft">Versão {versao}</span>
        ) : null}
        <MenuDoContrato itens={[
          /* já foi pra Autentique e o casal ainda não assinou: dá pra voltar
             no texto (o editor troca o documento ao atualizar) */
          contrato.autentique_id && contrato.editavel && onEditarContrato
            ? { rotulo: contrato.alterado_desde_envio ? "Atualizar contrato" : "Editar contrato", Icone: Pencil, acao: onEditarContrato }
            : null,
          aguardandoCasal && onReenviarEmail ? { rotulo: "Reenviar pro mesmo e-mail", Icone: RotateCw, acao: onReenviarEmail } : null,
          aguardandoCasal && onTrocarEmail ? { rotulo: "Trocar e-mail e reenviar", Icone: Mail, acao: onTrocarEmail } : null,
        ]} />
      </>
    }>
      <Situacao {...situacao} />

      {/* Linha do tempo DEITADA: quatro marcos com a data curta embaixo.
          Era uma coluna de cinco passos que ocupava meia tela pra dizer o
          que a frase de cima já diz. "Confirmado" saiu: com a Autentique o
          fotógrafo assina no mesmo clique em que envia. */}
      {!cancelado ? (
        <ol className="m-0 mt-5 grid list-none grid-cols-4 p-0">
          {passos.map((p, i) => {
            const feito = !!p.data;
            const proximoFeito = !!passos[i + 1]?.data;
            return (
              <li key={p.titulo} className="relative flex flex-col items-center text-center">
                {i < passos.length - 1 ? (
                  <span aria-hidden className={"absolute left-1/2 top-[11px] h-0.5 w-full " + (proximoFeito ? "bg-accent" : "bg-line")} />
                ) : null}
                <span className={"relative z-[1] inline-flex h-6 w-6 items-center justify-center rounded-full " +
                  (feito ? (p.ok ? "bg-ok text-white" : "bg-accent text-white") : "bg-soft text-ink-soft")}>
                  {feito ? <Check size={13} strokeWidth={3} /> : <span className="h-1.5 w-1.5 rounded-full bg-ink-soft/40" />}
                </span>
                <span className={"mt-1.5 text-[12px] font-medium " + (feito ? "text-ink" : "text-ink-soft")}>{p.titulo}</span>
                <span className="text-[11.5px] tabular-nums text-ink-soft" title={p.data ? fmtDataHora(p.data) : undefined}>
                  {p.data ? curta(p.data) : "—"}
                </span>
              </li>
            );
          })}
        </ol>
      ) : null}

      {contrato.assinado_em ? <TrilhaAuditoria contrato={contrato} avisar={avisar} /> : null}

      {!cancelado ? (
        <div className="mt-5 flex flex-wrap gap-2.5 [&>*]:min-h-[44px] [&>*]:flex-[1_1_100%] [&>*]:whitespace-nowrap min-[520px]:[&>*]:flex-[1_1_150px]">
          {/* Rótulos curtos: a coluna é estreita e "Abrir contrato assinado"
              quebrava em duas linhas dentro do botão. */}
          {assinadoFotografo || jaAssinado ? (
            <Botao onClick={onCopiarLink}>
              <Copy size={16} />
              Copiar link
            </Botao>
          ) : null}
          <Botao variante="secundario" className="text-accent" onClick={onAbrirContrato}>
            {jaAssinado ? <FileCheck size={16} /> : <FileText size={16} />}
            {contrato.autentique_id || jaAssinado ? "Abrir contrato" : "Abrir rascunho"}
            <ExternalLink size={14} className="opacity-60" />
          </Botao>
        </div>
      ) : null}
    </CascaContrato>
  );
}

/* ---------- comprovante de assinatura ----------
   O contrato assinado afirma, em texto, que IP, dispositivo e hash SHA-256
   "ficam preservados no sistema do fotógrafo". Antes viviam só no banco,
   alcançáveis por SQL; aqui viram algo que dá pra abrir e copiar. É o
   equivalente ao "Certificate of Completion" do DocuSign. */

function valorOuNada(v: unknown): string | null {
  const s = (v == null ? "" : String(v)).trim();
  /* contratos antigos gravavam "?" quando o IP não vinha; mostrar isso faria
     passar por valor uma informação que ninguém tem */
  return s === "" || s === "?" ? null : s;
}

function TrilhaAuditoria({ contrato, avisar }: { contrato: Contrato; avisar: (texto: string, opts?: { ok?: boolean }) => void }) {
  const [aberta, setAberta] = useState(false);

  const fmt = (d: string) =>
    new Date(d).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }) + " (horário de Brasília)";

  const linhas: { rotulo: string; valor: string | null; tecnico?: boolean }[] = [
    { rotulo: "Signatário", valor: valorOuNada(contrato.signatario_nome) },
    { rotulo: "CPF", valor: contrato.signatario_cpf ? mascarar(contrato.signatario_cpf, "999.999.999-99") : null },
    { rotulo: "E-mail", valor: valorOuNada(contrato.signatario_email) },
    { rotulo: "Data e hora", valor: contrato.assinado_em ? fmt(contrato.assinado_em) : null },
    {
      rotulo: "Verificação",
      valor: contrato.verificacao_metodo === "link-tokenizado"
        ? "Posse do link exclusivo, que entregamos ao casal"
        : valorOuNada(contrato.verificacao_metodo),
    },
    { rotulo: "Endereço IP", valor: valorOuNada(contrato.assinante_ip), tecnico: true },
    { rotulo: "Dispositivo", valor: valorOuNada(contrato.assinante_ua), tecnico: true },
    { rotulo: "Impressão digital (SHA-256)", valor: valorOuNada(contrato.doc_sha256), tecnico: true },
    { rotulo: "Aceite", valor: valorOuNada(contrato.aceite_texto) },
  ];

  const texto =
    "COMPROVANTE DE ASSINATURA ELETRÔNICA\n" +
    "Contrato de Prestação de Serviços de Fotografia\n\n" +
    linhas.map((l) => l.rotulo + ": " + (l.valor ?? "não registrado")).join("\n") +
    "\n\nA impressão digital confere com o arquivo PDF assinado: rodando" +
    "\nSHA-256 sobre a via baixada, o valor tem que ser idêntico ao acima." +
    "\nQualquer alteração no documento muda esse número.";

  async function copiar() {
    const ok = await copiarTexto(texto);
    avisar(ok ? "Comprovante copiado" : "Não consegui copiar", { ok });
  }

  return (
    <div className="mt-4 rounded-xl bg-soft px-3.5 py-3.5">
      <button
        type="button"
        onClick={() => setAberta((v) => !v)}
        aria-expanded={aberta}
        className={`flex w-full cursor-pointer items-center gap-2 rounded-lg p-0 text-left text-[13px] font-medium text-accent hover:text-accent-hover`}
      >
        <Lock size={15} className="shrink-0" aria-hidden />
        <span className="flex-1">Comprovante de assinatura</span>
        <ChevronDown size={15} className={"shrink-0 transition-transform duration-200 " + (aberta ? "rotate-180" : "")} aria-hidden />
      </button>

      {aberta ? (
        <div>
          <dl className="m-0 mt-3 text-[12.5px] leading-[1.55]">
            {linhas.map((l) => (
              <Linha key={l.rotulo} rotulo={l.rotulo} tecnico={l.tecnico}>{l.valor}</Linha>
            ))}
          </dl>
          <Botao variante="secundario" className="mt-3 w-full text-accent" onClick={copiar}>
            <Copy size={16} />
            Copiar comprovante
          </Botao>
          <p className="m-0 mt-2.5 text-[11.5px] leading-[1.5] text-ink-soft">
            Guarde este comprovante se o contrato for questionado: ele liga a assinatura ao signatário e prova que o arquivo não foi alterado.
          </p>
        </div>
      ) : null}
    </div>
  );
}

function Linha({ rotulo, tecnico, children }: { rotulo: string; tecnico?: boolean; children: ReactNode }) {
  return (
    <>
      <dt className="mt-2 text-ink-soft first:mt-0">{rotulo}</dt>
      <dd className={"m-0 break-words " + (children ? (tecnico ? "font-mono text-[11.5px] text-ink" : "text-ink") : "italic text-ink-soft")}>
        {children ?? "não registrado"}
      </dd>
    </>
  );
}

/* ---------- e-mail da Autentique ----------
   A Autentique manda o e-mail de assinatura e conta o que houve com ele
   (signatures.email_events, sincronizado em contratos.autentique_email). As
   datas vêm sem fuso, no horário do documento, que é o de Brasília. */

type EventosEmail = NonNullable<Contrato["autentique_email"]>;

function dataDaAutentique(v: string): string {
  return v.includes("T") ? v : v.replace(" ", "T") + "-03:00";
}

/** motivo técnico do provedor → o que o fotógrafo precisa saber */
function motivoLegivel(motivo: string | null): string {
  const m = (motivo || "").toLowerCase();
  if (/storage|quota|full|cheia/.test(m)) return "a caixa de entrada do casal está cheia";
  if (/does not exist|unknown|no such user|5\.1\.1|not found|invalid/.test(m)) return "esse e-mail não existe";
  if (/spam|blocked|block/.test(m)) return "o provedor do casal bloqueou o e-mail";
  return "o provedor do casal recusou o e-mail";
}

function statusDoEmail(ev: EventosEmail | null | undefined): { texto: string; erro?: boolean } | null {
  if (!ev) return null;
  if (ev.refused) return { texto: "E-mail voltou: " + motivoLegivel(ev.reason) + ". Confira o e-mail ou mande o link pelo WhatsApp.", erro: true };
  if (ev.opened) return { texto: "E-mail aberto em " + fmtDataHora(dataDaAutentique(ev.opened)) };
  if (ev.delivered) return { texto: "E-mail entregue em " + fmtDataHora(dataDaAutentique(ev.delivered)) };
  if (ev.sent) return { texto: "E-mail enviado, esperando a entrega" };
  return null;
}

/* ---------- menu do cartão ----------
   As ações de exceção (editar depois de enviado, reenviar, trocar e-mail)
   moram aqui, no mesmo ⋮ do topo da ficha, pra a linha de botões ficar só
   com o caminho de todo dia: copiar o link e abrir o contrato. */

type ItemMenu = { rotulo: string; Icone: typeof Mail; acao: () => void };

function MenuDoContrato({ itens }: { itens: (ItemMenu | null | false)[] }) {
  const [aberto, setAberto] = useState(false);
  const caixa = useRef<HTMLDivElement>(null);
  const lista = itens.filter((i): i is ItemMenu => !!i);

  useEffect(() => {
    if (!aberto) return;
    function fora(ev: PointerEvent) {
      if (!caixa.current?.contains(ev.target as Node)) setAberto(false);
    }
    document.addEventListener("pointerdown", fora);
    return () => document.removeEventListener("pointerdown", fora);
  }, [aberto]);

  if (!lista.length) return null;
  return (
    <div ref={caixa} className="relative">
      <button type="button" aria-label="Mais ações do contrato" aria-haspopup="true" aria-expanded={aberto}
        onClick={() => setAberto((v) => !v)}
        className={"inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-[10px] text-ink-soft transition-colors hover:bg-line hover:text-ink " +
          (aberto ? "bg-line text-ink" : "bg-soft")}>
        <EllipsisVertical size={16} />
      </button>
      {aberto ? (
        <div role="menu" className="absolute right-0 top-10 z-[6] min-w-[236px] rounded-xl bg-paper p-1.5 shadow-alta">
          {lista.map(({ rotulo, Icone, acao }) => (
            <button key={rotulo} type="button" role="menuitem" onClick={() => { setAberto(false); acao(); }}
              className="flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-[11px] py-[9px] text-left text-[13.5px] text-ink hover:bg-soft">
              <Icone size={15} className="opacity-85" />
              {rotulo}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

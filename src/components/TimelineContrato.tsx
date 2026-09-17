/*
  Painel "Assinatura do Contrato" da ficha: timeline de status (criado →
  confirmado → enviado → visualizado → assinado), selo de versão, comprovante de
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

import { useState, type ReactNode } from "react";
import { Check, ChevronDown, CircleDashed, Copy, ExternalLink, FileCheck, FileText, Lock } from "lucide-react";
import { Botao } from "./ui";
import { copiarTexto, fmtDataHora, mascarar, type Contrato } from "@/lib/ficha";


export function TimelineContrato({
  contrato, onAbrirContrato, onCopiarLink, avisar,
}: {
  contrato: Contrato;
  onAbrirContrato: () => void;
  onCopiarLink: () => void;
  avisar: (texto: string, opts?: { ok?: boolean }) => void;
}) {
  const versao = contrato.versao || 1;
  const jaAssinado = contrato.status === "assinado";
  const jaLiberado = contrato.status === "enviado" || contrato.status === "visualizado";
  const assinadoFotografo = !!contrato.jordan_confirmado_em;
  const cancelado = contrato.status === "cancelado";
  const precisaReconfirmar = jaLiberado && !assinadoFotografo && !jaAssinado;

  const passos: { titulo: string; data: string | null | undefined; ok?: boolean }[] = [
    { titulo: "Contrato criado", data: contrato.criado_em },
    { titulo: "Confirmado", data: contrato.jordan_confirmado_em },
    { titulo: "Enviado ao casal", data: contrato.enviado_em },
    { titulo: "Visualizado", data: contrato.visualizado_em },
    { titulo: "Assinado", data: contrato.assinado_em, ok: true },
  ];

  return (
    /* Card branco como os vizinhos da coluna. No estúdio original este bloco
       era `soft` sobre uma página BRANCA, e ali isso já o destacava; aqui a
       página é que é soft, então a receita se inverteu e ele sumia no fundo —
       o Ricardo perguntou cadê o card. Mesmo raio, padding e sombra do
       SecaoFicha ao lado, pra a coluna ter uma linguagem só. */
    <div className="rounded-[22px] bg-paper px-6 py-6 shadow-card">
      <div className="mb-4 flex items-center gap-2.5">
        <h3 className="m-0 flex-1 text-sm font-semibold text-accent">Assinatura do Contrato</h3>
        {versao > 1 ? (
          <span className="rounded-full bg-paper px-2.5 py-0.5 text-[11.5px] font-semibold text-ink-soft shadow-card">
            Versão {versao}
          </span>
        ) : null}
      </div>

      <ol className="m-0 list-none p-0 text-[13.5px]">
        {passos.map((p, i) => {
          const concluido = !!p.data;
          const ultimo = i === passos.length - 1;
          return (
            <li key={p.titulo} className={"relative flex gap-3 " + (ultimo ? "" : "pb-3.5")}>
              {/* linha conectora entre os badges */}
              {!ultimo ? (
                <span
                  aria-hidden
                  className={"absolute bottom-0.5 left-[13px] top-7 w-0.5 rounded-sm " + (concluido ? "bg-accent" : "bg-line")}
                />
              ) : null}
              <span
                className={
                  "relative z-[1] inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full " +
                  (concluido ? (p.ok ? "bg-ok text-white" : "bg-accent text-white") : "bg-paper text-ink-soft")
                }
              >
                {concluido ? <Check size={14} /> : <CircleDashed size={14} />}
              </span>
              <div className="min-w-0 pt-[3px]">
                <div className={"font-medium leading-[1.35] " + (concluido ? "text-ink" : "text-ink-soft")}>{p.titulo}</div>
                <div className="mt-0.5 text-[12.5px] text-ink-soft">{p.data ? fmtDataHora(p.data) : "Pendente"}</div>
              </div>
            </li>
          );
        })}
      </ol>

      {contrato.assinado_em ? <TrilhaAuditoria contrato={contrato} avisar={avisar} /> : null}

      {!cancelado ? (
        <div className="mt-[18px]">
          {!(assinadoFotografo || jaAssinado) ? (
            <p className="m-0 mb-2.5 text-[12.5px] leading-[1.5] text-ink-soft">
              {precisaReconfirmar
                ? "O contrato foi editado depois de enviado, assine de novo pra liberar a versão atualizada pro casal."
                : "Abra o contrato e assine pra liberar o link do casal."}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2.5 [&>*]:min-h-[42px] [&>*]:flex-[1_1_100%] min-[520px]:[&>*]:flex-[1_1_150px]">
            {/* Rótulos curtos: a coluna é estreita e "Abrir contrato assinado"
                quebrava em duas linhas dentro do botão. O que o rótulo deixou
                de dizer está dito em volta — a timeline logo acima mostra se
                foi assinado, e o ícone muda junto (FileCheck x FileText). */}
            {assinadoFotografo || jaAssinado ? (
              <Botao onClick={onCopiarLink}>
                <Copy size={16} />
                Copiar link
              </Botao>
            ) : null}
            <Botao variante="secundario" className="text-accent" onClick={onAbrirContrato}>
              {jaAssinado ? <FileCheck size={16} /> : <FileText size={16} />}
              {jaAssinado ? "Abrir contrato" : "Abrir rascunho"}
              <ExternalLink size={14} className="opacity-60" />
            </Botao>
          </div>
        </div>
      ) : null}
    </div>
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
    <div className="mt-4 rounded-xl bg-paper px-3.5 py-3.5">
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

/*
  Pop-up de "contrato assinado por você e pronto pro casal". Abre na ficha do
  cliente logo depois do "Assinar e enviar" (ou do "Atualizar na Autentique")
  do editor do contrato, que volta pra cá com `?enviado=`.

  Duas caixas com o "Copiar" do lado: o link sozinho e a mensagem pronta (que
  já leva o link). O link da Autentique é um por pessoa e serve em qualquer
  canal, então o fotógrafo cola onde quiser (WhatsApp, e-mail, direct). "Ver contrato" leva pro documento no
  painel da Autentique, que é a fonte da verdade da assinatura.

  A Autentique está em entrega POR LINK (ver lib/autentique.ts): ela não manda
  e-mail sozinha, então é daqui que o contrato sai pro casal.

  Mesma casca do ModalConfirmar (fundo com desfoque, cartão de 440px, ícone em
  pill inline com o título).
*/
"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, CircleCheck, Copy, ExternalLink, TriangleAlert, X } from "lucide-react";
import { copiarTexto } from "@/lib/ficha";

export type DadosEnviado = {
  link: string;
  /** mensagem pronta pro casal, com o link dentro */
  mensagem: string;
  /** endereço do documento no painel da Autentique */
  urlContrato: string;
  /** o documento foi trocado (edição depois de enviado): o link mudou */
  atualizado: boolean;
  /** quando o motivo é outro (troca de e-mail), título e texto próprios */
  titulo?: string;
  texto?: string;
};

export function ModalContratoEnviado({ dados, onFechar }: { dados: DadosEnviado; onFechar: () => void }) {
  const [copiado, setCopiado] = useState<"link" | "mensagem" | "erro" | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") onFechar(); };
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("keydown", esc); if (timer.current) clearTimeout(timer.current); };
  }, [onFechar]);

  async function copiar(oque: "link" | "mensagem") {
    const ok = await copiarTexto(oque === "link" ? dados.link : dados.mensagem);
    setCopiado(ok ? oque : "erro");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopiado(null), 2200);
  }

  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-5" role="dialog" aria-modal="true" aria-label="Contrato pronto pro casal">
      <div className="absolute inset-0 bg-[rgba(29,29,27,.5)] backdrop-blur-[2px]" onClick={onFechar} />
      <div className="relative z-[1] w-full max-w-[440px] rounded-[18px] bg-paper p-8 pb-6 shadow-alta">
        <button type="button" onClick={onFechar} aria-label="Fechar"
          className="absolute right-4 top-4 inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-[10px] text-ink-soft hover:bg-soft hover:text-ink">
          <X size={16} />
        </button>

        <h3 className="m-0 mb-3 flex items-center gap-3 pr-8 text-[22px] font-semibold leading-[1.25] text-ink">
          <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-ok-tint text-ok">
            <CircleCheck size={17} />
          </span>
          {dados.titulo ?? (dados.atualizado ? "Contrato atualizado" : "Assinado por você")}
        </h3>
        <p className="m-0 text-[14.5px] leading-[1.6] text-ink-soft">
          {dados.texto ?? (dados.atualizado
            ? "A versão nova já está na Autentique com a sua assinatura."
            : "Sua assinatura já está na Autentique. Agora é com o casal: copie a mensagem e mande por onde preferir.")}
        </p>
        {/* o recado que não pode passar batido: âmbar translúcido, mesmo tom
            do <Aviso> do kit */}
        {dados.atualizado ? (
          <p className="m-0 mt-3.5 flex items-start gap-2.5 rounded-[10px] bg-[rgba(234,179,8,.14)] px-3.5 py-3 text-[13px] leading-[1.55] text-[#7A5A11]">
            <TriangleAlert size={16} className="mt-px shrink-0 text-[#B99524]" aria-hidden />
            <span>O link mudou: mande este pro casal, o anterior não vale mais.</span>
          </p>
        ) : null}

        {/* o link sozinho, com o Copiar do lado */}
        <div className="mt-4 flex items-center gap-2 rounded-[10px] bg-soft py-1 pl-3.5 pr-1">
          <input type="text" readOnly value={dados.link} aria-label="Link pro casal assinar"
            className="min-w-0 flex-1 bg-transparent py-2 text-[13px] text-ink outline-none" onFocus={(e) => e.target.select()} />
          <BotaoCopiar copiado={copiado === "link"} rotulo="Copiar link" onClick={() => void copiar("link")} />
        </div>

        {/* a mensagem pronta (já com o link), com o Copiar no canto */}
        <div className="relative mt-2.5 rounded-[10px] bg-soft py-3 pl-3.5 pr-[104px]">
          <p className="m-0 whitespace-pre-line break-words text-[13px] leading-[1.55] text-ink">{dados.mensagem}</p>
          <div className="absolute right-1 top-1">
            <BotaoCopiar copiado={copiado === "mensagem"} rotulo="Copiar mensagem" onClick={() => void copiar("mensagem")} />
          </div>
        </div>

        {copiado === "erro" ? (
          <p className="m-0 mt-2 text-[12.5px] text-erro">Não consegui copiar. Selecione o texto e copie à mão.</p>
        ) : null}

        <div className="mt-6 flex flex-col-reverse gap-2.5 sm:flex-row">
          <button type="button" onClick={onFechar}
            className="inline-flex h-11 cursor-pointer items-center justify-center rounded-xl bg-soft px-5 text-sm font-semibold text-ink transition-colors hover:bg-line sm:flex-1">
            Fechar
          </button>
          <a href={dados.urlContrato} target="_blank" rel="noreferrer"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-accent px-5 text-sm font-semibold text-white no-underline transition-colors hover:bg-accent-hover sm:flex-1">
            <ExternalLink size={15} /> Ver contrato
          </a>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/* "Copiar" com ícone e texto, que vira "Copiado" em verde por um instante */
function BotaoCopiar({ copiado, rotulo, onClick }: { copiado: boolean; rotulo: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-label={rotulo} title={rotulo}
      className={"inline-flex h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-[9px] px-2.5 text-[12.5px] font-medium transition-colors " +
        (copiado ? "text-ok" : "text-ink-soft hover:bg-line hover:text-accent")}>
      {copiado ? <Check size={15} /> : <Copy size={15} />}
      {copiado ? "Copiado" : "Copiar"}
    </button>
  );
}

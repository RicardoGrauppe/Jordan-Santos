/*
  Pop-up de "contrato assinado por você e pronto pro casal". Abre na ficha do
  cliente logo depois do "Assinar e enviar" (ou do "Atualizar na Autentique")
  do editor do contrato, que volta pra cá com `?enviado=`.

  Um botão só: copiar a mensagem pronta, que já leva o link. O link da
  Autentique é um por pessoa e serve em qualquer canal, então o fotógrafo cola
  onde quiser (WhatsApp, e-mail, direct). "Ver contrato" leva pro documento no
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
};

export function ModalContratoEnviado({ dados, onFechar }: { dados: DadosEnviado; onFechar: () => void }) {
  const [copiado, setCopiado] = useState<"ok" | "erro" | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") onFechar(); };
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("keydown", esc); if (timer.current) clearTimeout(timer.current); };
  }, [onFechar]);

  async function copiar() {
    const ok = await copiarTexto(dados.mensagem);
    setCopiado(ok ? "ok" : "erro");
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
          {dados.atualizado ? "Contrato atualizado" : "Assinado por você"}
        </h3>
        <p className="m-0 text-[14.5px] leading-[1.6] text-ink-soft">
          {dados.atualizado
            ? "A versão nova já está na Autentique com a sua assinatura."
            : "Sua assinatura já está na Autentique. Agora é com o casal: copie a mensagem e mande por onde preferir."}
        </p>
        {/* o recado que não pode passar batido: âmbar translúcido, mesmo tom
            do <Aviso> do kit */}
        {dados.atualizado ? (
          <p className="m-0 mt-3.5 flex items-start gap-2.5 rounded-[10px] bg-[rgba(234,179,8,.14)] px-3.5 py-3 text-[13px] leading-[1.55] text-[#7A5A11]">
            <TriangleAlert size={16} className="mt-px shrink-0 text-[#B99524]" aria-hidden />
            <span>O link mudou: mande este pro casal, o anterior não vale mais.</span>
          </p>
        ) : null}

        {/* a mensagem que vai ser copiada, à vista, e o botão de copiar */}
        <div className="mt-4 rounded-[12px] bg-soft p-3.5">
          <p className="m-0 whitespace-pre-line break-words text-[13px] leading-[1.55] text-ink">{dados.mensagem}</p>
        </div>
        <button type="button" onClick={() => void copiar()}
          className={"mt-2.5 inline-flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-xl text-sm font-semibold transition-[background-color,color,scale] duration-150 active:scale-[.98] " +
            (copiado === "ok" ? "bg-ok-tint text-ok" : "bg-accent-tint text-accent hover:bg-[#dfe9ec]")}>
          {copiado === "ok" ? <Check size={16} /> : <Copy size={16} />}
          {copiado === "ok" ? "Mensagem copiada" : "Copiar mensagem com o link"}
        </button>
        {copiado === "erro" ? (
          <p className="m-0 mt-2 text-[12.5px] text-erro">Não consegui copiar. Selecione o texto acima e copie à mão.</p>
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

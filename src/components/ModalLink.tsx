/*
  Pop-up com o link do contrato pro casal. Portado de abrirModalLink() do
  estudio.html: o link vai pelo WhatsApp, na mão do fotógrafo, então o modal
  já abre avisando que a mensagem foi copiada e mantém o botão de copiar como
  segunda chance, se o navegador tiver barrado.

  Depois de assinado o mesmo link deixa de ser "assine aqui" e passa a ser a
  via do casal (abre a tela de baixar o PDF). O texto muda junto.

  O banner "contrato liberado" só aparece na PRIMEIRA liberação (o status era
  rascunho antes). Quem volta pra recopiar o mesmo link não vê o banner.
*/
"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Copy, Info, Send, X } from "lucide-react";
import { copiarTexto } from "@/lib/ficha";


export type DadosLink = {
  link: string;
  mensagem: string;
  assinado: boolean;
  /** primeira liberação de verdade: mostra o banner */
  primeiraLiberacao: boolean;
  /** já foi pra área de transferência no clique que abriu o modal */
  jaCopiou: boolean;
};

export function ModalLink({ dados, onFechar }: { dados: DadosLink; onFechar: () => void }) {
  const [copiou, setCopiou] = useState<boolean | null>(dados.jaCopiou ? true : null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const campoRef = useRef<HTMLInputElement>(null);

  function marcar(ok: boolean) {
    setCopiou(ok);
    if (!ok) { campoRef.current?.focus(); campoRef.current?.select(); return; }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopiou(null), 2500);
  }

  useEffect(() => {
    if (dados.jaCopiou) timer.current = setTimeout(() => setCopiou(null), 2500);
    function tecla(ev: KeyboardEvent) { if (ev.key === "Escape") onFechar(); }
    document.addEventListener("keydown", tecla);
    return () => {
      document.removeEventListener("keydown", tecla);
      if (timer.current) clearTimeout(timer.current);
    };
  }, [dados.jaCopiou, onFechar]);

  async function copiar() {
    marcar(await copiarTexto(dados.mensagem || dados.link));
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-5" role="dialog" aria-modal="true" aria-label="Link do contrato">
      <div className="absolute inset-0 bg-[rgba(29,29,27,.5)] backdrop-blur-[2px]" onClick={onFechar} />
      <div className="relative z-[1] w-full max-w-[440px] rounded-[18px] bg-paper p-8 pb-6 ">
        <button
          type="button"
          onClick={onFechar}
          aria-label="Fechar"
          className={`absolute right-4 top-4 inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-[10px] text-ink-soft hover:bg-soft hover:text-ink`}
        >
          <X size={16} />
        </button>

        <h3 className="m-0 mb-3.5 flex items-center gap-3 pr-8 text-[22px] font-semibold leading-[1.25] text-ink">
          <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-accent-tint text-accent">
            <Send size={16} />
          </span>
          {dados.assinado ? "Link da via assinada" : "Link pro casal assinar"}
        </h3>

        <p className="m-0 text-[14.5px] leading-[1.6] text-ink-soft">
          {dados.assinado
            ? "O contrato já está assinado. Mande este link se o casal pedir a via, por ele dá pra baixar o PDF assinado quantas vezes precisar."
            : "Mande este link pro casal. Quem tem o link consegue assinar, então mande direto pra eles."}
        </p>

        <div className="mt-4 flex items-center gap-2 rounded-[10px] bg-soft py-1 pl-3.5 pr-1">
          <input
            ref={campoRef}
            type="text"
            readOnly
            value={dados.link}
            aria-label="Link pro casal"
            className="min-w-0 flex-1 bg-transparent py-2 text-[13px] text-ink outline-none"
            onFocus={(e) => e.target.select()}
          />
          <button
            type="button"
            onClick={copiar}
            aria-label="Copiar mensagem"
            title="Copiar mensagem"
            className={
              "inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-[9px] transition-colors " +
              (copiou ? "text-ok" : `text-ink-soft hover:bg-line hover:text-accent`)
            }
          >
            {copiou ? <Check size={16} /> : <Copy size={16} />}
          </button>
        </div>

        {dados.primeiraLiberacao ? (
          <div className="mt-3.5 flex items-start gap-2.5 rounded-[10px] bg-accent-tint px-3.5 py-3 text-[13px] leading-[1.55] text-accent">
            <Info size={16} className="mt-px shrink-0" aria-hidden />
            <span>Contrato liberado. A partir de agora, qualquer edição na ficha vai gerar uma nova versão e vai pedir sua reconfirmação.</span>
          </div>
        ) : null}

        <p className={"m-0 mt-3 min-h-[18px] text-[12.5px] " + (copiou === false ? "text-ink-soft" : "text-ok")}>
          {copiou === true ? "Mensagem copiada" : copiou === false ? "Não consegui copiar, selecione o link e copie na mão." : ""}
        </p>
      </div>
    </div>
  );
}

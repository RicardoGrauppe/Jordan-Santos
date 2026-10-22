/*
  Campo da ficha com botão de copiar dentro (CPF, e-mail, endereço...) e, nos
  telefones, o botão de abrir conversa no WhatsApp. Portado de estudio.html
  (.campo-copiar e .campo-tel): o fotógrafo copia o dado direto da ficha.

  O <Campo> do kit continua sendo o padrão pra campo simples; este existe só
  pelos dois botões, que o kit não tem onde encaixar.
*/
"use client";

import { useRef, useState, type InputHTMLAttributes, type ReactNode } from "react";
import { Check, Copy } from "lucide-react";
import { copiarTexto, soDigitos } from "@/lib/ficha";


const BASE_CAMPO =
  "h-11 w-full rounded-[10px] bg-soft px-3.5 text-sm text-ink placeholder:text-ink-soft/70 " +
  "outline-none transition-colors focus:bg-[#EEF0F3] read-only:text-ink-soft";

function IconeWhatsApp() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" width={18} height={18} aria-hidden>
      <path d="M12 2a9.9 9.9 0 0 0-8.5 15.1L2 22l5-1.3A9.9 9.9 0 1 0 12 2zm0 18.1c-1.5 0-2.9-.4-4.2-1.1l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.1zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1-.2.3-.7.8-.8 1-.1.1-.3.2-.5.1-.3-.1-1.1-.4-2-1.2-.8-.7-1.3-1.5-1.4-1.8-.2-.3 0-.4.1-.5l.4-.5c.1-.2.2-.3.3-.5 0-.2 0-.3 0-.5 0-.1-.6-1.4-.8-1.9-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.4.1-.7.3-.2.3-.9.9-.9 2.1s.9 2.5 1 2.6c.1.2 1.8 2.7 4.3 3.8.6.3 1.1.4 1.4.5.6.2 1.2.2 1.6.1.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.1-1.2 0-.1-.2-.2-.4-.3z" />
    </svg>
  );
}

export function CampoCopiavel({
  rotulo, id, value, copiavel = true, whatsapp = false, avisar, acao, className = "", ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, "value"> & {
  rotulo: string;
  id: string;
  value: string;
  copiavel?: boolean;
  whatsapp?: boolean;
  /** toast: "CPF copiado", "E-mail está vazio" */
  avisar: (texto: string, opts?: { ok?: boolean }) => void;
  /** botão extra colado à direita do campo, no lugar do WhatsApp dos telefones */
  acao?: ReactNode;
}) {
  const [copiou, setCopiou] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function copiar() {
    const texto = value.trim();
    if (!texto) { avisar(rotulo + " está vazio"); return; }
    const ok = await copiarTexto(texto);
    if (!ok) { avisar("Não consegui copiar, selecione e copie na mão"); return; }
    avisar(rotulo + " copiado", { ok: true });
    setCopiou(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopiou(false), 1800);
  }

  const digitos = soDigitos(value);
  const wppPronto = digitos.length >= 8;

  function abrirWhatsApp() {
    if (!wppPronto) { inputRef.current?.focus(); return; }
    window.open("https://wa.me/" + digitos, "_blank", "noopener");
  }

  return (
    <div className="mb-3.5">
      <label htmlFor={id} className="mb-1.5 block text-[12.5px] font-medium text-ink-soft">{rotulo}</label>
      <div className="flex items-stretch gap-2">
        <div className="relative min-w-0 flex-1">
          <input
            ref={inputRef}
            id={id}
            value={value}
            autoComplete="off"
            className={BASE_CAMPO + (copiavel ? " pr-10 " : " ") + className}
            {...props}
          />
          {copiavel ? (
            <button
              type="button"
              onClick={copiar}
              aria-label={"Copiar " + rotulo.toLowerCase()}
              title="Copiar"
              className={
                "absolute right-1 top-1/2 inline-flex h-[30px] w-[30px] -translate-y-1/2 cursor-pointer items-center justify-center rounded-[9px] transition-colors " +
                (copiou ? "text-ok" : `text-ink-soft hover:bg-line hover:text-accent`)
              }
            >
              {copiou ? <Check size={15} /> : <Copy size={15} />}
            </button>
          ) : null}
        </div>
        {whatsapp ? (
          <button
            type="button"
            onClick={abrirWhatsApp}
            disabled={!wppPronto}
            title="Abrir conversa no WhatsApp"
            aria-label="Abrir conversa no WhatsApp"
            className={
              "inline-flex w-10 shrink-0 cursor-pointer items-center justify-center rounded-[10px] bg-soft transition-colors " +
              "disabled:cursor-default disabled:opacity-40 disabled:text-ink-soft " +
              `text-[#1EA34E] hover:enabled:bg-[#1EA34E] hover:enabled:text-white`
            }
          >
            <IconeWhatsApp />
          </button>
        ) : null}
        {acao}
      </div>
    </div>
  );
}

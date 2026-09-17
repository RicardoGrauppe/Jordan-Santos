/*
  Aviso flutuante de rodapé ("Salvo", "CPF copiado"). Portado do estúdio, onde
  existiam dois (toast-salvo e toast-copiado) com o mesmo formato.

  Fica no rodapé, não no centro: no meio cobria o que o fotógrafo estava
  conferindo bem na hora que mais precisava ver. No celular sobe pra ficar
  acima da barra de navegação.
*/
"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Check } from "lucide-react";

type Toast = { texto: string; ok?: boolean } | null;

export function useToast(): { mostrar: (texto: string, opts?: { ok?: boolean; ms?: number }) => void; elemento: ReactNode } {
  const [toast, setToast] = useState<Toast>(null);
  const [visivel, setVisivel] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const mostrar = useCallback((texto: string, opts?: { ok?: boolean; ms?: number }) => {
    setToast({ texto, ok: opts?.ok });
    setVisivel(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setVisivel(false), opts?.ms ?? 1800);
  }, []);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const elemento = (
    <div
      role="status"
      aria-live="polite"
      className={
        "pointer-events-none fixed left-1/2 z-[300] inline-flex max-w-[calc(100vw-40px)] items-center gap-2 " +
        "whitespace-nowrap rounded-full bg-noir px-5 py-2.5 text-[13px] font-medium text-white " +
        "transition-[opacity,transform] duration-150 " +
        "bottom-[calc(92px+var(--sab))] md:bottom-7 " +
        (visivel ? "-translate-x-1/2 translate-y-0 opacity-100" : "-translate-x-1/2 translate-y-2 opacity-0")
      }
    >
      {toast?.ok ? <Check size={15} className="shrink-0 text-[#8FD9AE]" /> : null}
      <span className="overflow-hidden text-ellipsis">{toast?.texto ?? ""}</span>
    </div>
  );

  return { mostrar, elemento };
}

/*
  Barra shimmer de carregamento. Portada do `.sk` do estúdio do Jordan.

  A regra que veio de lá: todo bloco de uma tela entra no skeleton junto e sai
  junto. Quem decide a hora é a página, não o componente: aqui só existe a
  aparência. O keyframe (`--animate-sk`) mora no @theme do globals.css.
*/
import type { CSSProperties } from "react";

const BASE =
  "block rounded-lg bg-[linear-gradient(100deg,var(--color-soft)_38%,#EEF0F3_50%,var(--color-soft)_62%)] " +
  "bg-[length:280%_100%] animate-sk motion-reduce:animate-none";

export function Sk({ className = "", style }: { className?: string; style?: CSSProperties }) {
  return <span aria-hidden className={BASE + " " + className} style={style} />;
}

/** Linha de texto falsa (13px de altura, cantos 6px). */
export function SkLinha({ className = "", style }: { className?: string; style?: CSSProperties }) {
  return <Sk className={"h-[13px] rounded-md " + className} style={style} />;
}

/** Avatar redondo falso (34px). */
export function SkCirculo({ className = "" }: { className?: string }) {
  return <Sk className={"h-[34px] w-[34px] shrink-0 rounded-full " + className} />;
}

/** Cartão de modelo do Ateliê (site ou formulário) carregando: a capa 16:10,
 *  nome e data, no mesmo tamanho do cartão de verdade, pra nada pular quando
 *  a lista chega. */
export function SkCartaoModelo() {
  return (
    <div className="overflow-hidden rounded-[18px] bg-paper shadow-card" aria-hidden>
      <Sk className="aspect-[16/10] w-full rounded-none" />
      <div className="px-4 pb-4 pt-3.5">
        <SkLinha style={{ width: "58%" }} />
        <SkLinha className="mt-2 h-[11px]" style={{ width: "38%" }} />
      </div>
    </div>
  );
}

/** O "Novo modelo"/"Novo formulário" carregando: só a placa, sem texto. */
export function SkCartaoNovo() {
  return <Sk className="min-h-[120px] rounded-[18px] sm:min-h-[200px]" />;
}

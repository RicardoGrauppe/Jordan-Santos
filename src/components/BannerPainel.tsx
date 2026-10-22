/*
  Banner do topo das páginas do painel (22/10/2026): primeiro o do Ateliê,
  depois o de Clientes. Mesma família do herói da ficha do cliente: degradê
  petróleo, luz no canto de cima, duas esferas de profundidade e nada com
  sombra por dentro. Quem usa monta o miolo; aqui só mora a moldura.
*/
import type { ReactNode } from "react";

export function BannerPainel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <section className={
      "relative isolate overflow-hidden rounded-[18px] px-5 py-6 text-white md:rounded-3xl md:px-8 md:py-8 " +
      "shadow-[0_14px_34px_rgba(0,54,70,.22),inset_0_1px_0_rgba(255,255,255,.07)] " +
      "bg-[radial-gradient(130%_150%_at_12%_-10%,rgba(255,255,255,.12),transparent_46%),linear-gradient(135deg,#013243_0%,#003646_46%,#0b4d61_100%)] " +
      className
    }>
      <span aria-hidden className="pointer-events-none absolute -right-[70px] -top-20 -z-[1] h-[250px] w-[250px] rounded-full bg-[radial-gradient(circle_at_35%_35%,rgba(255,255,255,.14),rgba(255,255,255,.03)_60%,transparent_72%)]" />
      <span aria-hidden className="pointer-events-none absolute -bottom-[140px] right-[24%] -z-[1] h-[230px] w-[230px] rounded-full bg-[radial-gradient(circle,rgba(15,90,113,.55),transparent_70%)]" />
      {children}
    </section>
  );
}

/** Botão claro (ação principal) e translúcido (secundária) de dentro do banner. */
export const BOTAO_BANNER =
  "inline-flex h-10 cursor-pointer items-center gap-2 rounded-xl bg-paper px-4 text-[13.5px] font-semibold text-accent transition-transform hover:-translate-y-px active:scale-[.96]";
export const BOTAO_BANNER_2 =
  "inline-flex h-10 cursor-pointer items-center gap-2 rounded-xl bg-white/[.14] px-4 text-[13.5px] font-semibold text-white transition-colors hover:bg-white/25";

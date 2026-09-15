/*
  Moldura das telas cheias do celular (avisos, busca e menu da conta). Portada
  de `.tela-mobile` / `abrirTelaMobile` do estudio.html do Jordan.

  Ela entra deslizando da direita e sai pelo mesmo caminho. O truque das
  classes: fechada, a visibilidade só muda DEPOIS dos 260ms da transição
  (`visibility 0s linear .26s`), senão a tela some no ato e o deslize de saída
  não aparece. Fechada também sai da ordem de tabulação, porque
  `visibility:hidden` tira o conteúdo do alcance do teclado.

  Existe uma vez só: as três telas usam a mesma casca e o mesmo tempo, e um
  deslize diferente do outro em 20ms é o tipo de coisa que ninguém nomeia mas
  todo mundo sente.
*/
"use client";

import type { ReactNode } from "react";

export function TelaMobile({
  aberta, rotulo, children,
}: { aberta: boolean; rotulo: string; children: ReactNode }) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={rotulo}
      className={
        "fixed inset-0 z-60 flex flex-col bg-paper pt-[var(--sat)] md:hidden " +
        (aberta
          ? "visible translate-x-0 [transition:transform_.26s_ease]"
          : "invisible translate-x-full [transition:transform_.26s_ease,visibility_0s_linear_.26s]")
      }
    >
      {children}
    </div>
  );
}

/** Cabeçalho da tela cheia: título grande à esquerda, ação opcional à direita. */
export function TopoTelaMobile({ children }: { children: ReactNode }) {
  return <div className="flex shrink-0 items-center gap-2.5 px-3.5 py-3">{children}</div>;
}

/** Corpo rolável. O respiro no fim é a barra de navegação, que fica por cima. */
export function CorpoTelaMobile({ className = "", children }: { className?: string; children: ReactNode }) {
  return (
    <div className={"min-h-0 flex-1 overflow-y-auto overscroll-contain px-3.5 pt-2.5 pb-[calc(88px+var(--sab))] " + className}>
      {children}
    </div>
  );
}

/*
  Moldura das telas cheias do celular (avisos, busca e menu da conta). Portada
  de `.tela-mobile` / `abrirTelaMobile` do estudio.html do Jordan.

  Ela entra deslizando e sai pelo mesmo caminho, na mesma curva da troca de
  rota (`--ease-desliza`): dispara e assenta.

  Por onde ela entra depende de `de`. As telas que são DESTINO da barra de
  baixo (avisos, menu) entram pelo lado que o dedo pede, na posição do ícone
  (ver `daEsquerda`). A BUSCA entra de baixo pra cima, cobrindo o que estava na
  tela: ela não é um lugar pra onde se vai, é uma folha que se puxa por cima do
  que já estava aberto — e é também de onde o teclado vem. Antes era `ease` puro, que é lento nas DUAS pontas e fazia a tela
  parecer pesada de arrastar. O truque das
  classes: fechada, a visibilidade só muda DEPOIS dos 260ms da transição
  (`visibility 0s linear .34s`), senão a tela some no ato e o deslize de saída
  não aparece. Fechada também sai da ordem de tabulação, porque
  `visibility:hidden` tira o conteúdo do alcance do teclado.

  Existe uma vez só: as três telas usam a mesma casca e o mesmo tempo, e um
  deslize diferente do outro em 20ms é o tipo de coisa que ninguém nomeia mas
  todo mundo sente.
*/
"use client";

import type { ReactNode } from "react";

export function TelaMobile({
  aberta, rotulo, daEsquerda = false, de = "lado", children,
}: {
  aberta: boolean;
  rotulo: string;
  daEsquerda?: boolean;
  /** por onde ela entra: pelo lado (avisos, menu) ou de baixo (busca) */
  de?: "lado" | "baixo";
  children: ReactNode;
}) {
  const repouso = de === "baixo"
    ? "translate-y-full"
    : daEsquerda ? "-translate-x-full" : "translate-x-full";

  /* A folha que sobe CORRE CONTRA O TECLADO, então ela anda mais rápido: o
     teclado do iPhone leva uns 250ms e começa junto com o toque, e o que a
     gente quer é a folha já parada quando ele chega. As telas laterais não
     disputam com nada e ficam nos 340ms de sempre. */
  const duracao = de === "baixo" ? ".2s" : ".34s";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={rotulo}
      className={
        "fixed inset-0 z-60 flex flex-col bg-paper pt-[var(--sat)] md:hidden " +
        (aberta
          ? "visible translate-x-0 translate-y-0"
          : "invisible " + repouso)
      }
      style={{
        transition: aberta
          ? `translate ${duracao} var(--ease-desliza)`
          : `translate ${duracao} var(--ease-desliza), visibility 0s linear ${duracao}`,
      }}
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

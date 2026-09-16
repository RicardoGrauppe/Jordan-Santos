/*
  Puxar pra atualizar (pull-to-refresh). Portado do bloco de touchstart /
  touchmove / touchend do estudio.html e do chip #ptr-spinner.

  Decisões que vieram de lá:

  - Só no toque (`matchMedia("(hover: none)")`) e só com a página no topo. No
    computador o gesto não existe: rolar pra cima com a roda do mouse não pode
    recarregar nada.
  - Passou de 56px ao soltar, atualiza. Não passou, volta pro lugar.
  - Quem recarrega segura o skeleton por um tempo mínimo (900ms na chamada das
    telas), senão o skeleton pisca e a atualização parece não ter acontecido.

  DUAS MUDANÇAS em relação ao original, decididas em 16/09/2026:

  1. **Quem move a página é o elástico do navegador, não a gente.** Antes este
     componente aplicava o próprio `translateY` no conteúdo, e isso SOMAVA ao
     bounce nativo: o movimento saía em dobro. Agora o `overscroll-behavior-y:
     contain` (em globals.css) desliga só o pull-to-refresh do navegador e
     preserva o elástico, então o movimento é o nativo, que é o que dá a
     sensação boa, e a gente desenha só o indicador por cima.

  2. **O indicador é um círculo, sem texto.** É o padrão de mercado (swipe to
     refresh do Material): spinner circular centralizado perto do topo, que
     entra transladando, escalando e girando conforme o puxão, precisa cruzar
     um limiar, e FICA VISÍVEL até a atualização terminar e o conteúdo novo
     aparecer. A pílula escrita "Carregando" que estava aqui não é o padrão.

  A posição é escrita direto no DOM (nada de setState por quadro). Nenhum
  `will-change` e nenhum transform de repouso no conteúdo, pra este bloco não
  virar o berço de posicionamento dos modais e do aviso flutuante, que são
  `fixed` e vivem dentro dele.
*/
"use client";

import { useEffect, useRef, type ReactNode } from "react";

/** quanto o dedo precisa andar (já com resistência) pra valer uma atualização */
const LIMIAR = 56;
/** teto do quanto o indicador desce, por mais que se puxe */
const MAXIMO = 90;
/** o dedo anda 100, o indicador anda 60 */
const RESISTENCIA = 0.6;
/** onde o indicador nasce, acima da primeira dobra */
const REPOUSO = -46;
const CURVA = "cubic-bezier(.22,.61,.36,1)";

export function PuxarPraAtualizar({
  aoAtualizar,
  children,
}: {
  aoAtualizar: () => unknown;
  children: ReactNode;
}) {
  const chip = useRef<HTMLDivElement>(null);
  const anel = useRef<HTMLSpanElement>(null);
  const acao = useRef(aoAtualizar);

  useEffect(() => { acao.current = aoAtualizar; }, [aoAtualizar]);

  useEffect(() => {
    const g = { y0: 0, puxando: false, dist: 0, ocupado: false };

    const rolagem = () => document.scrollingElement?.scrollTop ?? window.scrollY ?? 0;
    const noToque = () => window.matchMedia("(hover: none)").matches;

    /* d = quanto o dedo andou, já com resistência. Só o INDICADOR se move: o
       conteúdo fica com o elástico do navegador. Ele cresce de 0,6 a 1 e
       aparece conforme o puxão, então entra em vez de surgir pronto. */
    function posicionar(d: number, comTransicao: boolean) {
      const s = chip.current;
      if (!s) return;
      const prog = Math.min(d / LIMIAR, 1);
      s.style.transition = comTransicao ? "opacity .22s ease, transform .28s " + CURVA : "none";
      s.style.opacity = d > 4 ? String(prog) : "0";
      s.style.transform =
        "translateX(-50%) translateY(" + Math.max(d, 0) + "px) scale(" + (0.6 + 0.4 * prog) + ")";
    }

    posicionar(0, false);

    function comecar(ev: TouchEvent) {
      if (g.ocupado || !noToque()) return;
      if (rolagem() > 0) return;
      g.y0 = ev.touches[0].clientY;
      g.puxando = true;
      g.dist = 0;
    }

    function mover(ev: TouchEvent) {
      if (!g.puxando) return;
      const bruto = ev.touches[0].clientY - g.y0;
      if (bruto <= 0) {
        g.puxando = false;
        g.dist = 0;
        posicionar(0, true);
        return;
      }
      g.dist = Math.min(bruto * RESISTENCIA, MAXIMO);
      posicionar(g.dist, false);
    }

    function terminar() {
      if (!g.puxando) return;
      g.puxando = false;
      if (g.dist >= LIMIAR) {
        g.ocupado = true;
        anel.current?.classList.add("animate-spin");
        /* fica visível até o conteúdo novo entrar: é o que o padrão pede, e é a
           única pista de que a atualização está em curso */
        posicionar(LIMIAR, true);
        Promise.resolve(acao.current())
          .catch(() => { /* quem recarrega já trata: aqui só solta o gesto */ })
          .finally(() => {
            anel.current?.classList.remove("animate-spin");
            posicionar(0, true);
            g.ocupado = false;
          });
      } else {
        posicionar(0, true);
      }
      g.dist = 0;
    }

    document.addEventListener("touchstart", comecar, { passive: true });
    document.addEventListener("touchmove", mover, { passive: true });
    document.addEventListener("touchend", terminar);
    document.addEventListener("touchcancel", terminar);
    return () => {
      document.removeEventListener("touchstart", comecar);
      document.removeEventListener("touchmove", mover);
      document.removeEventListener("touchend", terminar);
      document.removeEventListener("touchcancel", terminar);
    };
  }, []);

  return (
    <div className="relative">
      {/* indicador: círculo centralizado que nasce acima da primeira dobra e
          desce com o puxão. z abaixo do cabeçalho (z-30) de propósito. */}
      <div
        ref={chip}
        aria-hidden
        className={
          "pointer-events-none absolute left-1/2 z-10 inline-flex h-9 w-9 items-center justify-center " +
          "rounded-full bg-paper opacity-0 shadow-card"
        }
        style={{ top: REPOUSO }}
      >
        {/* anel do spinner: desenho, não separação nem estado */}
        <span
          ref={anel}
          className="h-[18px] w-[18px] shrink-0 rounded-full border-2 border-line border-t-accent"
          style={{ animationDuration: ".65s" }}
        />
      </div>

      {children}
    </div>
  );
}

/*
  Puxar pra atualizar (pull-to-refresh). Portado do bloco de touchstart /
  touchmove / touchend do estudio.html e do chip #ptr-spinner.

  Decisões que vieram de lá:

  - Só no toque (`matchMedia("(hover: none)")`) e só com a página no topo. No
    computador o gesto não existe: rolar pra cima com a roda do mouse não pode
    recarregar nada.
  - Resistência de 0,6 e teto de 90px: o conteúdo desce mais devagar do que o
    dedo, que é o que dá a sensação de elástico.
  - Passou de 56px ao soltar, atualiza. Não passou, volta pro lugar.
  - Quem recarrega segura o skeleton por um tempo mínimo (900ms na chamada das
    telas), senão o skeleton pisca e a atualização parece não ter acontecido.

  A posição é escrita direto no DOM (nada de setState por quadro) e some assim
  que o gesto termina: nenhum `will-change` e nenhum transform de repouso, pra
  este bloco não virar o berço de posicionamento dos modais e do aviso
  flutuante, que são `fixed` e vivem dentro dele.
*/
"use client";

import { useEffect, useRef, type ReactNode } from "react";

/** quanto o conteúdo precisa descer pra valer uma atualização */
const LIMIAR = 56;
/** teto do quanto o conteúdo desce, por mais que se puxe */
const MAXIMO = 90;
/** o dedo anda 100, o conteúdo anda 60 */
const RESISTENCIA = 0.6;
const CURVA = "cubic-bezier(.22,.61,.36,1)";

export function PuxarPraAtualizar({
  aoAtualizar,
  children,
}: {
  aoAtualizar: () => unknown;
  children: ReactNode;
}) {
  const conteudo = useRef<HTMLDivElement>(null);
  const chip = useRef<HTMLDivElement>(null);
  const anel = useRef<HTMLSpanElement>(null);
  const acao = useRef(aoAtualizar);

  useEffect(() => { acao.current = aoAtualizar; }, [aoAtualizar]);

  useEffect(() => {
    const g = { y0: 0, puxando: false, dist: 0, ocupado: false };

    const rolagem = () => document.scrollingElement?.scrollTop ?? window.scrollY ?? 0;
    const noToque = () => window.matchMedia("(hover: none)").matches;

    /* d = deslocamento em px. Move o conteúdo e o chip juntos; o chip cresce de
       0,6 a 1 conforme o puxão, então ele aparece em vez de surgir pronto. */
    function posicionar(d: number, comTransicao: boolean) {
      const c = conteudo.current;
      if (c) {
        c.style.transition = comTransicao ? "transform .28s " + CURVA : "none";
        c.style.transform = d > 0 ? "translateY(" + d + "px)" : "";
      }
      const s = chip.current;
      if (s) {
        const prog = Math.min(d / LIMIAR, 1);
        s.style.transition = comTransicao ? "opacity .22s ease, transform .28s " + CURVA : "none";
        s.style.opacity = d > 4 ? String(prog) : "0";
        s.style.transform =
          "translateX(-50%) translateY(" + Math.max(d, 0) + "px) scale(" + (0.6 + 0.4 * prog) + ")";
      }
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
        posicionar(LIMIAR, true);   /* segura a página com o chip cheio */
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
      {/* chip: nasce acima do conteúdo, escondido embaixo do header, e desce
          junto com o puxão. z abaixo do header (z-30) de propósito. */}
      <div
        ref={chip}
        aria-hidden
        className={
          "pointer-events-none absolute left-1/2 top-[-46px] z-10 inline-flex items-center gap-[9px] " +
          "whitespace-nowrap rounded-full bg-[#F7F9FA] py-2 pl-3 pr-4 opacity-0 shadow-card"
        }
      >
        {/* anel do spinner: desenho, não separação nem estado */}
        <span
          ref={anel}
          className="h-4 w-4 shrink-0 rounded-full border-2 border-line border-t-accent"
          style={{ animationDuration: ".65s" }}
        />
        <span className="text-[13px] font-medium tracking-[.01em] text-ink-soft">Carregando</span>
      </div>

      <div ref={conteudo}>{children}</div>
    </div>
  );
}

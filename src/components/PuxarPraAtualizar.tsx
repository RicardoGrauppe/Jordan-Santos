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

  ONDE ELE LIGA (16/09/2026, depois de ver os dois spinners juntos no iPhone):

  No **Safari com barra de endereço** este gesto fica DESLIGADO, porque lá o
  pull-to-refresh nativo não tem como ser desligado: o
  `overscroll-behavior-y: contain` é a forma documentada, e o WebKit analisa a
  propriedade mas não a honra pro documento (bug 176454). Insistir daria os
  dois indicadores na mesma puxada, que foi exatamente o que apareceu no
  aparelho.

  Ele liga em todo o resto, e o "resto" é onde o produto de fato vive: no app
  adicionado à tela de início o iOS **não tem** pull-to-refresh (sem barra de
  endereço, sem gesto), então sem este componente não haveria atualização
  nenhuma. No Chrome o `contain` funciona de verdade, então lá o nativo já sai
  do caminho e o nosso é o único.

  A detecção é por user agent porque não existe alternativa honesta: o Safari
  16+ SUPORTA a propriedade (o `CSS.supports` responde que sim), ele só não a
  respeita nesse caso. Feature detection mentiria aqui.

  DUAS MUDANÇAS em relação ao original, decididas em 16/09/2026:

  1. **O conteúdo desce junto, e é isso que REVELA o indicador.** A pílula nasce
     46px acima da primeira dobra e desce com o puxão; se só ela se mexesse,
     ela passaria por cima da saudação em vez de aparecer num espaço que se
     abre. Descer o conteúdo é o que transforma o gesto em "puxar uma cortina",
     que é como o original fazia e como o iOS faz nas listas dele.

     Houve uma versão intermediária em que só o indicador se movia, pra não
     somar ao elástico do navegador. Deixou de fazer sentido quando o gesto
     passou a rodar SÓ onde o nativo não existe: não há mais nada pra somar.

  2. **O indicador segue a MECÂNICA do padrão** (swipe to refresh do Material):
     entra transladando, escalando e girando conforme o puxão, precisa cruzar
     um limiar, e FICA VISÍVEL até a atualização terminar e o conteúdo novo
     aparecer. A forma é pílula com a palavra "Carregando", por escolha do
     Ricardo: o padrão prescreve o comportamento, não o formato do recipiente.

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
  const conteudo = useRef<HTMLDivElement>(null);
  const chip = useRef<HTMLDivElement>(null);
  const anel = useRef<HTMLSpanElement>(null);
  const acao = useRef(aoAtualizar);

  useEffect(() => { acao.current = aoAtualizar; }, [aoAtualizar]);

  useEffect(() => {
    const g = { y0: 0, puxando: false, dist: 0, ocupado: false };

    const rolagem = () => document.scrollingElement?.scrollTop ?? window.scrollY ?? 0;
    const noToque = () => window.matchMedia("(hover: none)").matches;

    /* instalado na tela de início: aí o iOS não faz pull-to-refresh e o nosso
       é o único */
    const instalado = () =>
      window.matchMedia("(display-mode: standalone)").matches ||
      ("standalone" in navigator && (navigator as Navigator & { standalone?: boolean }).standalone === true);

    /* Safari de iPhone/iPad COM barra: o nativo manda e não dá pra desligar */
    const safariDoIos = () => {
      const ua = navigator.userAgent;
      const ehIos = /iP(hone|od|ad)/.test(ua) ||
        (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
      /* "Safari" aparece no UA de TODO navegador Chromium ("... Chrome/x
         Safari/537.36"), então a presença da palavra não identifica nada: o
         que identifica é a AUSÊNCIA dos outros motores e cascas. */
      const ehSafari = /Safari/.test(ua) &&
        !/Chrome|Chromium|Android|CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
      return ehIos && ehSafari;
    };

    const nossoGestoVale = () => noToque() && (instalado() || !safariDoIos());

    /* d = quanto o dedo andou, já com resistência. Conteúdo e indicador descem
       JUNTOS: como a pílula começa acima da dobra, o que ela ocupa é o espaço
       que o conteúdo abriu, e não o texto da saudação. Ela ainda cresce de 0,6
       a 1, então entra em vez de surgir pronta. */
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
      if (g.ocupado || !nossoGestoVale()) return;
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
      {/* indicador: pílula centralizada que nasce acima da primeira dobra e
          desce com o puxão. z abaixo do cabeçalho (z-30) de propósito. */}
      <div
        ref={chip}
        aria-hidden
        className={
          "pointer-events-none absolute left-1/2 z-10 inline-flex items-center gap-[9px] " +
          "whitespace-nowrap rounded-full bg-paper py-2 pl-3 pr-4 opacity-0 shadow-card"
        }
        style={{ top: REPOUSO }}
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

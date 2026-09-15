/*
  Linha que desliza pro lado revelando ações atrás dela (estilo WhatsApp).
  Portado de habilitarArraste / fecharSlidesExceto / agendarFecharSlide /
  fecharTodosSlides do estudio.html.

  Decisões que vieram de lá e não devem ser redescobertas:

  - O arraste é SÓ no toque (`pointerType === "touch"`). No mouse o caminho
    continua sendo o botão de opções, que fica visível na linha: sem ele, quem
    está no computador não teria como chegar na ação.
  - Direção decidida no começo do gesto: passou de 8px na horizontal E a
    horizontal é maior que a vertical, vira arraste; passou de 8px na vertical
    primeiro, o gesto é da rolagem e a linha desiste. Junto com
    `touch-action: pan-y`, é isso que faz o deslize não brigar com a página.
  - Um aberto por vez, em qualquer lista da tela (o registro é do módulo, não
    do componente), e o que abriu recolhe sozinho em 3,5s se nada acontecer.
  - O clique normal da linha continua valendo. Só é engolido em dois casos:
    logo depois de um arraste de verdade, e quando a linha já está aberta (aí
    o primeiro toque só recolhe).

  O transform e a opacidade são escritos direto no DOM, não pelo `style` do
  React: o dedo move a linha a cada pointermove e um setState por quadro
  engasgaria. As classes nunca mudam, então o React não desfaz essas escritas.
*/
"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { EllipsisVertical } from "lucide-react";

const HOVER = "[@media(hover:hover)]:";

/** tempo até a linha aberta recolher sozinha */
const MS_AUTO_FECHAR = 3500;
/** largura de cada ação revelada, em px (o original usa 88 nos eventos) */
const LARGURA_PADRAO = 88;
/** quanto o dedo precisa andar pra o gesto assumir uma direção */
const LIMIAR_DIRECAO = 8;

export type AcaoDeslizar = {
  chave: string;
  rotulo: string;
  icone: ReactNode;
  /** classes de cor do fundo revelado (inclua o hover em @media(hover:hover)) */
  classe: string;
  aoAcionar: () => void;
  desativada?: boolean;
};

/* ---------- registro compartilhado ----------
   Guarda o `fechar` de cada linha ABERTA. É do módulo de propósito: a home tem
   eventos e a tela de pendências tem três grupos, e "um aberto por vez" precisa
   valer entre listas diferentes, não só dentro de uma. O timer também é um só,
   pelo mesmo motivo. */
type Instancia = { fechar: () => void };
const abertos = new Set<Instancia>();
let timerFechar: ReturnType<typeof setTimeout> | null = null;

function limparTimerSeVazio() {
  if (abertos.size === 0 && timerFechar) {
    clearTimeout(timerFechar);
    timerFechar = null;
  }
}

function fecharTodos() {
  Array.from(abertos).forEach((i) => i.fechar());
}

function fecharOutros(meu: Instancia) {
  Array.from(abertos).forEach((i) => { if (i !== meu) i.fechar(); });
}

function agendarFechar() {
  if (timerFechar) clearTimeout(timerFechar);
  timerFechar = setTimeout(fecharTodos, MS_AUTO_FECHAR);
}

export function Deslizar({
  acoes,
  larguraAcao = LARGURA_PADRAO,
  rotuloOpcoes = "Opções",
  className = "",
  classeFrente = "",
  children,
}: {
  acoes: AcaoDeslizar[];
  larguraAcao?: number;
  rotuloOpcoes?: string;
  /** classes da caixa (fundo, raio, sombra). O recorte do deslize é daqui */
  className?: string;
  /** classes da camada que anda (fundo e respiro da linha em si) */
  classeFrente?: string;
  children: ReactNode;
}) {
  const largura = acoes.length * larguraAcao;
  const [aberto, setAberto] = useState(false);
  const raiz = useRef<HTMLDivElement>(null);
  const frente = useRef<HTMLDivElement>(null);
  const fundo = useRef<HTMLDivElement>(null);
  /* estado que os handlers leem e escrevem sem provocar render */
  const info = useRef({ largura, aberto: false, arrastou: false });
  /* identidade estável desta linha no registro do módulo. O `fechar` de dentro
     é trocado a cada render; o objeto, nunca, então dá pra tirar do Set */
  const eu = useRef<Instancia>({ fechar: () => {} });
  const gesto = useRef({ x0: 0, y0: 0, base: 0, ativo: false, drag: false });

  useEffect(() => { info.current.largura = largura; }, [largura]);

  /** escreve a posição de repouso (aberta ou recolhida) e avisa o React */
  const aplicar = useCallback((v: boolean) => {
    info.current.aberto = v;
    const f = frente.current;
    if (f) {
      f.style.transition = "";
      f.style.transform = v ? "translateX(" + -info.current.largura + "px)" : "";
    }
    const b = fundo.current;
    if (b) b.style.opacity = v ? "1" : "0";
    setAberto(v);
  }, []);

  const fechar = useCallback(() => {
    abertos.delete(eu.current);
    limparTimerSeVazio();
    if (!info.current.aberto) return;
    aplicar(false);
  }, [aplicar]);

  const abrir = useCallback(() => {
    fecharOutros(eu.current);
    abertos.add(eu.current);
    aplicar(true);
    agendarFechar();
  }, [aplicar]);

  useEffect(() => {
    const meu = eu.current;
    meu.fechar = fechar;
    return () => { abertos.delete(meu); limparTimerSeVazio(); };
  }, [fechar]);

  /* tocar fora (ou Esc) recolhe. Dentro da própria linha quem decide são os
     handlers dela: o botão de opções alterna, a ação revelada precisa receber
     o clique antes de qualquer recuo. */
  useEffect(() => {
    if (!aberto) return;
    function fora(ev: PointerEvent) {
      const alvo = ev.target as Node | null;
      if (alvo && raiz.current?.contains(alvo)) return;
      fechar();
    }
    function tecla(ev: KeyboardEvent) { if (ev.key === "Escape") fechar(); }
    document.addEventListener("pointerdown", fora);
    document.addEventListener("keydown", tecla);
    return () => {
      document.removeEventListener("pointerdown", fora);
      document.removeEventListener("keydown", tecla);
    };
  }, [aberto, fechar]);

  function aoDescer(ev: React.PointerEvent<HTMLDivElement>) {
    if (ev.pointerType !== "touch" || !acoes.length) return;
    const g = gesto.current;
    g.ativo = true;
    g.drag = false;
    g.x0 = ev.clientX;
    g.y0 = ev.clientY;
    g.base = info.current.aberto ? -largura : 0;
    info.current.arrastou = false;
    if (frente.current) frente.current.style.transition = "none";
  }

  function aoMover(ev: React.PointerEvent<HTMLDivElement>) {
    const g = gesto.current;
    if (!g.ativo) return;
    const dx = ev.clientX - g.x0;
    const dy = ev.clientY - g.y0;
    if (!g.drag) {
      if (Math.abs(dx) > LIMIAR_DIRECAO && Math.abs(dx) > Math.abs(dy)) {
        g.drag = true;
        fecharOutros(eu.current);
        if (fundo.current) fundo.current.style.opacity = "1";
      } else if (Math.abs(dy) > LIMIAR_DIRECAO) {
        /* o dedo está rolando a página: a linha sai do caminho */
        g.ativo = false;
        if (frente.current) frente.current.style.transition = "";
        return;
      } else return;
    }
    info.current.arrastou = true;
    if (ev.cancelable) ev.preventDefault();
    const off = Math.max(-largura, Math.min(0, g.base + dx));
    if (frente.current) frente.current.style.transform = "translateX(" + off + "px)";
  }

  function aoSoltar(ev: React.PointerEvent<HTMLDivElement>) {
    const g = gesto.current;
    if (!g.ativo) return;
    g.ativo = false;
    if (!g.drag) {
      if (frente.current) frente.current.style.transition = "";
      return;
    }
    /* passou de pouco menos da metade: abre. Senão volta pro lugar */
    const off = g.base + ((ev.clientX || g.x0) - g.x0);
    if (off <= -largura / 2.2) abrir();
    else {
      abertos.delete(eu.current);
      limparTimerSeVazio();
      aplicar(false);
    }
    /* a marca só cai depois do clique que o navegador dispara ao soltar */
    setTimeout(() => { info.current.arrastou = false; }, 60);
  }

  /* engole o clique que vem logo depois de um arraste (senão abriria a ficha)
     e transforma o primeiro toque na linha aberta em "recolher" */
  function aoClicarCapturando(ev: React.MouseEvent<HTMLDivElement>) {
    if (info.current.arrastou) {
      ev.preventDefault();
      ev.stopPropagation();
      return;
    }
    if (info.current.aberto) {
      ev.preventDefault();
      ev.stopPropagation();
      fechar();
    }
  }

  return (
    <div ref={raiz} className={"relative overflow-hidden " + className}>
      {/* ações reveladas: ficam atrás e só aparecem quando a linha anda */}
      <div
        ref={fundo}
        className="pointer-events-auto absolute inset-y-0 right-0 z-0 flex items-stretch opacity-0"
      >
        {acoes.map((a) => (
          <button
            key={a.chave}
            type="button"
            tabIndex={aberto ? 0 : -1}
            aria-hidden={!aberto}
            disabled={a.desativada}
            style={{ width: larguraAcao }}
            onClick={(ev) => {
              ev.stopPropagation();
              fecharTodos();
              a.aoAcionar();
            }}
            className={
              "flex flex-col items-center justify-center gap-1 px-1.5 text-[11px] font-semibold leading-[1.15] text-white " +
              (a.desativada ? "cursor-default opacity-45 " : "cursor-pointer ") + a.classe
            }
          >
            {a.icone}
            <span>{a.rotulo}</span>
          </button>
        ))}
      </div>

      {/* camada da frente: é ela que anda. touch-pan-y deixa a rolagem vertical
          passar e segura a horizontal pro gesto */}
      <div
        ref={frente}
        onPointerDown={aoDescer}
        onPointerMove={aoMover}
        onPointerUp={aoSoltar}
        onPointerCancel={aoSoltar}
        onClickCapture={aoClicarCapturando}
        className={
          "relative z-[1] flex w-full touch-pan-y items-center " +
          "transition-transform duration-[280ms] ease-[cubic-bezier(.22,.61,.36,1)] " + classeFrente
        }
      >
        {children}
        {acoes.length ? (
          <button
            type="button"
            aria-label={rotuloOpcoes}
            aria-haspopup="true"
            aria-expanded={aberto}
            onClick={(ev) => {
              ev.stopPropagation();
              const vaiAbrir = !info.current.aberto;
              fecharTodos();
              if (vaiAbrir) abrir();
            }}
            className={
              "ml-1 inline-flex h-[30px] w-[30px] shrink-0 cursor-pointer items-center justify-center rounded-[9px] " +
              "text-ink-soft transition-colors " +
              (aberto ? "bg-line text-ink " : "") + `${HOVER}hover:bg-line ${HOVER}hover:text-ink`
            }
          >
            <EllipsisVertical size={17} />
          </button>
        ) : null}
      </div>
    </div>
  );
}

/*
  Kit visual do produto. Portado do estúdio do Jordan Santos, onde estes
  padrões existiam copiados em cinco arquivos HTML diferentes: aqui existem uma
  vez só, que é metade do motivo de ter virado React.

  As três regras da casa, aplicadas aqui e válidas em qualquer componente novo:
  1. NENHUMA borda pra separar ou marcar estado. Fundo diferente mais sombra.
  2. Nenhum anel de foco colorido. Foco muda o fundo, sutil.
  3. Hover só dentro de `@media (hover:hover)`, senão no celular o estado fica
     preso depois do toque. Escreva `hover:` e pronto: o Tailwind 4 já envolve
     na media query sozinho. Nada de escrever a media query à mão.
  4. Responsivo é mobile-first. Nunca as variantes `max-*` (ver CLAUDE.md).
*/
"use client";

import Link from "next/link";
import { useVoltar } from "@/lib/voltar";
import { ArrowLeft, CircleAlert, CircleCheck, Info, TriangleAlert, X } from "lucide-react";
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from "react";


/* ---------- botão ---------- */

type Variante = "primario" | "secundario" | "fantasma" | "perigo";

const VARIANTE: Record<Variante, string> = {
  primario: `bg-accent text-white shadow-[0_1px_2px_rgba(0,54,70,.22)] hover:bg-accent-hover`,
  secundario: `bg-soft text-ink hover:bg-line`,
  fantasma: `bg-transparent text-ink-soft hover:bg-soft hover:text-ink`,
  perigo: `bg-erro text-white hover:brightness-90`,
};

export function Botao({
  variante = "primario", className = "", children, ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variante?: Variante }) {
  return (
    <button
      type="button"
      className={
        "inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-[10px] px-5 " +
        "text-sm font-semibold transition-[background,transform,box-shadow] duration-150 " +
        "active:scale-[.98] disabled:cursor-default disabled:opacity-45 " +
        VARIANTE[variante] + " " + className
      }
      {...props}
    >
      {children}
    </button>
  );
}

/* ---------- campos ---------- */

const BASE_CAMPO =
  "w-full rounded-[10px] bg-soft px-3.5 py-3 text-sm text-ink placeholder:text-ink-soft/70 " +
  "outline-none transition-colors focus:bg-[#EEF0F3]";

export function Campo({
  rotulo, dica, acao, className = "", id, ...props
}: InputHTMLAttributes<HTMLInputElement> & { rotulo?: string; dica?: string; acao?: ReactNode }) {
  return (
    <div className="mb-3.5">
      {/* `acao` vai na MESMA linha do rótulo (é onde mora o "Esqueci a senha"),
         não embaixo do campo: ali competiria com o botão de entrar */}
      {rotulo ? (
        <div className="mb-1.5 flex items-center justify-between gap-3">
          <label htmlFor={id} className="block text-[12.5px] font-medium text-ink-soft">{rotulo}</label>
          {acao}
        </div>
      ) : null}
      <input id={id} className={BASE_CAMPO + " " + className} {...props} />
      {dica ? <span className="mt-1.5 block text-[11.5px] text-ink-soft/85">{dica}</span> : null}
    </div>
  );
}

export function Area({
  rotulo, dica, className = "", id, ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { rotulo?: string; dica?: string }) {
  return (
    <div className="mb-3.5">
      {rotulo ? <label htmlFor={id} className="mb-1.5 block text-[12.5px] font-medium text-ink-soft">{rotulo}</label> : null}
      <textarea id={id} className={BASE_CAMPO + " resize-y " + className} {...props} />
      {dica ? <span className="mt-1.5 block text-[11.5px] text-ink-soft/85">{dica}</span> : null}
    </div>
  );
}

/* ---------- superfícies ---------- */

export function Cartao({ className = "", children }: { className?: string; children: ReactNode }) {
  return <div className={"rounded-2xl bg-paper p-6 shadow-card " + className}>{children}</div>;
}

/*
  Limpar a busca. Existe porque o X que o navegador desenha em
  `input[type=search]` é glifo dele, com tamanho, cor e peso próprios, e destoa
  do resto; o nativo fica escondido no globals.css e este entra no lugar.

  Só aparece quando há o que limpar: um X permanente num campo vazio é ruído.
  `onMouseDown` com preventDefault pra o campo não perder o foco antes do
  clique, senão o teclado do celular fecha e reabre.
*/
export function BotaoLimparBusca({ aoLimpar, rotulo = "Limpar busca" }: { aoLimpar: () => void; rotulo?: string }) {
  return (
    <button
      type="button"
      aria-label={rotulo}
      onMouseDown={(e) => e.preventDefault()}
      onClick={aoLimpar}
      className={
        "inline-flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-full " +
        "bg-transparent text-ink-soft transition-colors hover:bg-line hover:text-ink"
      }
    >
      <X size={14} />
    </button>
  );
}

/** Título de seção: barrinha, ícone em pill e texto. Padrão do estúdio. */
/*
  Seção é um CARD BRANCO, não um título solto na página. É assim na home, na
  ficha e em configurações: o conteúdo vive dentro do cartão, e por isso o que
  está dentro dele (linha de evento, card de modelo) usa o pastel petróleo
  sutil `#F7F9FA`, senão ficaria branco sobre branco.

  A barrinha vertical que existia antes do ícone SAIU (o original a esconde em
  toda a home e na ficha): com o ícone em pill ao lado, viravam dois enfeites
  disputando a mesma linha.
*/
/* Voltar pra tela anterior, acima do título da página. O rótulo é o NOME do
   destino de queda, não a palavra "Voltar": quem olha já sabe que a seta
   volta, e o que ele não sabe é pra onde.

   O `href` continua sendo o destino real do elemento — é ele que aparece na
   barra do navegador, que abre em nova aba e que vale quando não há histórico
   nosso. O clique normal é interceptado pra dar um passo atrás em vez de
   empilhar mais uma entrada (ver lib/voltar.ts); clique com ctrl/cmd/shift e
   botão do meio passam direto, senão quebraríamos "abrir em nova aba".

   Hover com `--line` e não `--soft`: a página do painel JÁ é soft, então um
   hover soft não pinta nada. É a regra de ação secundária do DESIGN do
   estúdio original. */
export function BotaoVoltar({ rotulo, href }: { rotulo: string; href: string }) {
  const voltar = useVoltar(href);
  return (
    <Link
      href={href}
      onClick={(ev) => {
        if (ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return;
        ev.preventDefault();
        void voltar();
      }}
      className={
        "mb-3 -ml-2 inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-2 py-1.5 " +
        "text-[13px] text-ink-soft no-underline transition-colors hover:bg-line hover:text-accent"
      }
    >
      <ArrowLeft size={15} /> {rotulo}
    </Link>
  );
}

/* Tons do CartaoAviso. A cor é o sinal, então ela vem do ESTADO e não da
   vontade de decorar: `info` é o texto que explica a tela e está sempre certo;
   `atencao` é algo que o Jordan precisa resolver; `ok` é confirmação; `erro` é
   o que já falhou. Sem borda em nenhum deles (regra da casa): quem separa do
   fundo é a cor de fundo mais a sombra. */
const TONS_AVISO = {
  info: { fundo: "bg-accent-tint", pilula: "bg-white/70 text-accent", Icone: Info },
  atencao: { fundo: "bg-[#F8F4EE]", pilula: "bg-[#EBE2D3] text-[#8A6A3C]", Icone: TriangleAlert },
  ok: { fundo: "bg-ok-tint", pilula: "bg-white/70 text-ok", Icone: CircleCheck },
  erro: { fundo: "bg-erro-tint", pilula: "bg-white/70 text-erro", Icone: CircleAlert },
} as const;

export type TomAviso = keyof typeof TONS_AVISO;

/**
 * Faixa de aviso com ícone, na mesma largura e no mesmo raio dos cards da
 * página. Diferente do `Aviso`, que é uma linha de texto dentro de um card,
 * este é um card por si — serve pra abrir uma tela dizendo em que pé ela está.
 *
 * Texto e nada mais: sem linha de título. O que a faixa diz é a explicação da
 * tela, que não muda; quem carrega o estado é a COR.
 */
export function CartaoAviso({
  tom = "info", className = "", children,
}: { tom?: TomAviso; className?: string; children: ReactNode }) {
  const { fundo, pilula, Icone } = TONS_AVISO[tom];
  return (
    <div className={"flex w-full items-start gap-[13px] rounded-[22px] px-[18px] py-4 shadow-card " + fundo + " " + className}>
      <span className={"inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[13px] " + pilula}>
        <Icone size={18} />
      </span>
      <p className="m-0 min-w-0 flex-1 text-[13px] leading-[1.5] text-ink-soft">{children}</p>
    </div>
  );
}

export function Secao({ icone, titulo, children }: { icone?: ReactNode; titulo: string; children: ReactNode }) {
  return (
    <section className="mb-4 rounded-[22px] bg-paper px-6 pb-6 pt-[22px] shadow-card">
      <h2 className="m-0 mb-[18px] flex items-center gap-[9px] text-[13px] font-semibold tracking-[.02em] text-ink">
        {icone ? (
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[13px] bg-accent-tint text-accent">
            {icone}
          </span>
        ) : null}
        {titulo}
      </h2>
      {children}
    </section>
  );
}

type Tom = "neutro" | "ok" | "atencao" | "erro" | "accent";
const TOM: Record<Tom, string> = {
  neutro: "bg-soft text-ink-soft",
  ok: "bg-ok-tint text-ok",
  atencao: "bg-[#FBF6E8] text-[#7A5A11]",
  erro: "bg-erro-tint text-erro",
  accent: "bg-accent-tint text-accent",
};

export function Selo({ tom = "neutro", children }: { tom?: Tom; children: ReactNode }) {
  return (
    <span className={"inline-block whitespace-nowrap rounded-full px-2.5 py-[3px] text-[10.5px] font-semibold tracking-[.03em] " + TOM[tom]}>
      {children}
    </span>
  );
}

/** Banner âmbar: o recado que não pode passar batido. */
export function Aviso({ children }: { children: ReactNode }) {
  return (
    <p className="m-0 flex items-start gap-2.5 rounded-[10px] bg-[#FBF6E8] px-3.5 py-3 text-[13px] leading-[1.55] text-[#7A5A11]">
      {children}
    </p>
  );
}

/** Mensagem de estado (salvando, salvo, erro) abaixo de um formulário. */
export function Estado({ texto, tom }: { texto: string; tom?: "ok" | "erro" }) {
  const cor = tom === "ok" ? "text-ok" : tom === "erro" ? "text-erro" : "text-ink-soft";
  return <p className={"m-0 min-h-[18px] text-[12.5px] " + cor}>{texto}</p>;
}

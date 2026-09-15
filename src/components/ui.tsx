/*
  Kit visual do produto. Portado do estúdio do Jordan Santos, onde estes
  padrões existiam copiados em cinco arquivos HTML diferentes: aqui existem uma
  vez só, que é metade do motivo de ter virado React.

  As três regras da casa, aplicadas aqui e válidas em qualquer componente novo:
  1. NENHUMA borda pra separar ou marcar estado. Fundo diferente mais sombra.
  2. Nenhum anel de foco colorido. Foco muda o fundo, sutil.
  3. Hover só dentro de `@media (hover:hover)`, senão no celular o estado fica
     preso depois do toque. Em Tailwind isso é o prefixo `hover:` combinado com
     `[@media(hover:hover)]:`.
*/
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from "react";

const HOVER = "[@media(hover:hover)]:";

/* ---------- botão ---------- */

type Variante = "primario" | "secundario" | "fantasma" | "perigo";

const VARIANTE: Record<Variante, string> = {
  primario: `bg-accent text-white shadow-[0_1px_2px_rgba(0,54,70,.22)] ${HOVER}hover:bg-accent-hover`,
  secundario: `bg-soft text-ink ${HOVER}hover:bg-line`,
  fantasma: `bg-transparent text-ink-soft ${HOVER}hover:bg-soft ${HOVER}hover:text-ink`,
  perigo: `bg-erro text-white ${HOVER}hover:brightness-90`,
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

/** Título de seção: barrinha, ícone em pill e texto. Padrão do estúdio. */
export function Secao({ icone, titulo, children }: { icone?: ReactNode; titulo: string; children: ReactNode }) {
  return (
    <section className="mb-7">
      <h2 className="mb-4 flex items-center gap-2.5 text-[13px] font-semibold text-ink">
        <span className="h-[13px] w-1 rounded-sm bg-accent" aria-hidden />
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

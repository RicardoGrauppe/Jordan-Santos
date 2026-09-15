/*
  Card colapsável da ficha do cliente. Portado dos fieldsets de estudio.html
  (.card-colapsavel): a ficha tem seis seções e aberta inteira vira uma parede
  de campos, então cada uma nasce fechada e o chevron abre só a que interessa.

  O cabeçalho segue o padrão do <Secao> do kit (barrinha, ícone em pill inline
  com o título), com espaço pra uma ação à direita antes do chevron.
*/
"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

const HOVER = "[@media(hover:hover)]:";

export function SecaoFicha({
  icone, titulo, acao, abertaInicial = false, children,
}: {
  icone: ReactNode;
  titulo: string;
  /** botão pequeno à direita do título (ex.: gerar contrato) */
  acao?: ReactNode;
  abertaInicial?: boolean;
  children: ReactNode;
}) {
  const [aberta, setAberta] = useState(abertaInicial);

  return (
    <section className={"mb-4 rounded-[22px] bg-paper px-6 shadow-card " + (aberta ? "py-6" : "py-[18px]")}>
      <div className={"flex items-center gap-2.5 " + (aberta ? "mb-4" : "")}>
        <h2 className="m-0 flex flex-1 items-center gap-2.5 text-[13px] font-semibold text-ink">
          <span className="h-[13px] w-1 rounded-sm bg-accent" aria-hidden />
          <span className="inline-flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-[11px] bg-accent-tint text-accent">
            {icone}
          </span>
          {titulo}
        </h2>
        {acao}
        <button
          type="button"
          onClick={() => setAberta((v) => !v)}
          aria-expanded={aberta}
          aria-label={aberta ? "Fechar seção" : "Abrir seção"}
          className={`inline-flex h-[26px] w-[26px] shrink-0 cursor-pointer items-center justify-center rounded-[9px] bg-soft text-ink-soft transition-colors ${HOVER}hover:bg-line ${HOVER}hover:text-accent`}
        >
          <ChevronDown size={14} className={"transition-transform duration-200 " + (aberta ? "" : "-rotate-90")} />
        </button>
      </div>
      {/* fica montado mesmo fechado: os campos são controlados e trocar de
          seção não pode desmontar o que o fotógrafo acabou de digitar */}
      <div hidden={!aberta}>{children}</div>
    </section>
  );
}

/** Botão de ação pequeno do cabeçalho da seção (mesmo tamanho do chevron). */
export function AcaoSecao({
  rotulo, onClick, disabled, children,
}: { rotulo: string; onClick: () => void; disabled?: boolean; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={rotulo}
      aria-label={rotulo}
      className={`inline-flex h-[26px] w-[26px] shrink-0 cursor-pointer items-center justify-center rounded-[9px] bg-soft text-ink-soft transition-colors disabled:cursor-default disabled:opacity-30 ${HOVER}hover:bg-line ${HOVER}hover:text-accent`}
    >
      {children}
    </button>
  );
}

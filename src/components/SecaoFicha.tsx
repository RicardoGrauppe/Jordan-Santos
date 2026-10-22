/*
  Card da ficha do cliente. Portado dos fieldsets de estudio.html
  (.card-colapsavel).

  Até 22/10/2026 cada seção nascia FECHADA, pra ficha não virar parede de
  campos. Na prática virou o contrário: quatro tiras brancas com um título
  cada e nenhum dado à vista, e meia tela vazia embaixo. O Ricardo pediu
  hierarquia melhor, e o dado do casal é a razão de a tela existir, então
  agora tudo nasce ABERTO e o fechar continua existindo pra quem quer
  enxugar; o que a pessoa fechou fica fechado (localStorage, por seção).

  Cabeçalho no mesmo padrão dos cartões do painel do editor do contrato
  (brandbook, seção 18): ícone num quadrado de 36px + título + uma linha de
  explicação. Sem sombra, como a lista de clientes: o papel sobre a página
  soft já separa.
*/
"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";


export function SecaoFicha({
  icone, titulo, descricao, chave, acao, forcarAberta = false, children,
}: {
  icone: ReactNode;
  titulo: string;
  /** uma linha curta embaixo do título */
  descricao?: string;
  /** guarda aberto/fechado no navegador (`ficha-secao:<chave>`) */
  chave?: string;
  /** botão pequeno à direita do título */
  acao?: ReactNode;
  /** abre mesmo que a pessoa tenha fechado antes (ex.: ?campo=email) */
  forcarAberta?: boolean;
  children: ReactNode;
}) {
  /* a ficha só desenha as seções depois de carregar o cliente (no
     navegador), então dá pra ler o localStorage já no estado inicial */
  const [aberta, setAberta] = useState(() => {
    if (!chave || forcarAberta) return true;
    try { return localStorage.getItem("ficha-secao:" + chave) !== "0"; } catch { return true; }
  });

  function alternar() {
    setAberta((v) => {
      if (chave) {
        try { localStorage.setItem("ficha-secao:" + chave, v ? "0" : "1"); } catch { /* sem storage */ }
      }
      return !v;
    });
  }

  return (
    <section className="mb-4 rounded-[22px] bg-paper p-5 md:px-6">
      <div className="flex items-center gap-3">
        <button type="button" onClick={alternar} aria-expanded={aberta}
          className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 text-left">
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[13px] bg-accent-tint text-accent">
            {icone}
          </span>
          <span className="min-w-0">
            <span className="block text-[14.5px] font-semibold leading-[1.3] text-ink">{titulo}</span>
            {descricao ? <span className="block truncate text-[12.5px] leading-[1.4] text-ink-soft">{descricao}</span> : null}
          </span>
        </button>
        {acao}
        <button
          type="button"
          onClick={alternar}
          aria-expanded={aberta}
          aria-label={aberta ? "Fechar seção" : "Abrir seção"}
          className="inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-[10px] text-ink-soft transition-colors hover:bg-soft hover:text-ink"
        >
          <ChevronDown size={16} className={"transition-transform duration-200 " + (aberta ? "rotate-180" : "")} />
        </button>
      </div>
      {/* fica montado mesmo fechado: os campos são controlados e trocar de
          seção não pode desmontar o que o fotógrafo acabou de digitar */}
      <div hidden={!aberta} className="mt-5">{children}</div>
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
      className="inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-[10px] bg-soft text-ink-soft transition-colors disabled:cursor-default disabled:opacity-30 hover:bg-line hover:text-accent"
    >
      {children}
    </button>
  );
}

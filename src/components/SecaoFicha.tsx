/*
  Cartão da ficha do cliente. Portado dos fieldsets de estudio.html
  (.card-colapsavel), e reinventado duas vezes em 22/10/2026:

  1. As seções nasciam fechadas: quatro tiras brancas com um título cada,
     nenhum dado à vista e meia tela vazia. Passaram a nascer abertas.
  2. Abertas, viraram um formulário de 1.845px com caixa vazia pra todo CPF
     que ninguém preencheu. O Ricardo escolheu "perfil + editar por seção":
     o cartão mostra o dado como TEXTO (modo leitura, ver FichaLeitura.tsx)
     e só vira formulário quando se clica em Editar. "Concluir" volta pra
     leitura. O salvar continua automático nos dois modos.

  Sem colapsar: lido como texto, o cartão já é curto. Cabeçalho no padrão
  dos cartões do painel do editor do contrato (brandbook, seção 18): ícone
  num quadrado de 36px + título + uma linha de explicação. Sem sombra.
*/
"use client";

import type { ReactNode } from "react";
import { Check, Pencil } from "lucide-react";


export function SecaoFicha({
  icone, titulo, descricao, editando, aoEditar, aoConcluir, children,
}: {
  icone: ReactNode;
  titulo: string;
  /** uma linha curta embaixo do título */
  descricao?: string;
  editando: boolean;
  aoEditar: () => void;
  /** some quando não há como voltar pra leitura (ficha nova sem cliente) */
  aoConcluir?: () => void;
  children: ReactNode;
}) {
  return (
    <section className="mb-4 rounded-[22px] bg-paper p-5 md:px-6">
      <div className="mb-3 flex items-center gap-3">
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[13px] bg-accent-tint text-accent">
          {icone}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[14.5px] font-semibold leading-[1.3] text-ink">{titulo}</span>
          {descricao ? <span className="block truncate text-[12.5px] leading-[1.4] text-ink-soft">{descricao}</span> : null}
        </span>
        {!editando ? (
          <button type="button" onClick={aoEditar}
            className="inline-flex h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-[10px] bg-soft px-3 text-[13px] font-semibold text-accent transition-colors hover:bg-line">
            <Pencil size={14} /> Editar
          </button>
        ) : aoConcluir ? (
          <button type="button" onClick={aoConcluir}
            className="inline-flex h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-[10px] bg-accent px-3 text-[13px] font-semibold text-white transition-colors hover:bg-accent-hover">
            <Check size={14} strokeWidth={2.5} /> Concluir
          </button>
        ) : null}
      </div>
      <div className={editando ? "pt-2" : ""}>{children}</div>
    </section>
  );
}

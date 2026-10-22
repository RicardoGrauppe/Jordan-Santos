/*
  Biblioteca de seções prontas do Ateliê (brandbook, seção 22), no desenho da
  biblioteca de templates do Elementor: cada seção num cartão com a prévia de
  verdade, e um clique põe a seção na página. Arrastar da lista da esquerda
  continua valendo, mas sozinho não dizia o que os nomes eram.

  A prévia é a página /atelie/secao/<tipo> num iframe de 1280px encolhido até
  a largura do cartão (como a miniatura da galeria), então sai com o layout
  de computador mesmo no celular.

  Mesma janela da biblioteca de fotos: sobre a tela no computador, folha de
  baixo pra cima no celular.
*/
"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { LayoutTemplate, Plus, X } from "lucide-react";
import { configAtelie, DESCRICAO_SECAO } from "@/lib/atelie/blocos";
import { TIPOS_DE_SECAO, type TipoDeSecao } from "@/lib/atelie/tipos";

const LARGURA_PREVIA = 1280;

/* Iframe encolhido. Quinas: mesmo cuidado da miniatura da galeria (raio
   próprio, isolate e fundo claro), senão o iframe com transform vaza o fundo
   na curva. */
function Previa({ tipo }: { tipo: TipoDeSecao }) {
  const caixa = useRef<HTMLDivElement>(null);
  const [escala, setEscala] = useState(0);

  useEffect(() => {
    const el = caixa.current;
    if (!el) return;
    const medir = () => setEscala(el.clientWidth / LARGURA_PREVIA);
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={caixa} className="relative isolate aspect-[16/10] overflow-hidden rounded-t-[16px] bg-soft">
      {escala > 0 ? (
        <iframe
          src={"/atelie/secao/" + tipo}
          title=""
          aria-hidden="true"
          tabIndex={-1}
          loading="lazy"
          className="pointer-events-none absolute left-0 top-0 origin-top-left border-0"
          style={{ width: LARGURA_PREVIA, height: LARGURA_PREVIA / 1.6, transform: `scale(${escala})` }}
        />
      ) : null}
    </div>
  );
}

export function SecoesProntas({ aoEscolher, aoFechar }: {
  aoEscolher: (tipo: TipoDeSecao) => void;
  aoFechar: () => void;
}) {
  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => { if (e.key === "Escape") aoFechar(); };
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [aoFechar]);

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-[rgba(29,29,27,.38)] md:items-center md:p-6"
      onPointerDown={(e) => { if (e.target === e.currentTarget) aoFechar(); }}>
      <div role="dialog" aria-modal="true" aria-label="Seções prontas"
        className="flex max-h-[90dvh] w-full max-w-[1040px] flex-col rounded-t-[22px] bg-paper pb-[var(--sab)] shadow-alta md:rounded-[22px] md:pb-0">
        <div className="flex shrink-0 items-center gap-3 px-5 pb-3 pt-4">
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[13px] bg-accent-tint text-accent">
            <LayoutTemplate size={17} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="m-0 text-[16px] font-semibold text-ink">Seções prontas</h2>
            <p className="m-0 text-[12px] text-ink-soft">
              Clique numa seção pra pôr na página, logo abaixo do bloco selecionado. Depois é só trocar os textos e as fotos.
            </p>
          </div>
          <button type="button" onClick={aoFechar} aria-label="Fechar"
            className="inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-[10px] text-ink-soft transition-colors [@media(hover:hover)]:hover:bg-soft [@media(hover:hover)]:hover:text-ink">
            <X size={18} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5">
          <ul className="m-0 grid list-none grid-cols-1 gap-4 p-0 sm:grid-cols-2 lg:grid-cols-3">
            {TIPOS_DE_SECAO.map((tipo) => (
              <li key={tipo}>
                <button type="button" onClick={() => aoEscolher(tipo)}
                  className="group block w-full cursor-pointer rounded-[16px] bg-paper p-0 text-left shadow-card transition-[transform,box-shadow] duration-150 [@media(hover:hover)]:hover:-translate-y-px [@media(hover:hover)]:hover:shadow-card-hover">
                  <Previa tipo={tipo} />
                  <span className="flex items-center gap-3 px-4 pb-4 pt-3">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] font-semibold text-ink">{configAtelie.components[tipo].label}</span>
                      <span className="mt-0.5 block text-[12px] leading-snug text-ink-soft">{DESCRICAO_SECAO[tipo]}</span>
                    </span>
                    <span className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-[10px] bg-accent-tint px-3 text-[13px] font-semibold text-accent">
                      <Plus size={15} /> Inserir
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>,
    document.body,
  );
}

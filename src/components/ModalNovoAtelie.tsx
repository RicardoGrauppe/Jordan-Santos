/*
  "Novo" do Ateliê no celular (22/10/2026, pedido do Ricardo): o botão do
  canto do cabeçalho cria, e antes pergunta o quê. Duas escolhas grandes,
  com o que cada uma é numa linha, porque "site" e "formulário" moram na
  mesma galeria mas fazem coisas bem diferentes pro casal.

  Mesma casca dos outros pop-ups do painel (ModalTrocarEmail, ModalNovoModelo).
*/
"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { ChevronRight, ClipboardList, Globe, X } from "lucide-react";

export function ModalNovoAtelie({ ocupado, aoFechar, aoSite, aoFormulario }: {
  ocupado: boolean;
  aoFechar: () => void;
  aoSite: () => void;
  aoFormulario: () => void;
}) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape" && !ocupado) aoFechar(); };
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [ocupado, aoFechar]);

  const opcoes = [
    { rotulo: "Site", texto: "Seu portfólio: a página pro casal ver seu trabalho, pacotes e adicionais.", Icone: Globe, acao: aoSite },
    { rotulo: "Formulário", texto: "O cadastro que o casal preenche pra confirmar a data.", Icone: ClipboardList, acao: aoFormulario },
  ];

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-5" role="dialog" aria-modal="true" aria-label="Criar novo">
      <div className="absolute inset-0 bg-[rgba(29,29,27,.5)] backdrop-blur-[2px]" onClick={() => { if (!ocupado) aoFechar(); }} />
      <div className="relative z-[1] w-full max-w-[420px] rounded-[18px] bg-paper p-6 pb-5 shadow-alta">
        <button type="button" onClick={aoFechar} aria-label="Fechar" disabled={ocupado}
          className="absolute right-4 top-4 inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-[10px] text-ink-soft hover:bg-soft hover:text-ink">
          <X size={16} />
        </button>
        <h3 className="m-0 pr-8 text-[20px] font-semibold leading-[1.25] text-ink">Criar novo</h3>
        <p className="m-0 mt-1 text-[13.5px] text-ink-soft">O que você quer montar?</p>
        <div className="mt-5 grid gap-2.5">
          {opcoes.map(({ rotulo, texto, Icone, acao }) => (
            <button key={rotulo} type="button" onClick={acao} disabled={ocupado}
              className="flex w-full cursor-pointer items-center gap-3.5 rounded-[14px] bg-soft p-4 text-left transition-colors hover:bg-accent-tint disabled:cursor-default disabled:opacity-60">
              <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[13px] bg-paper text-accent">
                <Icone size={20} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-semibold text-ink">{rotulo}</span>
                <span className="mt-0.5 block text-[12.5px] leading-[1.45] text-ink-soft">{texto}</span>
              </span>
              <ChevronRight size={18} className="shrink-0 text-ink-soft" />
            </button>
          ))}
        </div>
      </div>
    </div>,
    document.body,
  );
}

/*
  Pop-up de confirmação. Portado do estúdio, onde ele existia duas vezes
  (estudio.html e configuracoes.html) porque não havia como compartilhar.

  A API é um hook com Promise: `const ok = await confirmar({...})`. Isso mantém
  o código de quem chama legível, do jeito que era com o confirm() do
  navegador, sem herdar a feiura dele.
*/
"use client";

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { Info, TriangleAlert } from "lucide-react";
import { Botao, Aviso } from "./ui";

export type PedidoConfirmacao = {
  titulo: string;
  texto?: string;
  /** banner âmbar: o recado que não pode passar batido */
  aviso?: string;
  rotuloOk?: string;
  perigo?: boolean;
};

type Contexto = (pedido: PedidoConfirmacao) => Promise<boolean>;
const Ctx = createContext<Contexto | null>(null);

export function useConfirmar(): Contexto {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useConfirmar precisa do <ProvedorConfirmacao> em volta");
  return ctx;
}

export function ProvedorConfirmacao({ children }: { children: ReactNode }) {
  const [pedido, setPedido] = useState<PedidoConfirmacao | null>(null);
  const resolver = useRef<((v: boolean) => void) | null>(null);

  const confirmar = useCallback<Contexto>((p) => {
    setPedido(p);
    return new Promise<boolean>((res) => { resolver.current = res; });
  }, []);

  function fechar(valor: boolean) {
    setPedido(null);
    resolver.current?.(valor);
    resolver.current = null;
  }

  return (
    <Ctx.Provider value={confirmar}>
      {children}
      {pedido ? (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center p-5"
          role="alertdialog"
          aria-modal="true"
          aria-label={pedido.titulo}
          onKeyDown={(e) => { if (e.key === "Escape") fechar(false); }}
        >
          <div
            className="absolute inset-0 bg-[rgba(29,29,27,.5)] backdrop-blur-[2px]"
            onClick={() => fechar(false)}
          />
          <div className="relative z-[1] w-full max-w-[440px] rounded-[18px] bg-paper p-8 pb-6 shadow-alta">
            {/* ícone em pill SEMPRE inline com o título, nunca acima */}
            <h3 className="m-0 mb-3.5 flex items-center gap-3 text-[22px] font-semibold leading-[1.25] text-ink">
              <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-accent-tint text-accent">
                <Info size={16} />
              </span>
              {pedido.titulo}
            </h3>

            {pedido.texto ? (
              <p className="m-0 whitespace-pre-line text-[14.5px] leading-[1.6] text-ink-soft">{pedido.texto}</p>
            ) : null}

            {pedido.aviso ? (
              <div className="mt-4">
                <Aviso>
                  <TriangleAlert size={16} className="mt-px shrink-0 text-[#B99524]" />
                  <span>{pedido.aviso}</span>
                </Aviso>
              </div>
            ) : null}

            {/* 50/50: nenhuma das duas saídas é a "secundária escondida", e as
                duas ficam com o mesmo alvo de clique. No celular empilham, com
                o principal em cima. */}
            <div className="mt-7 flex flex-col-reverse gap-2.5 sm:flex-row">
              <Botao variante="secundario" className="sm:flex-1" onClick={() => fechar(false)}>
                Cancelar
              </Botao>
              <Botao
                variante={pedido.perigo ? "perigo" : "primario"}
                className="sm:flex-1"
                autoFocus
                onClick={() => fechar(true)}
              >
                {pedido.rotuloOk ?? "Confirmar"}
              </Botao>
            </div>
          </div>
        </div>
      ) : null}
    </Ctx.Provider>
  );
}

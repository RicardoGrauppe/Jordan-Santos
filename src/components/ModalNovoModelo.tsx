/*
  Pop-up de criar modelo de contrato, aberto pelo "Novo modelo" da lateral do
  editor do contrato de um cliente. Mesma casca do ModalConfirmar (fundo
  escurecido com desfoque, cartão de 440px, ícone em pill inline com o
  título, botões 50/50), mas com formulário: nome e de onde o modelo parte.

  Vai por portal pro <body>: a lateral do celular é uma gaveta com
  `translate`, e um `fixed` dentro de elemento transformado fica preso nele em
  vez de cobrir a tela.
*/
"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Copy, File, FilePlus } from "lucide-react";
import { Botao, Campo } from "./ui";

/** de onde o modelo novo parte: o texto do contrato aberto ou uma folha em branco */
export type BaseModelo = "contrato" | "branco";

const OPCOES: { valor: BaseModelo; icone: typeof Copy; titulo: string; texto: string }[] = [
  { valor: "contrato", icone: Copy, titulo: "Texto deste contrato", texto: "Vira o modelo deste contrato." },
  { valor: "branco", icone: File, titulo: "Em branco", texto: "Abre no editor de modelos. Este contrato não muda." },
];

export function ModalNovoModelo({ aberto, ocupado, aoFechar, aoCriar }: {
  aberto: boolean;
  ocupado: boolean;
  aoFechar: () => void;
  /** devolve true quando criou; aí o pop-up fecha e limpa */
  aoCriar: (nome: string, base: BaseModelo) => Promise<boolean>;
}) {
  const [nome, setNome] = useState("");
  const [base, setBase] = useState<BaseModelo>("contrato");

  useEffect(() => {
    if (!aberto) return;
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape" && !ocupado) aoFechar(); };
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [aberto, ocupado, aoFechar]);

  function fechar() {
    if (ocupado) return;
    setNome("");
    setBase("contrato");
    aoFechar();
  }

  async function enviar() {
    const n = nome.trim();
    if (!n || ocupado) return;
    if (await aoCriar(n, base)) { setNome(""); setBase("contrato"); aoFechar(); }
  }

  if (!aberto || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-5" role="dialog" aria-modal="true" aria-label="Novo modelo">
      <div className="absolute inset-0 bg-[rgba(29,29,27,.5)] backdrop-blur-[2px]" onClick={fechar} />
      <form
        className="relative z-[1] w-full max-w-[440px] rounded-[18px] bg-paper p-8 pb-6 shadow-alta"
        onSubmit={(e) => { e.preventDefault(); void enviar(); }}
      >
        <h3 className="m-0 mb-2 flex items-center gap-3 text-[22px] font-semibold leading-[1.25] text-ink">
          <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-accent-tint text-accent">
            <FilePlus size={16} />
          </span>
          Novo modelo
        </h3>
        <p className="m-0 mb-5 text-[14.5px] leading-[1.6] text-ink-soft">
          Fica salvo pra usar em outros contratos. Dá pra editar depois em Configurações.
        </p>

        <Campo id="nome-modelo-novo" rotulo="Nome do modelo" placeholder="Contrato de ensaio" autoFocus
          value={nome} onChange={(e) => setNome(e.target.value)} autoComplete="off" />

        <div className="mb-1.5 text-[12.5px] font-medium text-ink-soft">Começar com</div>
        <div role="radiogroup" aria-label="Começar com" className="grid gap-2 sm:grid-cols-2">
          {OPCOES.map(({ valor, icone: Icone, titulo, texto }) => {
            const marcado = base === valor;
            return (
              <button key={valor} type="button" role="radio" aria-checked={marcado} onClick={() => setBase(valor)}
                className={"flex cursor-pointer flex-col items-start gap-2 rounded-[14px] p-3.5 text-left transition-colors " +
                  (marcado ? "bg-accent-tint" : "bg-soft hover:bg-line")}>
                <span className="flex w-full items-center justify-between">
                  <Icone size={18} className={marcado ? "text-accent" : "text-ink-soft"} />
                  <span className={"inline-flex h-[18px] w-[18px] items-center justify-center rounded-full transition-colors " +
                    (marcado ? "bg-accent" : "bg-line")}>
                    {marcado ? <span className="h-1.5 w-1.5 rounded-full bg-white" /> : null}
                  </span>
                </span>
                <span>
                  <span className={"block text-[13px] font-semibold " + (marcado ? "text-accent" : "text-ink")}>{titulo}</span>
                  <span className="mt-0.5 block text-[12px] leading-snug text-ink-soft">{texto}</span>
                </span>
              </button>
            );
          })}
        </div>

        <div className="mt-7 flex flex-col-reverse gap-2.5 sm:flex-row">
          <Botao type="button" variante="secundario" className="sm:flex-1" onClick={fechar} disabled={ocupado}>
            Cancelar
          </Botao>
          <Botao type="submit" variante="primario" className="sm:flex-1" disabled={!nome.trim() || ocupado}>
            {ocupado ? "Criando…" : "Criar modelo"}
          </Botao>
        </div>
      </form>
    </div>,
    document.body,
  );
}

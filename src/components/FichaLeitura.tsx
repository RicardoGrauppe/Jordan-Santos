/*
  Peças do modo LEITURA da ficha do cliente (22/10/2026, pedido do Ricardo:
  "perfil + editar por seção").

  A ficha deixou de ser um formulário sempre aberto: o dado aparece como
  texto, com copiar e WhatsApp à mão, e o campo só aparece quando a pessoa
  clica em Editar no cartão. Campo vazio não vira caixa vazia: entra na
  linha "Faltando", e cada item dela abre a edição já no campo certo.
*/
"use client";

import { useRef, useState, type ReactNode } from "react";
import { Check, Copy, Plus } from "lucide-react";
import { copiarTexto, soDigitos } from "@/lib/ficha";

type Avisar = (texto: string, opts?: { ok?: boolean }) => void;

function IconeWhatsApp() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" width={16} height={16} aria-hidden>
      <path d="M12 2a9.9 9.9 0 0 0-8.5 15.1L2 22l5-1.3A9.9 9.9 0 1 0 12 2zm0 18.1c-1.5 0-2.9-.4-4.2-1.1l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.1zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1-.2.3-.7.8-.8 1-.1.1-.3.2-.5.1-.3-.1-1.1-.4-2-1.2-.8-.7-1.3-1.5-1.4-1.8-.2-.3 0-.4.1-.5l.4-.5c.1-.2.2-.3.3-.5 0-.2 0-.3 0-.5 0-.1-.6-1.4-.8-1.9-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.4.1-.7.3-.2.3-.9.9-.9 2.1s.9 2.5 1 2.6c.1.2 1.8 2.7 4.3 3.8.6.3 1.1.4 1.4.5.6.2 1.2.2 1.6.1.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.1-1.2 0-.1-.2-.2-.4-.3z" />
    </svg>
  );
}

const BOTAO_ICONE =
  "inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-[10px] transition-colors";

/** Copiar com o visto de confirmação no próprio botão. */
export function BotaoCopiar({ rotulo, valor, avisar }: { rotulo: string; valor: string; avisar: Avisar }) {
  const [copiou, setCopiou] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  async function copiar() {
    const ok = await copiarTexto(valor.trim());
    if (!ok) { avisar("Não consegui copiar, selecione e copie na mão"); return; }
    avisar(rotulo + " copiado", { ok: true });
    setCopiou(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopiou(false), 1800);
  }
  return (
    <button type="button" onClick={() => void copiar()} title="Copiar" aria-label={"Copiar " + rotulo.toLowerCase()}
      className={BOTAO_ICONE + " " + (copiou ? "text-ok" : "text-ink-soft hover:bg-soft hover:text-accent")}>
      {copiou ? <Check size={15} /> : <Copy size={15} />}
    </button>
  );
}

export function BotaoWhatsApp({ telefone }: { telefone: string }) {
  const digitos = soDigitos(telefone);
  return (
    <button type="button" title="Abrir conversa no WhatsApp" aria-label="Abrir conversa no WhatsApp"
      onClick={() => window.open("https://wa.me/" + digitos, "_blank", "noopener")}
      className={BOTAO_ICONE + " text-[#1EA34E] hover:bg-[#1EA34E] hover:text-white"}>
      <IconeWhatsApp />
    </button>
  );
}

/** Uma linha de dado: rótulo, valor e as ações (copiar, WhatsApp...).
 *  No computador o rótulo vira coluna à esquerda; no celular fica em cima. */
export function Dado({ rotulo, children, acoes }: { rotulo: string; children: ReactNode; acoes?: ReactNode }) {
  return (
    <div className="flex items-center gap-3 py-2 sm:grid sm:grid-cols-[132px_minmax(0,1fr)_auto]">
      <div className="min-w-0 flex-1 sm:contents">
        <span className="block text-[12px] font-medium text-ink-soft sm:text-[13px]">{rotulo}</span>
        <span className="block min-w-0 break-words text-[14.5px] text-ink">{children}</span>
      </div>
      {acoes ? <span className="flex shrink-0 items-center gap-1">{acoes}</span> : <span />}
    </div>
  );
}

/** O que falta preencher, como atalhos: cada um abre a edição no campo. */
export function Faltando({ itens, aoAbrir }: { itens: { id: string; rotulo: string }[]; aoAbrir: (id: string) => void }) {
  if (!itens.length) return null;
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {itens.map((i) => (
        <button key={i.id} type="button" onClick={() => aoAbrir(i.id)}
          className="inline-flex cursor-pointer items-center gap-1 rounded-full bg-soft px-3 py-1.5 text-[12.5px] font-semibold text-accent transition-colors hover:bg-line">
          <Plus size={13} strokeWidth={2.5} /> {i.rotulo}
        </button>
      ))}
    </div>
  );
}

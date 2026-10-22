/*
  Pop-up de "Trocar e-mail e reenviar" (22/10/2026), aberto pelo cartão do
  contrato na ficha quando o contrato já foi pra Autentique com o e-mail do
  casal errado.

  Explica antes de fazer: o documento é o mesmo (a assinatura do fotógrafo
  continua valendo e não gasta documento do mês), só o link do casal muda e o
  antigo deixa de funcionar. Mesma casca dos outros pop-ups do painel.
*/
"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Mail, X } from "lucide-react";
import { Botao, Campo } from "./ui";

export function ModalTrocarEmail({ emailAtual, ocupado, erro, aoFechar, aoTrocar }: {
  emailAtual: string;
  ocupado: boolean;
  erro: string;
  aoFechar: () => void;
  aoTrocar: (email: string) => void;
}) {
  const [email, setEmail] = useState(emailAtual);
  const valido = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const igual = email.trim().toLowerCase() === emailAtual.trim().toLowerCase();

  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape" && !ocupado) aoFechar(); };
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [ocupado, aoFechar]);

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-5" role="dialog" aria-modal="true" aria-label="Trocar e-mail e reenviar">
      <div className="absolute inset-0 bg-[rgba(29,29,27,.5)] backdrop-blur-[2px]" onClick={() => { if (!ocupado) aoFechar(); }} />
      <form className="relative z-[1] w-full max-w-[440px] rounded-[18px] bg-paper p-8 pb-6 shadow-alta"
        onSubmit={(e) => { e.preventDefault(); if (valido && !ocupado) aoTrocar(email.trim()); }}>
        <button type="button" onClick={aoFechar} aria-label="Fechar" disabled={ocupado}
          className="absolute right-4 top-4 inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-[10px] text-ink-soft hover:bg-soft hover:text-ink">
          <X size={16} />
        </button>
        <h3 className="m-0 mb-3 flex items-center gap-3 pr-8 text-[22px] font-semibold leading-[1.25] text-ink">
          <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-accent-tint text-accent">
            <Mail size={16} />
          </span>
          Trocar e-mail e reenviar
        </h3>
        <p className="m-0 mb-4 text-[14.5px] leading-[1.6] text-ink-soft">
          A Autentique manda o pedido de assinatura pra esse e-mail. Se ele estava errado, corrija aqui; se está
          certo e o casal não recebeu, é só reenviar.
        </p>

        <Campo id="email-novo-casal" type="email" rotulo="E-mail do casal" autoFocus autoComplete="off"
          value={email} onChange={(e) => setEmail(e.target.value)} />

        <ul className="m-0 mb-1 grid list-none gap-1.5 rounded-[12px] bg-soft p-3.5 text-[13px] leading-[1.5] text-ink">
          {[
            "É o mesmo contrato: sua assinatura continua valendo.",
            "Não gasta documento da Autentique.",
            igual ? "A Autentique manda o e-mail de novo." : "O link do casal muda; o antigo para de funcionar.",
          ].map((t) => (
            <li key={t} className="flex items-start gap-2">
              <Check size={15} className="mt-0.5 shrink-0 text-ok" /> {t}
            </li>
          ))}
        </ul>

        {erro ? <p className="m-0 mt-3 text-[12.5px] leading-[1.5] text-erro">{erro}</p> : null}

        <div className="mt-6 flex flex-col-reverse gap-2.5 sm:flex-row">
          <Botao type="button" variante="secundario" className="sm:flex-1" onClick={aoFechar} disabled={ocupado}>Cancelar</Botao>
          <Botao type="submit" className="sm:flex-1" disabled={!valido || ocupado}>
            {ocupado ? (igual ? "Reenviando…" : "Trocando…") : (igual ? "Reenviar" : "Trocar e reenviar")}
          </Botao>
        </div>
      </form>
    </div>,
    document.body,
  );
}

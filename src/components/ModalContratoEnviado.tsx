/*
  Pop-up de "contrato assinado por você e pronto pro casal". Abre na ficha do
  cliente logo depois do "Assinar e enviar" (ou do "Atualizar na Autentique")
  do editor do contrato, que volta pra cá com `?enviado=`.

  Tudo o que dá pra fazer com o link num lugar só: copiar o link, copiar a
  mensagem pronta, abrir o WhatsApp do casal, abrir um e-mail pro casal e, no
  celular, a folha de compartilhar do sistema. "Ver contrato" leva pro
  documento no painel da Autentique, que é a fonte da verdade da assinatura.

  A Autentique está em entrega POR LINK (ver lib/autentique.ts): ela não manda
  e-mail sozinha, então é daqui que o contrato sai pro casal.

  Mesma casca do ModalConfirmar (fundo com desfoque, cartão de 440px, ícone em
  pill inline com o título).
*/
"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, CircleCheck, Copy, ExternalLink, Mail, MessageCircle, Share2, X } from "lucide-react";
import { copiarTexto } from "@/lib/ficha";

export type DadosEnviado = {
  link: string;
  mensagem: string;
  /** só dígitos; sem o 55 quando o cadastro não tem */
  telefone: string;
  email: string;
  /** endereço do documento no painel da Autentique */
  urlContrato: string;
  /** o documento foi trocado (edição depois de enviado): o link mudou */
  atualizado: boolean;
};

/* número brasileiro sem DDI (10 ou 11 dígitos) ganha o 55, senão o wa.me
   abre a conversa com o número errado */
function numeroWhatsApp(digitos: string): string {
  return digitos.length === 10 || digitos.length === 11 ? "55" + digitos : digitos;
}

export function ModalContratoEnviado({ dados, onFechar }: { dados: DadosEnviado; onFechar: () => void }) {
  const [copiado, setCopiado] = useState<"link" | "mensagem" | "erro" | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const podeCompartilhar = typeof navigator !== "undefined" && typeof navigator.share === "function";

  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") onFechar(); };
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("keydown", esc); if (timer.current) clearTimeout(timer.current); };
  }, [onFechar]);

  async function copiar(oque: "link" | "mensagem") {
    const ok = await copiarTexto(oque === "link" ? dados.link : dados.mensagem);
    setCopiado(ok ? oque : "erro");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopiado(null), 2200);
  }

  const assunto = "Contrato de fotografia pra assinar";
  const whatsapp = "https://wa.me/" + (dados.telefone ? numeroWhatsApp(dados.telefone) : "") +
    "?text=" + encodeURIComponent(dados.mensagem);
  const email = "mailto:" + encodeURIComponent(dados.email) +
    "?subject=" + encodeURIComponent(assunto) + "&body=" + encodeURIComponent(dados.mensagem);

  const opcao = "flex cursor-pointer flex-col items-center gap-1.5 rounded-[14px] bg-soft px-2 py-3 text-[12px] font-medium text-ink no-underline transition-[background-color,scale] duration-150 hover:bg-accent-tint hover:text-accent active:scale-[.97]";

  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-5" role="dialog" aria-modal="true" aria-label="Contrato pronto pro casal">
      <div className="absolute inset-0 bg-[rgba(29,29,27,.5)] backdrop-blur-[2px]" onClick={onFechar} />
      <div className="relative z-[1] w-full max-w-[440px] rounded-[18px] bg-paper p-8 pb-6 shadow-alta">
        <button type="button" onClick={onFechar} aria-label="Fechar"
          className="absolute right-4 top-4 inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-[10px] text-ink-soft hover:bg-soft hover:text-ink">
          <X size={16} />
        </button>

        <h3 className="m-0 mb-3 flex items-center gap-3 pr-8 text-[22px] font-semibold leading-[1.25] text-ink">
          <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-ok-tint text-ok">
            <CircleCheck size={17} />
          </span>
          {dados.atualizado ? "Contrato atualizado" : "Assinado por você"}
        </h3>
        <p className="m-0 text-[14.5px] leading-[1.6] text-ink-soft">
          {dados.atualizado
            ? "A versão nova já está na Autentique com a sua assinatura. O link mudou: mande este pro casal, o anterior não vale mais."
            : "Sua assinatura já está na Autentique. Agora é com o casal: mande o link por onde preferir."}
        </p>

        {/* o link, com o copiar do lado */}
        <div className="mt-4 flex items-center gap-2 rounded-[10px] bg-soft py-1 pl-3.5 pr-1">
          <input type="text" readOnly value={dados.link} aria-label="Link pro casal assinar"
            className="min-w-0 flex-1 bg-transparent py-2 text-[13px] text-ink outline-none" onFocus={(e) => e.target.select()} />
          <button type="button" onClick={() => void copiar("link")} aria-label="Copiar link" title="Copiar link"
            className={"inline-flex h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-[9px] px-2.5 text-[12.5px] font-medium transition-colors " +
              (copiado === "link" ? "text-ok" : "text-ink-soft hover:bg-line hover:text-accent")}>
            {copiado === "link" ? <Check size={15} /> : <Copy size={15} />}
            {copiado === "link" ? "Copiado" : "Copiar"}
          </button>
        </div>

        {/* por onde mandar */}
        <div className={"mt-3 grid gap-2 " + (podeCompartilhar ? "grid-cols-4" : "grid-cols-3")}>
          <a href={whatsapp} target="_blank" rel="noreferrer" className={opcao}>
            <MessageCircle size={18} /> WhatsApp
          </a>
          {dados.email ? (
            <a href={email} className={opcao}><Mail size={18} /> E-mail</a>
          ) : (
            <span className={opcao + " pointer-events-none opacity-45"} aria-disabled="true"><Mail size={18} /> E-mail</span>
          )}
          <button type="button" onClick={() => void copiar("mensagem")} className={opcao}>
            {copiado === "mensagem" ? <Check size={18} className="text-ok" /> : <Copy size={18} />}
            {copiado === "mensagem" ? "Copiada" : "Mensagem"}
          </button>
          {podeCompartilhar ? (
            <button type="button" className={opcao}
              onClick={() => { navigator.share({ title: assunto, text: dados.mensagem }).catch(() => { /* cancelou */ }); }}>
              <Share2 size={18} /> Mais
            </button>
          ) : null}
        </div>

        <p className={"m-0 mt-2.5 min-h-[18px] text-[12.5px] " + (copiado === "erro" ? "text-erro" : "text-ok")}>
          {copiado === "erro" ? "Não consegui copiar. Selecione o link e copie à mão." : copiado === "mensagem" ? "Mensagem com o link copiada" : ""}
        </p>

        <div className="mt-4 flex flex-col-reverse gap-2.5 sm:flex-row">
          <button type="button" onClick={onFechar}
            className="inline-flex h-11 cursor-pointer items-center justify-center rounded-xl bg-soft px-5 text-sm font-semibold text-ink transition-colors hover:bg-line sm:flex-1">
            Fechar
          </button>
          <a href={dados.urlContrato} target="_blank" rel="noreferrer"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-accent px-5 text-sm font-semibold text-white no-underline transition-colors hover:bg-accent-hover sm:flex-1">
            <ExternalLink size={15} /> Ver contrato
          </a>
        </div>
      </div>
    </div>,
    document.body,
  );
}

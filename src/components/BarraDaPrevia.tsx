/*
  Barra flutuante da prévia do Ateliê (brandbook, seção 23): diz que aquilo é
  rascunho (ou uma versão antiga), troca entre computador e celular e fecha.

  Fica por cima do site, então é do painel: Inter e o kit da casa, não a
  fonte da proposta. O modo celular mostra a mesma página num iframe de
  390px, pra as regras de celular do site valerem de verdade.

  Só aparece quando a prévia foi aberta pelo "Ver como fica" (?barra=1): a
  miniatura da galeria usa a mesma página e não pode ganhar barra.
*/
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Monitor, Smartphone, X } from "lucide-react";
import { Selo } from "@/components/ui";

export function BarraDaPrevia({ idModelo, nome, versao, publicadoEm }: {
  idModelo: string;
  nome: string;
  /** id da versão publicada que está na tela, ou null pro rascunho */
  versao: string | null;
  publicadoEm: string | null;
}) {
  const router = useRouter();
  const [celular, setCelular] = useState(false);
  /* A data da versão sai no fuso do APARELHO de quem olha, igual à lista de
     versões do editor. Por isso só depois de montar: no servidor o fuso é
     outro, e formatar lá daria uma hora diferente (e erro de hidratação). */
  const [rotulo, setRotulo] = useState(versao ? "Versão publicada" : "Rascunho");
  useEffect(() => {
    if (!versao || !publicadoEm) return;
    const t = setTimeout(() => setRotulo("Versão de " + new Date(publicadoEm).toLocaleString("pt-BR", {
      day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
    }).replace(".", "")), 0);
    return () => clearTimeout(t);
  }, [versao, publicadoEm]);
  const enderecoSemBarra = "/atelie/previa/" + idModelo + (versao ? "?versao=" + encodeURIComponent(versao) : "");

  /* com o quadro de celular aberto, a página de baixo não rola */
  useEffect(() => {
    if (!celular) return;
    const antes = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    return () => { document.documentElement.style.overflow = antes; };
  }, [celular]);

  function fechar() {
    /* aberta pelo "Ver como fica" (outra aba): fecha. Aberta direto pelo
       endereço, o navegador não deixa fechar, e aí volta pro editor. */
    window.close();
    setTimeout(() => router.push("/painel/atelie/" + idModelo), 150);
  }

  const pilula = (ativo: boolean) =>
    "inline-flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-[5px] text-[12.5px] font-semibold transition-colors " +
    (ativo ? "bg-paper text-accent shadow-card" : "text-ink-soft hover:text-ink");

  return (
    <>
      {celular ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-soft p-6 pb-24">
          <iframe src={enderecoSemBarra} title={"Prévia no celular de " + nome}
            className="h-full max-h-[844px] w-[390px] rounded-[28px] border-0 bg-paper shadow-alta" />
        </div>
      ) : null}

      <div className="fixed inset-x-4 bottom-[calc(1rem+var(--sab))] z-[95] mx-auto flex w-fit max-w-[calc(100%-2rem)] items-center gap-2.5 rounded-full bg-[linear-gradient(180deg,#ffffff,#f9fafb)] py-2 pl-3.5 pr-2 font-[family-name:var(--fonte-inter)] shadow-flutuante">
        <Selo tom={versao ? "neutro" : "atencao"}>{rotulo}</Selo>
        <span className="min-w-0 truncate text-[13px] font-semibold text-ink">{nome}</span>
        <span className="hidden gap-0.5 rounded-full bg-soft p-[3px] md:flex">
          <button type="button" onClick={() => setCelular(false)} aria-pressed={!celular} className={pilula(!celular)}>
            <Monitor size={14} /> Computador
          </button>
          <button type="button" onClick={() => setCelular(true)} aria-pressed={celular} className={pilula(celular)}>
            <Smartphone size={14} /> Celular
          </button>
        </span>
        <button type="button" onClick={fechar} aria-label="Fechar a prévia" title="Fechar"
          className="inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full text-ink-soft transition-colors hover:bg-soft hover:text-ink">
          <X size={16} />
        </button>
      </div>
    </>
  );
}

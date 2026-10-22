/*
  Versões publicadas de um modelo do Ateliê (brandbook, seção 23): a rede de
  segurança de quem publicou algo errado. Lista as publicações da mais nova
  pra mais antiga; "Ver" abre a prévia daquela versão e "Restaurar" leva a
  versão pro rascunho (quem chama confirma e recarrega o editor). Restaurar
  não publica.

  Mesma janela da biblioteca de fotos: sobre a tela no computador, folha de
  baixo pra cima no celular.
*/
"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { History, X } from "lucide-react";
import { Botao, Selo } from "@/components/ui";
import { api } from "@/lib/painel";

type Versao = { id: string; publicado_em: string; blocos: number };

function quando(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
    .replace(".", "");
}

export function VersoesAtelie({ idModelo, noAr, aoRestaurar, aoFechar }: {
  idModelo: string;
  /** o modelo está no ar: a versão mais nova é a que o público vê */
  noAr: boolean;
  aoRestaurar: (versao: { id: string; quando: string }) => void;
  aoFechar: () => void;
}) {
  const [versoes, setVersoes] = useState<Versao[] | null>(null);
  const [falha, setFalha] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    api<{ versoes: Versao[] }>("/api/atelie?versoes=" + encodeURIComponent(idModelo))
      .then((r) => { if (vivo) setVersoes(r.versoes); })
      .catch(() => { if (vivo) { setFalha("Não consegui carregar as versões, tente de novo."); setVersoes([]); } });
    return () => { vivo = false; };
  }, [idModelo]);

  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => { if (e.key === "Escape") aoFechar(); };
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [aoFechar]);

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-[rgba(29,29,27,.38)] md:items-center md:p-6"
      onPointerDown={(e) => { if (e.target === e.currentTarget) aoFechar(); }}>
      <div role="dialog" aria-modal="true" aria-label="Versões publicadas"
        className="flex max-h-[86dvh] w-full max-w-[560px] flex-col rounded-t-[22px] bg-paper pb-[var(--sab)] shadow-alta md:rounded-[22px] md:pb-0">
        <div className="flex shrink-0 items-center gap-3 px-5 pb-2 pt-4">
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[13px] bg-accent-tint text-accent">
            <History size={17} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="m-0 text-[16px] font-semibold text-ink">Versões publicadas</h2>
            <p className="m-0 text-[12px] text-ink-soft">Restaurar leva a versão pro rascunho. Pra voltar ao ar, é só publicar.</p>
          </div>
          <button type="button" onClick={aoFechar} aria-label="Fechar"
            className="inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-[10px] text-ink-soft transition-colors hover:bg-soft hover:text-ink">
            <X size={18} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-4">
          {falha ? <p className="m-0 mx-2 my-2 rounded-[10px] bg-erro-tint px-3.5 py-2.5 text-[13px] text-erro">{falha}</p> : null}
          {versoes === null ? (
            <p className="m-0 px-2 py-4 text-[13px] text-ink-soft">Carregando…</p>
          ) : versoes.length === 0 && !falha ? (
            <p className="m-0 px-2 py-4 text-[13px] text-ink-soft">Este modelo ainda não foi publicado.</p>
          ) : (
            <ul className="m-0 grid list-none gap-1 p-0">
              {versoes.map((v, i) => (
                <li key={v.id} className="flex items-center gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-soft">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[13.5px] font-semibold text-ink">{quando(v.publicado_em)}</span>
                      {noAr && i === 0 ? <Selo tom="ok">No ar</Selo> : null}
                    </div>
                    <div className="text-[12px] text-ink-soft">{v.blocos === 1 ? "1 bloco" : v.blocos + " blocos"}</div>
                  </div>
                  <Botao variante="fantasma" className="h-9 px-3 text-[13px]"
                    onClick={() => window.open("/atelie/previa/" + idModelo + "?versao=" + v.id + "&barra=1", "_blank", "noopener")}>
                    Ver
                  </Botao>
                  <Botao variante="secundario" className="h-9 px-3 text-[13px]" onClick={() => aoRestaurar({ id: v.id, quando: quando(v.publicado_em) })}>
                    Restaurar
                  </Botao>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

/*
  Prévia de uma seção pronta do Ateliê: a página /atelie/secao/<tipo> num
  iframe de 1280px encolhido até a largura da caixa (como a miniatura da
  galeria), então sai com o layout de computador mesmo no celular.

  Quinas: mesmo cuidado da miniatura (raio próprio, isolate e fundo claro),
  senão o iframe com transform vaza o fundo na curva.

  A lista de blocos do Puck desenha cada item duas vezes: a cópia de baixo
  (`_Drawer-draggableBg_`) é a que fica no lugar enquanto a de cima é
  arrastada. Ela não carrega iframe: seriam duas páginas por seção, e no
  arrasto só aparece um instante.
*/
"use client";

import { useEffect, useRef, useState } from "react";
import type { TipoDeSecao } from "@/lib/atelie/tipos";

const LARGURA_PREVIA = 1280;

export function PreviaSecao({ tipo, raio = 10 }: { tipo: TipoDeSecao; raio?: number }) {
  const caixa = useRef<HTMLDivElement>(null);
  const [escala, setEscala] = useState(0);
  const [copia, setCopia] = useState(false);

  useEffect(() => {
    const el = caixa.current;
    if (!el) return;
    if (el.closest('[class*="_Drawer-draggableBg_"]')) { setCopia(true); return; }
    const medir = () => setEscala(el.clientWidth / LARGURA_PREVIA);
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={caixa} className="relative isolate aspect-[16/10] overflow-hidden bg-soft"
      style={{ borderTopLeftRadius: raio, borderTopRightRadius: raio }}>
      {escala > 0 && !copia ? (
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

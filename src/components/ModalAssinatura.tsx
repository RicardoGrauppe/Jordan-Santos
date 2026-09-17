/*
  Criar/editar uma assinatura do fotógrafo. Portado do #modal-assinatura de
  configuracoes.html, com as decisões fechadas lá:

  - Nome PRIMEIRO, já preenchido com "Assinatura N" (pula números em uso, pra
    apagar uma do meio não gerar nome repetido).
  - Os três modos são ABAS SUBLINHADAS dentro de uma caixa única, cada uma com
    um terço da largura; a caixa tem ALTURA TRAVADA (a do modo mais alto) pra
    o modal não pular ao trocar de aba; o preview estica pra ocupar a sobra.
  - Desenhar não tem preview separado (o canvas já é a assinatura) e tem uma
    linha de assinatura em CSS, NÃO desenhada no canvas: desenhada, entraria no
    toDataURL e sairia carimbada no contrato.
  - Enviar imagem não usa o <input type=file> nativo: a área inteira é o botão.
  - No celular vira sheet de 80% que sobe de baixo; no desktop é cartão.
*/
"use client";

import { useEffect, useRef, useState } from "react";
import { Eraser, ImagePlus, PenTool, X } from "lucide-react";
import { Botao, Campo, Estado } from "./ui";

export type TipoAssinatura = "cursiva" | "rubrica" | "imagem";
export type Assinatura = { id?: string; nome: string; tipo: TipoAssinatura; valor: string; ativo?: boolean };

type Props = {
  aberto: boolean;
  editando: Assinatura | null;
  existentes: Assinatura[];
  aoFechar: () => void;
  aoSalvar: (a: Assinatura) => Promise<void>;
};


function proximoNome(existentes: Assinatura[]): string {
  const usados = new Set(existentes.map((a) => a.nome.trim().toLowerCase()));
  let n = 1;
  while (usados.has("assinatura " + n)) n++;
  return "Assinatura " + n;
}

/* Casca: o formulário só existe enquanto o modal está aberto, e a `key` troca
   quando muda a assinatura editada. Assim o estado nasce certo no useState em
   vez de ser "resetado" num efeito (que renderiza uma vez com o valor velho). */
export function ModalAssinatura(props: Props) {
  if (!props.aberto) return null;
  return <FormularioAssinatura key={props.editando?.id ?? "nova"} {...props} />;
}

function FormularioAssinatura({ aberto, editando, existentes, aoFechar, aoSalvar }: Props) {
  const [nome, setNome] = useState(() => (editando ? editando.nome : proximoNome(existentes)));
  const [modo, setModo] = useState<TipoAssinatura>(editando?.tipo ?? "cursiva");
  const [valor, setValor] = useState(editando?.valor ?? "");
  const [msg, setMsg] = useState<{ texto: string; tom?: "ok" | "erro" }>({ texto: "" });
  const [salvando, setSalvando] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  /* canvas: altura MEDIDA, não fixa (ele estica na caixa), senão o buffer não
     bate com a área visível e o traço sai deslocado do cursor */
  useEffect(() => {
    if (!aberto || modo !== "rubrica") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const escala = window.devicePixelRatio || 1;
    canvas.width = rect.width * escala;
    canvas.height = (rect.height || 130) * escala;
    const ctx = canvas.getContext("2d")!;
    ctx.scale(escala, escala);
    ctx.lineWidth = 2.2; ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.strokeStyle = "#1F2329";
    let desenhando = false, ux = 0, uy = 0;
    const pos = (e: MouseEvent | TouchEvent) => {
      const r = canvas.getBoundingClientRect();
      const t = "touches" in e ? e.touches[0] : e;
      return { x: t.clientX - r.left, y: t.clientY - r.top };
    };
    const inicio = (e: MouseEvent | TouchEvent) => { desenhando = true; const p = pos(e); ux = p.x; uy = p.y; e.preventDefault(); };
    const move = (e: MouseEvent | TouchEvent) => {
      if (!desenhando) return;
      const p = pos(e); ctx.beginPath(); ctx.moveTo(ux, uy); ctx.lineTo(p.x, p.y); ctx.stroke(); ux = p.x; uy = p.y; e.preventDefault();
    };
    const fim = () => { if (!desenhando) return; desenhando = false; setValor(canvas.toDataURL("image/png")); };
    canvas.addEventListener("mousedown", inicio); canvas.addEventListener("mousemove", move); window.addEventListener("mouseup", fim);
    canvas.addEventListener("touchstart", inicio, { passive: false }); canvas.addEventListener("touchmove", move, { passive: false }); canvas.addEventListener("touchend", fim);
    return () => {
      canvas.removeEventListener("mousedown", inicio); canvas.removeEventListener("mousemove", move); window.removeEventListener("mouseup", fim);
      canvas.removeEventListener("touchstart", inicio); canvas.removeEventListener("touchmove", move); canvas.removeEventListener("touchend", fim);
    };
  }, [aberto, modo]);

  if (!aberto) return null;

  function trocarModo(m: TipoAssinatura) { setModo(m); setValor(""); }

  function escolherArquivo(f: File | undefined) {
    if (!f) return;
    if (f.size > 1.5 * 1024 * 1024) { setMsg({ texto: "Imagem muito grande (máx 1,5MB).", tom: "erro" }); return; }
    const fr = new FileReader();
    fr.onload = () => setValor(String(fr.result));
    fr.readAsDataURL(f);
  }

  async function salvar() {
    if (!valor) { setMsg({ texto: "Defina a assinatura primeiro.", tom: "erro" }); return; }
    setSalvando(true);
    try {
      /* campo apagado: editando volta pro nome atual, criando pega o próximo
         número livre; card sem rótulo não pode existir */
      const n = nome.trim() || editando?.nome || proximoNome(existentes);
      await aoSalvar({ id: editando?.id, nome: n, tipo: modo, valor });
      aoFechar();
    } catch (e) { setMsg({ texto: (e as Error).message || "Não deu pra salvar.", tom: "erro" }); }
    finally { setSalvando(false); }
  }

  const aba = (m: TipoAssinatura, rotulo: string) => (
    <button
      type="button" role="tab" aria-selected={modo === m} onClick={() => trocarModo(m)}
      className={"relative flex-1 cursor-pointer whitespace-nowrap px-1 py-3 text-[12px] font-medium transition-colors md:text-[13px] " +
        (modo === m ? "font-semibold text-accent after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:rounded-t-sm after:bg-accent" : `text-ink-soft hover:text-ink`)}
    >{rotulo}</button>
  );

  const VAZIO: Partial<Record<TipoAssinatura, string>> = {
    cursiva: "O nome que você digitar abaixo aparece aqui, já na letra da assinatura.",
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-end justify-center md:items-center md:p-5">
      <div className="absolute inset-0 bg-[rgba(29,29,27,.5)] backdrop-blur-[2px]" onClick={aoFechar} />
      <div
        role="dialog" aria-modal="true" aria-label={editando ? "Editar assinatura" : "Nova assinatura"}
        className="relative z-[1] flex h-[80dvh] w-full flex-col overflow-y-auto rounded-t-[18px] bg-paper p-5 pb-[calc(20px+var(--sab))] shadow-alta md:h-auto md:max-h-[calc(100dvh-40px)] md:max-w-[520px] md:rounded-[18px] md:p-8 md:pb-6"
      >
        <button type="button" onClick={aoFechar} aria-label="Fechar"
          className={`absolute right-[18px] top-[18px] inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-[9px] text-ink-soft hover:bg-soft hover:text-ink`}>
          <X size={17} />
        </button>

        <h3 className="m-0 mb-3.5 flex items-center gap-3 pr-10 text-[22px] font-semibold leading-[1.25] text-ink">
          <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-accent-tint text-accent"><PenTool size={16} /></span>
          {editando ? "Editar assinatura" : "Nova assinatura"}
        </h3>

        <Campo id="assin-nome" rotulo="Nome desta assinatura" maxLength={40} value={nome} onChange={(e) => setNome(e.target.value)} />

        <div className="mb-1 overflow-hidden rounded-xl bg-soft">
          <div role="tablist" className="flex shadow-[inset_0_-1px_0_var(--color-line)]">
            {aba("cursiva", "Fonte cursiva")}{aba("rubrica", "Desenhar")}{aba("imagem", "Enviar imagem")}
          </div>

          {/* altura travada: 270 no desktop; no celular cabe nos 80% sem rolar */}
          <div className="flex flex-col p-3.5" style={{ height: "max(150px, min(270px, calc(80dvh - 340px)))" }}>
            {modo !== "rubrica" ? (
              <div className="flex min-h-0 flex-1 items-center justify-center px-1 pb-3.5 pt-2.5">
                {modo === "imagem" && !valor ? (
                  <button type="button" onClick={() => fileRef.current?.click()}
                    className={`flex flex-1 cursor-pointer flex-col items-center justify-center gap-2 self-stretch rounded-[10px] p-3 text-ink-soft hover:bg-paper`}>
                    <span className="inline-flex h-11 w-11 items-center justify-center rounded-[14px] bg-accent-tint text-accent"><ImagePlus size={20} /></span>
                    <span className="text-[13.5px] font-semibold text-ink">Escolher uma imagem</span>
                    <span className="text-[11.5px]">PNG, JPG ou WEBP, até 1,5 MB</span>
                  </button>
                ) : !valor ? (
                  <span className="max-w-[31ch] text-center text-[13px] leading-[1.5] text-ink-soft">{VAZIO[modo]}</span>
                ) : modo === "cursiva" ? (
                  <span className="text-[30px] text-ink" style={{ fontFamily: '"Segoe Script","Bradley Hand",cursive' }}>{valor}</span>
                ) : (
                  <img src={valor} alt="assinatura" className="max-h-full max-w-full" />
                )}
              </div>
            ) : null}

            {modo === "cursiva" ? (
              <input type="text" placeholder="Digite o nome pra assinar" maxLength={40} value={valor} onChange={(e) => setValor(e.target.value.trim())}
                className="w-full rounded-[10px] bg-paper px-3.5 py-3 text-base text-ink outline-none placeholder:text-ink-soft/70" />
            ) : modo === "imagem" ? (
              <>
                <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => escolherArquivo(e.target.files?.[0])} />
                {valor ? <button type="button" onClick={() => fileRef.current?.click()} className={`mt-2 inline-flex cursor-pointer items-center gap-1.5 self-start rounded-lg px-2 py-1.5 text-[13px] text-ink-soft hover:bg-paper`}><ImagePlus size={14} /> Trocar imagem</button> : null}
              </>
            ) : (
              <div className="flex min-h-0 flex-1 flex-col">
                {/* linha de assinatura em CSS, não no canvas */}
                <canvas ref={canvasRef} className="block min-h-0 w-full flex-1 touch-none rounded-[10px]"
                  style={{ background: "linear-gradient(var(--color-line),var(--color-line)) no-repeat, #fff", backgroundSize: "calc(100% - 44px) 1px, auto", backgroundPosition: "22px calc(100% - 30px), 0 0" }} />
                <div className="mt-2 flex shrink-0 justify-end">
                  <button type="button" onClick={() => { const c = canvasRef.current; c?.getContext("2d")?.clearRect(0, 0, c.width, c.height); setValor(""); }}
                    className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-2 py-1.5 text-[13px] text-ink-soft hover:bg-paper`}><Eraser size={14} /> Limpar</button>
                </div>
              </div>
            )}
          </div>
        </div>

        <Estado texto={msg.texto} tom={msg.tom} />

        <div className="mt-5 flex flex-col-reverse gap-2.5 sm:flex-row">
          <Botao variante="secundario" className="sm:flex-1" onClick={aoFechar}>Cancelar</Botao>
          <Botao className="sm:flex-1" onClick={salvar} disabled={salvando}>{editando ? "Salvar alterações" : "Salvar assinatura"}</Botao>
        </div>
      </div>
    </div>
  );
}

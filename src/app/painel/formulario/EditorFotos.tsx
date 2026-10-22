/*
  Fotos da abertura do /cadastro, primeiro card do editor de Formulário
  (brandbook 18). As que o casal vê passando, na ordem em que passam.

  A lista é parte da config do formulário e vai embora com o salvamento
  automático da página, como o resto. Enviar uma foto é outra coisa: ela sobe
  na hora (o servidor converte pra webp de 750 e 1200px e guarda no bucket) e
  só então entra na lista. Tirar não apaga nada daqui: quem apaga o arquivo é
  o /api/formulario, depois de gravar a lista sem ela.

  `aoMudar` recebe uma FUNÇÃO da lista atual, e não a lista: várias fotos
  sobem uma depois da outra, e cada uma precisa entrar na lista que já tem a
  anterior, não na que existia quando o envio começou.
*/
"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { ArrowLeft, ArrowRight, Crop, ImagePlus, Images, LoaderCircle, Trash2 } from "lucide-react";
import { useConfirmar } from "@/components/ModalConfirmar";
import { MAX_FOTOS, urlFoto, type FotoAbertura } from "@/lib/formulario";

type Props = {
  fotos: FotoAbertura[];
  aoMudar: (fn: (atual: FotoAbertura[]) => FotoAbertura[]) => void;
};

const BOTAO_ICONE =
  "inline-flex h-[30px] w-[30px] shrink-0 cursor-pointer items-center justify-center rounded-[9px] " +
  "bg-transparent text-ink-soft transition-colors hover:bg-line hover:text-accent disabled:cursor-default disabled:opacity-35";

export function EditorFotos({ fotos, aoMudar }: Props) {
  const confirmar = useConfirmar();
  const entrada = useRef<HTMLInputElement>(null);
  const [enviando, setEnviando] = useState(0);
  const [erro, setErro] = useState("");
  const [enquadrando, setEnquadrando] = useState<string | null>(null);

  const cabe = MAX_FOTOS - fotos.length - enviando;

  async function enviar(ev: ChangeEvent<HTMLInputElement>) {
    const escolhidas = Array.from(ev.target.files ?? []);
    ev.target.value = "";
    if (!escolhidas.length) return;
    setErro("");
    const vao = escolhidas.slice(0, Math.max(0, cabe));
    if (vao.length < escolhidas.length) setErro("Cabem até " + MAX_FOTOS + " fotos, as que passaram ficaram de fora.");
    setEnviando((n) => n + vao.length);
    /* uma de cada vez, na ordem escolhida: é a ordem em que entram na lista */
    for (const arquivo of vao) {
      try {
        const corpo = new FormData();
        corpo.append("foto", arquivo);
        const r = await fetch("/api/formulario/fotos", { method: "POST", body: corpo });
        const j = (await r.json().catch(() => ({}))) as { foto?: FotoAbertura; erro?: string };
        if (!r.ok || !j.foto) throw new Error(j.erro || "Não consegui enviar a foto, tente de novo.");
        const nova = j.foto;
        aoMudar((atual) => (atual.length >= MAX_FOTOS ? atual : [...atual, nova]));
      } catch (e) {
        setErro((e as Error).message);
      } finally {
        setEnviando((n) => n - 1);
      }
    }
  }

  function mover(id: string, passo: -1 | 1) {
    aoMudar((atual) => {
      const i = atual.findIndex((f) => f.id === id);
      const j = i + passo;
      if (i < 0 || j < 0 || j >= atual.length) return atual;
      const lista = [...atual];
      [lista[i], lista[j]] = [lista[j], lista[i]];
      return lista;
    });
  }

  function enquadrar(id: string, foco: number) {
    aoMudar((atual) => atual.map((f) => (f.id === id ? { ...f, foco } : f)));
  }

  async function tirar(f: FotoAbertura) {
    const ok = await confirmar({
      titulo: "Tirar esta foto?",
      texto: f.origem === "enviada"
        ? "Ela sai da abertura do formulário e é apagada."
        : "Ela sai da abertura do formulário.",
      rotuloOk: "Tirar",
      perigo: true,
    });
    if (!ok) return;
    if (enquadrando === f.id) setEnquadrando(null);
    /* a última não sai: a abertura nunca fica sem foto */
    aoMudar((atual) => (atual.length <= 1 ? atual : atual.filter((x) => x.id !== f.id)));
  }

  return (
    <section className="mb-4 rounded-[22px] bg-paper px-4 pb-5 pt-[20px] shadow-card md:px-6 md:pb-6">
      <h2 className="m-0 flex items-center gap-[9px] text-[13px] font-semibold tracking-[.02em] text-ink">
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[13px] bg-accent-tint text-accent">
          <Images size={16} />
        </span>
        <span className="flex-1">Fotos da abertura</span>
        <span className="text-[12px] font-normal tracking-normal text-ink-soft">{fotos.length} de {MAX_FOTOS}</span>
      </h2>
      <p className="m-0 mt-2 text-[12.5px] text-ink-soft">
        Passam na abertura do formulário, uma de cada vez, nesta ordem. O quadro mostra o recorte que o casal vê.
      </p>

      <ul className="m-0 mt-4 grid list-none grid-cols-2 gap-3 p-0 md:grid-cols-3">
        {fotos.map((f, i) => {
          const aberta = enquadrando === f.id;
          return (
            <li key={f.id} className="overflow-hidden rounded-[14px] bg-[#F7F9FA]">
              <div className="relative aspect-[4/3] bg-soft">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={urlFoto(f, 750)} alt={f.alt} loading="lazy" decoding="async"
                  className="absolute inset-0 h-full w-full object-cover"
                  style={{ objectPosition: "50% " + f.foco + "%" }} />
                <span className="absolute left-2 top-2 inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-white/85 px-1.5 text-[11.5px] font-semibold text-ink">
                  {i + 1}
                </span>
              </div>
              <div className="flex items-center gap-0.5 px-1.5 py-1.5">
                <button type="button" className={BOTAO_ICONE} disabled={i === 0} aria-label="Passar antes"
                  onClick={() => mover(f.id, -1)}>
                  <ArrowLeft size={14} />
                </button>
                <button type="button" className={BOTAO_ICONE} disabled={i === fotos.length - 1} aria-label="Passar depois"
                  onClick={() => mover(f.id, 1)}>
                  <ArrowRight size={14} />
                </button>
                <button type="button" aria-pressed={aberta} aria-label="Enquadrar"
                  className={BOTAO_ICONE + " ml-auto" + (aberta ? " bg-line text-accent" : "")}
                  onClick={() => setEnquadrando(aberta ? null : f.id)}>
                  <Crop size={14} />
                </button>
                <button type="button" aria-label="Tirar foto" disabled={fotos.length <= 1}
                  className={BOTAO_ICONE + " hover:bg-erro-tint hover:text-erro"}
                  onClick={() => void tirar(f)}>
                  <Trash2 size={14} />
                </button>
              </div>
              {aberta ? (
                <div className="px-3 pb-3">
                  <input type="range" min={0} max={100} step={1} value={f.foco}
                    aria-label="Enquadramento vertical"
                    onChange={(e) => enquadrar(f.id, Number(e.target.value))}
                    className="block w-full cursor-pointer accent-accent outline-none" />
                  <div className="mt-1 flex justify-between text-[11px] text-ink-soft">
                    <span>Mais pra cima</span><span>Mais pra baixo</span>
                  </div>
                </div>
              ) : null}
            </li>
          );
        })}

        {Array.from({ length: enviando }, (_, i) => (
          <li key={"enviando-" + i}
            className="flex aspect-[4/3] flex-col items-center justify-center gap-1.5 rounded-[14px] bg-soft text-[12.5px] text-ink-soft">
            <LoaderCircle size={18} className="animate-spin text-accent" />
            Enviando…
          </li>
        ))}

        {cabe > 0 ? (
          <li>
            <button type="button" onClick={() => entrada.current?.click()}
              className="flex aspect-[4/3] w-full cursor-pointer flex-col items-center justify-center gap-1.5 rounded-[14px] bg-soft text-accent transition-colors hover:bg-line">
              <ImagePlus size={20} />
              <span className="text-[13px] font-medium">Adicionar fotos</span>
              <span className="text-[11px] text-ink-soft">JPG, PNG ou WEBP</span>
            </button>
          </li>
        ) : null}
      </ul>

      <input ref={entrada} type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden"
        onChange={(e) => void enviar(e)} />
      {erro ? <p className="m-0 mt-3 text-[12.5px] text-erro" role="alert">{erro}</p> : null}
    </section>
  );
}

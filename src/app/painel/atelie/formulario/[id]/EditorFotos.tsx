/*
  Fotos da abertura do /cadastro, primeiro card do editor de Formulário
  (brandbook 18). As que o casal vê passando, na ordem em que passam.

  A lista é parte da config do formulário e vai embora com o salvamento
  automático da página, como o resto. Enviar uma foto é outra coisa: ela sobe
  na hora (o servidor converte pra webp de 750 e 1200px e guarda no bucket) e
  só então entra na lista. Tirar não apaga nada daqui: quem apaga o arquivo é
  o /api/formulario, depois de gravar a lista sem ela.

  O card abre como PRÉVIA, a abertura do jeito que o casal vê (fotos
  trocando, logo, pontinhos), e o botão "Editar" no canto troca pela grade
  de edição; lá ele vira "Concluir" e volta pra prévia.

  `aoMudar` recebe uma FUNÇÃO da lista atual, e não a lista: várias fotos
  sobem uma depois da outra, e cada uma precisa entrar na lista que já tem a
  anterior, não na que existia quando o envio começou.
*/
"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { ArrowLeft, ArrowRight, Check, Crop, ImagePlus, Images, LoaderCircle, Pencil, Trash2 } from "lucide-react";
import { useConfirmar } from "@/components/ModalConfirmar";
import { MAX_FOTOS, urlFoto, type FotoAbertura } from "@/lib/formulario";

type Props = {
  fotos: FotoAbertura[];
  aoMudar: (fn: (atual: FotoAbertura[]) => FotoAbertura[]) => void;
};

const BOTAO_ICONE =
  "inline-flex h-[30px] w-[30px] shrink-0 cursor-pointer items-center justify-center rounded-[9px] " +
  "bg-transparent text-ink-soft transition-colors hover:bg-line hover:text-accent disabled:cursor-default disabled:opacity-35";

/* mesmo ritmo da abertura do /cadastro (TEMPO_FOTO em FormularioCadastro) */
const TEMPO_FOTO = 5500;

/* A abertura como o casal vê, no tamanho do celular. Mesmas regras da de lá:
   só a atual e a próxima são baixadas, parada com uma foto só e pra quem
   pede menos movimento. */
function PreviaAbertura({ fotos }: { fotos: FotoAbertura[] }) {
  const [atual, setAtual] = useState(0);
  const [baixadas, setBaixadas] = useState(2);
  const total = fotos.length;
  const mostrada = atual % Math.max(1, total);

  useEffect(() => {
    if (total < 2 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => {
      setAtual((a) => (a + 1) % total);
      setBaixadas((b) => Math.min(total, b + 1));
    }, TEMPO_FOTO);
    return () => clearInterval(t);
  }, [total]);

  return (
    <div className="mx-auto w-full max-w-[476px]">
      <div className="relative aspect-[4/3] overflow-hidden rounded-[22px] bg-soft">
        {fotos.slice(0, Math.max(baixadas, mostrada + 1)).map((f, i) => (
          <div key={f.id} aria-hidden={i !== mostrada}
            className={"absolute inset-0 transition-opacity duration-[1400ms] ease-in-out motion-reduce:transition-none " +
              (i === mostrada ? "opacity-100" : "opacity-0")}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={urlFoto(f, 750)} srcSet={urlFoto(f, 750) + " 750w, " + urlFoto(f, 1200) + " 1200w"}
              sizes="(min-width: 768px) 476px, calc(100vw - 72px)" alt={f.alt} decoding="async"
              className={"absolute inset-0 h-full w-full object-cover transition-[scale] duration-[7000ms] ease-linear motion-reduce:transition-none " +
                (i === mostrada ? "scale-100" : "scale-[1.08]")}
              style={{ objectPosition: "50% " + f.foco + "%" }} />
          </div>
        ))}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[45%] bg-gradient-to-t from-[rgba(29,29,27,.55)] to-transparent" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/img/logo-principal-offwhite.png" alt="" aria-hidden
          className="absolute bottom-[18px] left-5 h-[30px] w-auto opacity-95" />
        {total > 1 ? (
          <div className="absolute bottom-6 right-5 flex items-center gap-1.5" aria-hidden>
            {fotos.map((f, i) => (
              <span key={f.id}
                className={"h-1.5 rounded-full transition-[width,background-color] duration-[400ms] " +
                  (i === mostrada ? "w-[18px] bg-white" : "w-1.5 bg-white/50")} />
            ))}
          </div>
        ) : null}
      </div>
      <p className="m-0 mt-2.5 text-center text-[12px] text-ink-soft">
        Assim o casal vê a abertura. {total > 1 ? "As fotos trocam a cada 5 segundos." : ""}
      </p>
    </div>
  );
}

export function EditorFotos({ fotos, aoMudar }: Props) {
  const confirmar = useConfirmar();
  const entrada = useRef<HTMLInputElement>(null);
  const [enviando, setEnviando] = useState(0);
  const [erro, setErro] = useState("");
  const [enquadrando, setEnquadrando] = useState<string | null>(null);
  /* prévia por padrão; a grade só abre no "Editar" */
  const [editando, setEditando] = useState(false);

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
        {editando ? (
          <span className="hidden text-[12px] font-normal tracking-normal text-ink-soft sm:inline">{fotos.length} de {MAX_FOTOS}</span>
        ) : null}
        <button type="button" aria-expanded={editando}
          onClick={() => { setEditando((v) => !v); setEnquadrando(null); }}
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-soft px-3 py-1.5 text-[12.5px] font-medium tracking-normal text-accent transition-colors hover:bg-line">
          {editando ? <Check size={14} /> : <Pencil size={13} />}
          {editando ? "Concluir" : "Editar"}
        </button>
      </h2>

      {!editando ? (
        <div className="mt-4"><PreviaAbertura fotos={fotos} /></div>
      ) : (
      <>
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

      </>
      )}

      {/* fora da grade: um envio que ainda está rodando quando a pessoa clica
          em Concluir continua e entra na lista */}
      <input ref={entrada} type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden"
        onChange={(e) => void enviar(e)} />
      {erro ? <p className="m-0 mt-3 text-[12.5px] text-erro" role="alert">{erro}</p> : null}
    </section>
  );
}

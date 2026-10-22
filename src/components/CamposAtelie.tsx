/*
  Campos de foto do Ateliê (brandbook, seção 21), como campos "custom" do
  Puck: quem escolhe a foto não digita endereço, escolhe na biblioteca.

  - CampoFoto / CampoFotoOpcional: miniatura + "Trocar foto" (+ "Tirar" na
    opcional), que abre a BibliotecaFotos.
  - CampoFoco: a própria foto do bloco com um ponto; tocar ou arrastar
    escolhe o que não pode ser cortado. Grava o object-position ("48% 30%").
    A foto vem do campo vizinho (src, foto ou faixa) do mesmo bloco ou do
    mesmo item da lista: o Puck nomeia o campo como "fotos[0].foco", e trocar
    o último pedaço do nome dá o vizinho.

  Este módulo é de cliente e o `blocos.tsx` só REFERENCIA os componentes (não
  chama nada daqui): o mesmo config roda no servidor, no <Render>, onde os
  campos nem são desenhados.

  Antes de subir, a foto é reduzida no navegador (lado maior até 2560px, JPEG;
  PNG continua PNG por causa da transparência dos logos).
*/
"use client";

import { useCallback, useEffect, useRef, useState, type PointerEvent as EventoPonteiro } from "react";
import { createPortal } from "react-dom";
import { createUsePuck, type CustomFieldRender } from "@puckeditor/core";
import { Check, ImagePlus, Trash2, Upload, X } from "lucide-react";
import { Botao } from "@/components/ui";
import { useConfirmar } from "@/components/ModalConfirmar";
import { api } from "@/lib/painel";

const usePuck = createUsePuck();

const URL_MIDIA = "/api/atelie/midia";
const LADO_MAX = 2560;

type Midia = { id: string; url: string; nome: string; largura: number | null; altura: number | null };

/* As fotos que vieram com o site (public/img), pra continuarem à mão depois
   de trocadas por uma enviada. */
const FOTOS_DO_SITE: { url: string; nome: string }[] = [
  { url: "/img/casal-jardim.jpg", nome: "Casal no jardim" },
  { url: "/img/noiva-retrato.jpg", nome: "Retrato da noiva" },
  { url: "/img/casal-campo.jpg", nome: "Casal no campo" },
  { url: "/img/album.jpg", nome: "Álbum aberto" },
  { url: "/img/prewedding.jpg", nome: "Pré-wedding" },
  { url: "/img/entrega-1.jpg", nome: "Noivos no corredor" },
  { url: "/img/entrega-2.jpg", nome: "Noiva no salão" },
  { url: "/img/entrega-3.jpg", nome: "Noivos de perto" },
  { url: "/img/casal-palacio.jpg", nome: "Noivos no palácio" },
  { url: "/img/logo-principal-offwhite.png", nome: "Logo claro" },
  { url: "/img/logo-principal-petroleo.png", nome: "Logo petróleo" },
  { url: "/img/assinatura-offwhite.png", nome: "Assinatura clara" },
];

/* Logo e assinatura são claros (PNG do estúdio, ou o logo de exemplo em SVG)
   e sumiriam num ladrilho claro: ganham fundo escuro e aparecem inteiros. */
const ehMarca = (url: string) => url.endsWith(".png") || url.includes("/exemplo-logo");
const fundoDaMiniatura = (url: string) => (ehMarca(url) ? "bg-noir" : "bg-[#EEF0F3]");

/* ---------- redução no navegador ---------- */

async function reduzir(arquivo: File): Promise<{ blob: Blob; largura: number; altura: number; nome: string }> {
  const imagem = await createImageBitmap(arquivo, { imageOrientation: "from-image" });
  const escala = Math.min(1, LADO_MAX / Math.max(imagem.width, imagem.height));
  const largura = Math.round(imagem.width * escala);
  const altura = Math.round(imagem.height * escala);
  const tela = document.createElement("canvas");
  tela.width = largura; tela.height = altura;
  const ctx = tela.getContext("2d");
  if (!ctx) throw new Error("Não consegui preparar a foto.");
  ctx.drawImage(imagem, 0, 0, largura, altura);
  imagem.close();
  const png = arquivo.type === "image/png";
  const blob = await new Promise<Blob | null>((ok) => tela.toBlob(ok, png ? "image/png" : "image/jpeg", 0.86));
  if (!blob) throw new Error("Não consegui preparar a foto.");
  const base = arquivo.name.replace(/\.[^.]+$/, "") || "foto";
  return { blob, largura, altura, nome: base + (png ? ".png" : ".jpg") };
}

async function enviar(arquivo: File): Promise<Midia> {
  const { blob, largura, altura, nome } = await reduzir(arquivo);
  const form = new FormData();
  form.append("arquivo", new File([blob], nome, { type: blob.type }));
  form.append("largura", String(largura));
  form.append("altura", String(altura));
  const r = await fetch(URL_MIDIA, { method: "POST", body: form });
  const j = (await r.json().catch(() => ({}))) as { midia?: Midia; erro?: string };
  if (!r.ok || !j.midia) throw new Error(j.erro || "Não consegui enviar a foto.");
  return j.midia;
}

/* ---------- biblioteca ---------- */

function Ladrilho({ url, nome, escolhida, aoEscolher, aoApagar }: {
  url: string; nome: string; escolhida: boolean; aoEscolher: () => void; aoApagar?: () => void;
}) {
  return (
    <div className="relative">
      <button type="button" onClick={aoEscolher} title={nome} aria-pressed={escolhida}
        className={"relative block aspect-square w-full cursor-pointer overflow-hidden rounded-xl p-0 transition-transform hover:-translate-y-px " + fundoDaMiniatura(url)}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt={nome} loading="lazy" className={"h-full w-full " + (ehMarca(url) ? "object-contain p-2" : "object-cover")} />
        {escolhida ? (
          <>
            <span className="absolute inset-0 bg-accent/30" />
            <span className="absolute left-1.5 top-1.5 inline-flex h-[22px] w-[22px] items-center justify-center rounded-full bg-accent text-white">
              <Check size={13} />
            </span>
          </>
        ) : null}
      </button>
      {aoApagar ? (
        <button type="button" onClick={aoApagar} aria-label={"Apagar " + nome} title="Apagar"
          className="absolute right-1.5 top-1.5 inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-full bg-white/90 text-ink shadow-card transition-colors hover:bg-white hover:text-erro">
          <Trash2 size={14} />
        </button>
      ) : null}
    </div>
  );
}

export function BibliotecaFotos({ atual, aoEscolher, aoFechar }: {
  atual: string; aoEscolher: (url: string) => void; aoFechar: () => void;
}) {
  const confirmar = useConfirmar();
  const [midias, setMidias] = useState<Midia[] | null>(null);
  const [enviando, setEnviando] = useState(0);
  const [aviso, setAviso] = useState<string | null>(null);
  const entrada = useRef<HTMLInputElement>(null);

  const carregar = useCallback(async () => {
    try { setMidias((await api<{ midias: Midia[] }>(URL_MIDIA)).midias); }
    catch { setAviso("Não consegui carregar suas fotos, tente de novo."); setMidias([]); }
  }, []);

  useEffect(() => {
    let vivo = true;
    api<{ midias: Midia[] }>(URL_MIDIA)
      .then((r) => { if (vivo) setMidias(r.midias); })
      .catch(() => { if (vivo) { setAviso("Não consegui carregar suas fotos, tente de novo."); setMidias([]); } });
    return () => { vivo = false; };
  }, []);

  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => { if (e.key === "Escape") aoFechar(); };
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [aoFechar]);

  async function aoSelecionarArquivos(lista: FileList | null) {
    const arquivos = Array.from(lista ?? []);
    if (!arquivos.length) return;
    setAviso(null);
    setEnviando(arquivos.length);
    const enviadas: Midia[] = [];
    /* uma por vez: o celular do fotógrafo não precisa reduzir dez fotos de
       câmera ao mesmo tempo */
    for (const arquivo of arquivos) {
      try { enviadas.push(await enviar(arquivo)); }
      catch (e) { setAviso(`"${arquivo.name}": ${(e as Error).message}`); }
      setEnviando((n) => n - 1);
    }
    if (entrada.current) entrada.current.value = "";
    /* uma foto só é quase sempre "quero esta aqui": já escolhe e fecha */
    if (arquivos.length === 1 && enviadas.length === 1) { aoEscolher(enviadas[0].url); return; }
    await carregar();
  }

  async function apagar(m: Midia) {
    const ok = await confirmar({
      titulo: "Apagar esta foto?",
      texto: `"${m.nome}" sai da biblioteca e não dá pra recuperar. Foto que está em uso num modelo não é apagada.`,
      rotuloOk: "Apagar",
      perigo: true,
    });
    if (!ok) return;
    try { await api(URL_MIDIA, { acao: "apagar", id: m.id }); await carregar(); }
    catch (e) { setAviso((e as Error).message); }
  }

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-[rgba(29,29,27,.38)] md:items-center md:p-6"
      onPointerDown={(e) => { if (e.target === e.currentTarget) aoFechar(); }}>
      <div role="dialog" aria-modal="true" aria-label="Escolher foto"
        className="flex max-h-[86dvh] w-full max-w-[720px] flex-col rounded-t-[22px] bg-paper pb-[var(--sab)] shadow-alta md:rounded-[22px] md:pb-0">
        <div className="flex shrink-0 items-center gap-3 px-5 pb-3 pt-4">
          <h2 className="m-0 flex-1 text-[16px] font-semibold text-ink">Escolher foto</h2>
          <input ref={entrada} type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" multiple className="hidden"
            onChange={(e) => { void aoSelecionarArquivos(e.target.files); }} />
          <Botao className="h-10 px-3.5" disabled={enviando > 0} onClick={() => entrada.current?.click()}>
            <Upload size={16} /> Enviar fotos
          </Botao>
          <button type="button" onClick={aoFechar} aria-label="Fechar"
            className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-[10px] text-ink-soft transition-colors hover:bg-soft hover:text-ink">
            <X size={18} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5">
          {aviso ? <p className="m-0 mb-3 rounded-[10px] bg-erro-tint px-3.5 py-2.5 text-[13px] text-erro">{aviso}</p> : null}

          <h3 className="m-0 mb-2 text-[12.5px] font-semibold text-ink-soft">Suas fotos</h3>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {Array.from({ length: enviando }, (_, i) => (
              <div key={"env" + i} className="flex aspect-square items-center justify-center rounded-xl bg-[#EEF0F3] text-[11.5px] text-ink-soft">Enviando…</div>
            ))}
            {midias === null ? (
              <div className="col-span-full py-4 text-[13px] text-ink-soft">Carregando…</div>
            ) : midias.length === 0 && enviando === 0 ? (
              <button type="button" onClick={() => entrada.current?.click()}
                className="col-span-full flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-[#EEF0F3] py-6 text-[13px] font-semibold text-accent transition-colors hover:bg-accent-tint">
                <ImagePlus size={17} /> Envie a primeira foto
              </button>
            ) : (
              midias.map((m) => (
                <Ladrilho key={m.id} url={m.url} nome={m.nome} escolhida={atual === m.url}
                  aoEscolher={() => aoEscolher(m.url)} aoApagar={() => { void apagar(m); }} />
              ))
            )}
          </div>

          <h3 className="m-0 mb-2 mt-5 text-[12.5px] font-semibold text-ink-soft">Fotos que vieram com o site</h3>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {FOTOS_DO_SITE.map((f) => (
              <Ladrilho key={f.url} url={f.url} nome={f.nome} escolhida={atual === f.url} aoEscolher={() => aoEscolher(f.url)} />
            ))}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/* ---------- campo de foto ---------- */

function CampoDeFoto({ value, onChange, opcional, rotulo }: {
  value: string; onChange: (v: string) => void; opcional: boolean; rotulo: string;
}) {
  const [aberta, setAberta] = useState(false);
  const fechar = useCallback(() => setAberta(false), []);
  return (
    <div className="pb-1">
      <div className="mb-1.5 text-[12.5px] font-medium text-ink-soft">{rotulo}</div>
      {value ? (
        <>
          <button type="button" onClick={() => setAberta(true)}
            className={"block aspect-[16/10] w-full cursor-pointer overflow-hidden rounded-xl p-0 " + fundoDaMiniatura(value)}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={value} alt="" className={"h-full w-full " + (ehMarca(value) ? "object-contain p-3" : "object-cover")} />
          </button>
          <div className="mt-2 flex gap-2">
            <Botao variante="secundario" className="h-9 px-3 text-[13px]" onClick={() => setAberta(true)}>Trocar foto</Botao>
            {opcional ? <Botao variante="fantasma" className="h-9 px-3 text-[13px]" onClick={() => onChange("")}>Tirar</Botao> : null}
          </div>
        </>
      ) : (
        <button type="button" onClick={() => setAberta(true)}
          className="flex aspect-[16/10] w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-xl bg-[#EEF0F3] text-[13px] font-semibold text-accent transition-colors hover:bg-accent-tint">
          <ImagePlus size={20} /> Escolher foto
        </button>
      )}
      {aberta ? <BibliotecaFotos atual={value} aoEscolher={(url) => { onChange(url); setAberta(false); }} aoFechar={fechar} /> : null}
    </div>
  );
}

export const CampoFoto: CustomFieldRender<string> = ({ value, onChange, field }) => (
  <CampoDeFoto value={value ?? ""} onChange={onChange} opcional={false} rotulo={field.label ?? "Foto"} />
);

export const CampoFotoOpcional: CustomFieldRender<string> = ({ value, onChange, field }) => (
  <CampoDeFoto value={value ?? ""} onChange={onChange} opcional rotulo={field.label ?? "Foto"} />
);

/* ---------- foco ---------- */

/** Valor do caminho "fotos[0].src" dentro das props do bloco. */
function ler(objeto: unknown, caminho: string): unknown {
  return caminho.split(/[.[\]]/).filter(Boolean).reduce<unknown>(
    (atual, chave) => (atual && typeof atual === "object" ? (atual as Record<string, unknown>)[chave] : undefined),
    objeto,
  );
}

const VIZINHOS_DA_FOTO = ["src", "foto", "faixa"];

function lerFoco(valor: string): [number, number] {
  const m = /^\s*(\d+(?:\.\d+)?)%\s+(\d+(?:\.\d+)?)%\s*$/.exec(valor ?? "");
  return m ? [Number(m[1]), Number(m[2])] : [50, 50];
}

export const CampoFoco: CustomFieldRender<string> = ({ value, onChange, name, field }) => {
  const props = usePuck((s) => s.selectedItem?.props);
  const base = name.includes(".") ? name.slice(0, name.lastIndexOf(".") + 1) : "";
  const foto = VIZINHOS_DA_FOTO.map((k) => ler(props, base + k)).find((v) => typeof v === "string" && v) as string | undefined;
  const [x, y] = lerFoco(value);
  const arrastando = useRef(false);

  function marcar(e: EventoPonteiro<HTMLDivElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    const nx = Math.round(Math.min(100, Math.max(0, ((e.clientX - r.left) / r.width) * 100)));
    const ny = Math.round(Math.min(100, Math.max(0, ((e.clientY - r.top) / r.height) * 100)));
    onChange(`${nx}% ${ny}%`);
  }

  return (
    <div className="pb-1">
      <div className="mb-1.5 text-[12.5px] font-medium text-ink-soft">{field.label ?? "Foco da foto"}</div>
      {foto ? (
        <>
          <div className={"relative flex justify-center overflow-hidden rounded-xl " + fundoDaMiniatura(foto)}>
            <div className="relative touch-none select-none"
              onPointerDown={(e) => { arrastando.current = true; e.currentTarget.setPointerCapture(e.pointerId); marcar(e); }}
              onPointerMove={(e) => { if (arrastando.current) marcar(e); }}
              onPointerUp={() => { arrastando.current = false; }}
              onPointerCancel={() => { arrastando.current = false; }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={foto} alt="" draggable={false} className="block max-h-[240px] w-auto max-w-full cursor-crosshair" />
              <span className="pointer-events-none absolute h-[22px] w-[22px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/90 shadow-[0_0_0_6px_rgba(255,255,255,.35),0_2px_8px_rgba(0,0,0,.35)]"
                style={{ left: x + "%", top: y + "%" }} />
            </div>
          </div>
          <div className="mt-1.5 flex items-center justify-between gap-2">
            <span className="text-[12px] text-ink-soft">Toque no ponto que não pode ser cortado (o rosto, quase sempre).</span>
            {value ? (
              <button type="button" onClick={() => onChange("")}
                className="shrink-0 cursor-pointer rounded-lg px-2 py-1 text-[12px] font-semibold text-accent transition-colors hover:bg-soft">
                Centralizar
              </button>
            ) : null}
          </div>
        </>
      ) : (
        <p className="m-0 text-[12.5px] text-ink-soft">Escolha a foto primeiro.</p>
      )}
    </div>
  );
};

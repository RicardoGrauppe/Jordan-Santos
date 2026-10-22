/*
  Seção "Formulários" do Ateliê (22/10/2026, pedido do Ricardo: o Formulário
  deixou de ser uma página à parte e virou um tipo de modelo, como os sites).

  Um formulário está EM USO: é o que o casal preenche no link de cadastro.
  Os outros ficam guardados. O que existia antes virou o "Formulário padrão";
  "Novo formulário" parte dele de novo, do jeito que vem no app.

  Mesmo desenho dos cartões de site (raio 18, sombra de cartão, kebab branco
  no canto, menu com rótulo); no lugar da miniatura do site, a primeira foto
  da abertura do formulário, que é o que o casal vê primeiro.
*/
"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { CircleCheck, ClipboardList, Copy, EllipsisVertical, ExternalLink, Pencil, PenLine, Plus, Trash2 } from "lucide-react";
import { Selo } from "@/components/ui";
import { useConfirmar } from "@/components/ModalConfirmar";
import { Sk, SkCartaoModelo, SkCartaoNovo } from "@/components/Skeleton";
import { api, ERRO_SESSAO } from "@/lib/painel";
import { fmtData } from "@/lib/util";
import { urlFoto } from "@/lib/formulario";

type Resumo = {
  id: string; nome: string; atualizado_em: string; perguntas: number;
  capa: { id: string; origem: "padrao" | "enviada" } | null;
};
type Resposta = { modelos: Resumo[]; ativo: string };
type ItemMenu = { rotulo: string; icone: ReactNode; perigo?: boolean; disabled?: boolean; titulo?: string; acao: () => void };

const URL_API = "/api/formulario";
const rotaEditor = (id: string) => "/painel/atelie/formulario/" + id;

function Cartao({ modelo, emUso, aoAbrir, menu }: { modelo: Resumo; emUso: boolean; aoAbrir: () => void; menu: ItemMenu[] }) {
  const [aberto, setAberto] = useState(false);
  /* a capa chega depois do cartão: shimmer no lugar dela até a foto pintar */
  const [capaPronta, setCapaPronta] = useState(false);
  const raiz = useRef<HTMLDivElement>(null);
  /* fecha ao tocar fora, por contenção (mesmo motivo do cartão de site) */
  useEffect(() => {
    if (!aberto) return;
    const fechar = (e: PointerEvent) => { if (!raiz.current?.contains(e.target as Node)) setAberto(false); };
    document.addEventListener("pointerdown", fechar);
    return () => document.removeEventListener("pointerdown", fechar);
  }, [aberto]);

  return (
    <div ref={raiz} className="relative rounded-[18px] bg-paper shadow-card transition-[transform,box-shadow] duration-150 [@media(hover:hover)]:hover:-translate-y-px [@media(hover:hover)]:hover:shadow-card-hover">
      <button type="button" onClick={aoAbrir} className="block w-full cursor-pointer overflow-hidden rounded-[18px] bg-transparent p-0 text-left">
        <span className="relative block aspect-[16/10] w-full overflow-hidden rounded-t-[18px] bg-accent-tint">
          {modelo.capa ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={urlFoto(modelo.capa, 750)} alt="" onLoad={() => setCapaPronta(true)} onError={() => setCapaPronta(true)}
              className={"h-full w-full object-cover transition-opacity duration-300 " + (capaPronta ? "opacity-100" : "opacity-0")} />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-accent"><ClipboardList size={30} strokeWidth={1.5} /></span>
          )}
          {modelo.capa && !capaPronta ? <Sk className="absolute inset-0 rounded-none" /> : null}
        </span>
        <span className="block px-4 pb-4 pt-3.5">
          <span className="block truncate text-[14.5px] font-semibold leading-[1.3] text-ink">{modelo.nome}</span>
          <span className="mt-1 block text-[12px] text-ink-soft">
            {(modelo.perguntas ? modelo.perguntas + (modelo.perguntas === 1 ? " pergunta sua · " : " perguntas suas · ") : "")}
            Editado em {fmtData(modelo.atualizado_em)}
          </span>
        </span>
      </button>

      {emUso ? (
        <div className="pointer-events-none absolute left-3 top-3"><Selo tom="ok">Em uso</Selo></div>
      ) : null}

      <button type="button" aria-label="Opções do formulário" aria-haspopup="true" aria-expanded={aberto}
        onClick={() => setAberto((v) => !v)}
        className={"absolute right-2.5 top-2.5 z-[2] inline-flex h-[30px] w-[30px] cursor-pointer items-center justify-center rounded-full " +
          "bg-white/90 text-ink shadow-[0_1px_2px_rgba(29,29,27,.08),0_4px_10px_rgba(29,29,27,.1)] transition-colors hover:bg-white " +
          (aberto ? "bg-white" : "")}>
        <EllipsisVertical size={16} />
      </button>

      {aberto ? (
        <div className="absolute right-2.5 top-11 z-[5] min-w-[210px] rounded-xl bg-paper p-1.5 shadow-alta">
          {menu.map((m) => (
            <button key={m.rotulo} type="button" disabled={m.disabled} title={m.titulo}
              onClick={() => { setAberto(false); m.acao(); }}
              className={"flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-[11px] py-[9px] text-left text-[13.5px] disabled:cursor-not-allowed disabled:opacity-40 " +
                (m.perigo ? "text-erro enabled:hover:bg-erro-tint" : "text-ink enabled:hover:bg-soft")}>
              <span className="opacity-85">{m.icone}</span>{m.rotulo}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function FormulariosAtelie({ mostrar }: { mostrar: (texto: string, opts?: { ok?: boolean }) => void }) {
  const router = useRouter();
  const confirmar = useConfirmar();
  const [dados, setDados] = useState<Resposta | null>(null);
  const [criando, setCriando] = useState(false);

  const falhou = useCallback((e: unknown, texto: string) => {
    const msg = (e as Error).message;
    if (msg === ERRO_SESSAO) { router.replace("/entrar"); return; }
    mostrar(msg && msg !== "falha" ? msg : texto);
  }, [router, mostrar]);

  const carregar = useCallback(async () => {
    try { setDados(await api<Resposta>(URL_API)); }
    catch (e) { falhou(e, "Não consegui carregar os formulários, tente de novo."); }
  }, [falhou]);

  useEffect(() => {
    let vivo = true;
    api<Resposta>(URL_API)
      .then((r) => { if (vivo) setDados(r); })
      .catch((e) => { if (vivo) falhou(e, "Não consegui carregar os formulários, tente de novo."); });
    return () => { vivo = false; };
  }, [falhou]);

  async function usar(m: Resumo) {
    const ok = await confirmar({
      titulo: "Usar este formulário?",
      texto: `"${m.nome}" passa a ser o que o casal preenche no link de cadastro. O que está em uso hoje continua guardado aqui.`,
      aviso: "Isto não é um teste. Quem abrir o link de cadastro depois disso já vê este formulário.",
      rotuloOk: "Usar este",
    });
    if (!ok) return;
    try { await api(URL_API, { acao: "usar", id: m.id }); await carregar(); mostrar("Em uso ✓", { ok: true }); }
    catch (e) { falhou(e, "Não consegui trocar o formulário, tente de novo."); }
  }

  async function duplicar(m: Resumo) {
    try { await api(URL_API, { acao: "duplicar", id: m.id }); await carregar(); mostrar("Cópia criada ✓", { ok: true }); }
    catch (e) { falhou(e, "Não consegui duplicar, tente de novo."); }
  }

  async function renomear(m: Resumo) {
    const nome = window.prompt("Nome do formulário:", m.nome);
    if (!nome?.trim() || nome.trim() === m.nome) return;
    try { await api(URL_API, { acao: "renomear", id: m.id, nome: nome.trim() }); await carregar(); }
    catch (e) { falhou(e, "Não consegui renomear, tente de novo."); }
  }

  async function apagar(m: Resumo) {
    const ok = await confirmar({
      titulo: `Apagar o formulário "${m.nome}"?`,
      texto: "Ele sai da lista e não dá pra recuperar. O formulário em uso não muda, e quem já respondeu continua com as respostas na ficha.",
      rotuloOk: "Apagar",
      perigo: true,
    });
    if (!ok) return;
    try { await api(URL_API, { acao: "apagar", id: m.id }); await carregar(); mostrar("Formulário apagado"); }
    catch (e) { falhou(e, "Não consegui apagar, tente de novo."); }
  }

  async function novo() {
    setCriando(true);
    try {
      const { id } = await api<{ id: string }>(URL_API, { acao: "criar", nome: "Formulário sem título" });
      router.push(rotaEditor(id));
    } catch (e) { falhou(e, "Não consegui criar o formulário, tente de novo."); setCriando(false); }
  }

  function menuDe(m: Resumo, emUso: boolean): ItemMenu[] {
    return [
      emUso
        ? { rotulo: "Ver formulário", icone: <ExternalLink size={15} />, acao: () => window.open("/cadastro", "_blank", "noopener") }
        : { rotulo: "Usar este", icone: <CircleCheck size={15} />, acao: () => usar(m) },
      { rotulo: "Editar", icone: <PenLine size={15} />, acao: () => router.push(rotaEditor(m.id)) },
      { rotulo: "Duplicar", icone: <Copy size={15} />, acao: () => duplicar(m) },
      { rotulo: "Renomear", icone: <Pencil size={15} />, acao: () => renomear(m) },
      {
        rotulo: "Apagar", icone: <Trash2 size={15} />, perigo: true,
        disabled: emUso, titulo: emUso ? "Escolha outro pra usar antes de apagar este" : undefined,
        acao: () => apagar(m),
      },
    ];
  }

  /* o em uso vem primeiro */
  const lista = dados ? [...dados.modelos].sort((a, b) => Number(b.id === dados.ativo) - Number(a.id === dados.ativo)) : [];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-[repeat(auto-fill,minmax(260px,1fr))]">
      {dados ? (
        <>
          {lista.map((m) => (
            <Cartao key={m.id} modelo={m} emUso={m.id === dados.ativo} aoAbrir={() => router.push(rotaEditor(m.id))} menu={menuDe(m, m.id === dados.ativo)} />
          ))}
          <button type="button" onClick={novo} disabled={criando}
            className="flex min-h-[120px] cursor-pointer flex-col items-center justify-center gap-2.5 rounded-[18px] bg-[#EEF0F3] text-[13.5px] font-semibold text-accent transition-colors hover:bg-accent-tint disabled:cursor-default disabled:opacity-60 sm:min-h-[200px]">
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-[14px] bg-paper shadow-card"><Plus size={20} /></span>
            Novo formulário
          </button>
        </>
      ) : (
        <>
          <SkCartaoModelo />
          <SkCartaoNovo />
        </>
      )}
    </div>
  );
}

/*
  Ateliê: a galeria dos modelos de site do fotógrafo (brandbook, seção 19).

  Um modelo fica no ar, e é ele que abre pra quem recebe o link do estúdio (a
  raiz do site). Os outros ficam guardados pra trocar quando quiser: "Pôr no
  ar" publica o modelo do jeito que ele está e troca o site na hora, por isso
  pede confirmação.

  Cada cartão mostra a PRÓPRIA página encolhida (a prévia do rascunho num
  iframe de 1440px reduzido), porque é a cara do site que identifica o
  modelo. Abrir o cartão leva pro editor; "Novo modelo" cria e já abre.
*/
"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Copy, EllipsisVertical, ExternalLink, Eye, Globe, Pencil, PenLine, Plus, Trash2 } from "lucide-react";
import { Botao, CartaoAviso, Selo } from "@/components/ui";
import { useConfirmar } from "@/components/ModalConfirmar";
import { useToast } from "@/components/Toast";
import { Sk, SkLinha } from "@/components/Skeleton";
import { TituloMobile } from "@/components/cabecalho-mobile";
import { api, esperaMin, ERRO_SESSAO } from "@/lib/painel";
import { fmtData } from "@/lib/util";

type Modelo = {
  id: string;
  nome: string;
  atualizado_em: string;
  publicado_em: string | null;
  blocos: number;
  pendente: boolean;
};
type Resposta = { modelos: Modelo[]; ativo: string | null };

const URL_API = "/api/atelie";
const NOME_NOVO = "Modelo sem título";

/* Largura em que a miniatura desenha o site antes de encolher: a de um
   computador, que é onde a página foi composta. */
const LARGURA_SITE = 1440;

const rotaPrevia = (id: string) => "/atelie/previa/" + id;
const rotaEditor = (id: string) => "/painel/atelie/" + id;

/* ---------- miniatura ---------- */

/* A página de verdade, num iframe do tamanho de uma tela de computador,
   encolhida até a largura do cartão. Sem clique nem foco lá dentro: quem
   recebe o toque é o cartão. */
function Miniatura({ id, versao }: { id: string; versao: string }) {
  const caixa = useRef<HTMLDivElement>(null);
  const [escala, setEscala] = useState(0);

  useEffect(() => {
    const el = caixa.current;
    if (!el) return;
    const medir = () => setEscala(el.clientWidth / LARGURA_SITE);
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={caixa} className="relative aspect-[16/10] overflow-hidden bg-noir">
      {escala > 0 ? (
        <iframe
          key={versao}
          src={rotaPrevia(id)}
          title=""
          aria-hidden="true"
          tabIndex={-1}
          loading="lazy"
          className="pointer-events-none absolute left-0 top-0 origin-top-left border-0"
          style={{ width: LARGURA_SITE, height: LARGURA_SITE / 1.6, transform: `scale(${escala})` }}
        />
      ) : null}
    </div>
  );
}

/* ---------- cartão ---------- */

type ItemMenu = { rotulo: string; icone: ReactNode; perigo?: boolean; disabled?: boolean; titulo?: string; acao: () => void };

/* Botão que ocupa o cartão inteiro + kebab por cima, como irmãos (botão
   dentro de botão é HTML inválido). Mesmo desenho do índice de contratos. */
function CartaoModelo({ modelo, noAr, aoAbrir, menu }: {
  modelo: Modelo; noAr: boolean; aoAbrir: () => void; menu: ItemMenu[];
}) {
  const [aberto, setAberto] = useState(false);
  const raiz = useRef<HTMLDivElement>(null);
  /* Fecha ao tocar FORA do cartão. O teste é por contenção, e não por
     stopPropagation no menu: o Next monta o React no próprio `document`, então
     o ouvinte daqui e o do React estão no mesmo nó e parar a propagação não
     segura este. Sem o teste, o menu fechava no pointerdown, sumia antes do
     clique terminar e a opção escolhida nunca rodava. */
  useEffect(() => {
    if (!aberto) return;
    const fechar = (e: PointerEvent) => {
      if (!raiz.current?.contains(e.target as Node)) setAberto(false);
    };
    document.addEventListener("pointerdown", fechar);
    return () => document.removeEventListener("pointerdown", fechar);
  }, [aberto]);

  return (
    <div ref={raiz} className="relative rounded-[18px] bg-paper shadow-card transition-[transform,box-shadow] duration-150 hover:-translate-y-px hover:shadow-card-hover">
      <button type="button" onClick={aoAbrir} className="block w-full cursor-pointer overflow-hidden rounded-[18px] bg-transparent p-0 text-left">
        <Miniatura id={modelo.id} versao={modelo.atualizado_em} />
        <span className="block px-4 pb-4 pt-3.5">
          <span className="block truncate text-[14.5px] font-semibold leading-[1.3] text-ink">{modelo.nome}</span>
          <span className="mt-1 block text-[12px] text-ink-soft">
            {modelo.blocos ? "Editado em " + fmtData(modelo.atualizado_em) : "Ainda sem blocos"}
          </span>
        </span>
      </button>

      {noAr ? (
        <div className="pointer-events-none absolute left-3 top-3 flex flex-wrap gap-1.5">
          <Selo tom="ok">No ar</Selo>
          {modelo.pendente ? <Selo tom="atencao">Mudanças fora do ar</Selo> : null}
        </div>
      ) : null}

      <button
        type="button" aria-label="Opções do modelo" aria-haspopup="true" aria-expanded={aberto}
        onClick={() => setAberto((v) => !v)}
        className={
          "absolute right-2.5 top-2.5 z-[2] inline-flex h-[30px] w-[30px] cursor-pointer items-center justify-center rounded-full " +
          "bg-white/90 text-ink shadow-[0_1px_2px_rgba(29,29,27,.08),0_4px_10px_rgba(29,29,27,.1)] transition-colors hover:bg-white " +
          (aberto ? "bg-white" : "")
        }
      >
        <EllipsisVertical size={16} />
      </button>

      {aberto ? (
        <div className="absolute right-2.5 top-11 z-[5] min-w-[210px] rounded-xl bg-paper p-1.5 shadow-alta">
          {menu.map((m) => (
            <button key={m.rotulo} type="button" disabled={m.disabled} title={m.titulo}
              onClick={() => { setAberto(false); m.acao(); }}
              className={
                "flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-[11px] py-[9px] text-left text-[13.5px] disabled:cursor-not-allowed disabled:opacity-40 " +
                (m.perigo ? "text-erro enabled:hover:bg-erro-tint" : "text-ink enabled:hover:bg-soft")
              }>
              <span className="opacity-85">{m.icone}</span>{m.rotulo}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/* Fundo um degrau abaixo do --soft da página (o #EEF0F3 do campo em foco):
   em --soft ele sumiria no fundo do painel, e borda não é opção. */
function CartaoNovo({ aoClicar, ocupado }: { aoClicar: () => void; ocupado: boolean }) {
  return (
    <button type="button" onClick={aoClicar} disabled={ocupado}
      className={
        "flex min-h-[120px] cursor-pointer flex-col items-center justify-center gap-2.5 rounded-[18px] bg-[#EEF0F3] sm:min-h-[200px] " +
        "text-[13.5px] font-semibold text-accent transition-colors hover:bg-accent-tint disabled:cursor-default disabled:opacity-60"
      }>
      <span className="inline-flex h-11 w-11 items-center justify-center rounded-[14px] bg-paper shadow-card">
        <Plus size={20} />
      </span>
      Novo modelo
    </button>
  );
}

function CartaoCarregando() {
  return (
    <div className="overflow-hidden rounded-[18px] bg-paper shadow-card">
      <Sk className="aspect-[16/10] w-full rounded-none" />
      <div className="px-4 pb-4 pt-3.5">
        <SkLinha style={{ width: "60%" }} />
        <SkLinha className="mt-2" style={{ width: "40%" }} />
      </div>
    </div>
  );
}

/* ---------- página ---------- */

export default function Atelie() {
  const router = useRouter();
  const confirmar = useConfirmar();
  const { mostrar, elemento: toast } = useToast();
  const [dados, setDados] = useState<Resposta | null>(null);
  const [criando, setCriando] = useState(false);

  const falhou = useCallback((e: unknown, texto: string) => {
    const msg = (e as Error).message;
    if (msg === ERRO_SESSAO) { router.replace("/entrar"); return; }
    mostrar(msg && msg !== "falha" ? msg : texto);
  }, [router, mostrar]);

  const carregar = useCallback(async () => {
    try { setDados(await api<Resposta>(URL_API)); }
    catch (e) { falhou(e, "Não consegui carregar seus modelos, tente de novo."); }
  }, [falhou]);

  /* o estado é escrito no callback, nunca no corpo do efeito; a espera mínima
     segura o skeleton um instante pra troca não piscar */
  useEffect(() => {
    let vivo = true;
    Promise.all([api<Resposta>(URL_API), esperaMin(350)])
      .then(([r]) => { if (vivo) setDados(r); })
      .catch((e) => { if (vivo) falhou(e, "Não consegui carregar seus modelos, tente de novo."); });
    return () => { vivo = false; };
  }, [falhou]);

  const abrirSite = () => window.open("/", "_blank", "noopener");
  const verComoFica = (m: Modelo) => window.open(rotaPrevia(m.id), "_blank", "noopener");

  async function porNoAr(m: Modelo, jaNoAr: boolean) {
    const ok = await confirmar(jaNoAr
      ? {
        titulo: "Publicar as mudanças?",
        texto: `O site passa a mostrar "${m.nome}" do jeito que ele está agora, com as mudanças que você fez desde a última vez.`,
        aviso: "Quem abrir o site depois disso já vê a versão nova.",
        rotuloOk: "Publicar",
      }
      : {
        titulo: "Pôr este modelo no ar?",
        texto: `O site passa a mostrar "${m.nome}" do jeito que ele está agora, pra todo mundo que abrir o link do estúdio. O modelo que está no ar hoje sai do ar, mas continua guardado aqui.`,
        aviso: "Isto não é um teste. Quem abrir o site depois disso já vê este modelo.",
        rotuloOk: "Pôr no ar",
      });
    if (!ok) return;
    try {
      await api(URL_API, { acao: "por-no-ar", id: m.id });
      await carregar();
      mostrar(jaNoAr ? "Mudanças publicadas ✓" : "No ar ✓", { ok: true });
    } catch (e) { falhou(e, "Não consegui pôr no ar, tente de novo."); }
  }

  async function duplicar(m: Modelo) {
    try {
      await api(URL_API, { acao: "duplicar", id: m.id });
      await carregar();
      mostrar("Cópia criada ✓", { ok: true });
    } catch (e) { falhou(e, "Não consegui duplicar, tente de novo."); }
  }

  async function renomear(m: Modelo) {
    const nome = window.prompt("Nome do modelo:", m.nome);
    if (!nome?.trim() || nome.trim() === m.nome) return;
    try { await api(URL_API, { acao: "renomear", id: m.id, nome: nome.trim() }); await carregar(); }
    catch (e) { falhou(e, "Não consegui renomear, tente de novo."); }
  }

  async function apagar(m: Modelo) {
    const ok = await confirmar({
      titulo: `Apagar o modelo "${m.nome}"?`,
      texto: "Ele sai da lista e não dá pra recuperar. O site no ar não muda.",
      rotuloOk: "Apagar",
      perigo: true,
    });
    if (!ok) return;
    try { await api(URL_API, { acao: "apagar", id: m.id }); await carregar(); mostrar("Modelo apagado"); }
    catch (e) { falhou(e, "Não consegui apagar, tente de novo."); }
  }

  async function novo() {
    setCriando(true);
    try {
      const { id } = await api<{ id: string }>(URL_API, { acao: "criar", nome: NOME_NOVO });
      router.push(rotaEditor(id));
    } catch (e) { falhou(e, "Não consegui criar o modelo, tente de novo."); setCriando(false); }
  }

  function menuDe(m: Modelo, noAr: boolean): ItemMenu[] {
    const semBlocos = m.blocos === 0;
    const nadaAPublicar = noAr && !m.pendente;
    return [
      {
        rotulo: noAr ? "Publicar mudanças" : "Pôr no ar",
        icone: <Globe size={15} />,
        disabled: semBlocos || nadaAPublicar,
        titulo: semBlocos ? "Coloque pelo menos um bloco antes" : nadaAPublicar ? "O site já está igual a este modelo" : undefined,
        acao: () => porNoAr(m, noAr),
      },
      { rotulo: "Editar", icone: <PenLine size={15} />, acao: () => router.push(rotaEditor(m.id)) },
      { rotulo: "Ver como fica", icone: <Eye size={15} />, acao: () => verComoFica(m) },
      { rotulo: "Duplicar", icone: <Copy size={15} />, acao: () => duplicar(m) },
      { rotulo: "Renomear", icone: <Pencil size={15} />, acao: () => renomear(m) },
      {
        rotulo: "Apagar", icone: <Trash2 size={15} />, perigo: true,
        disabled: noAr, titulo: noAr ? "Ponha outro modelo no ar antes de apagar este" : undefined,
        acao: () => apagar(m),
      },
    ];
  }

  /* o que está no ar vem primeiro; o resto, do mais recente pro mais antigo */
  const modelos = dados
    ? [...dados.modelos].sort((a, b) => Number(b.id === dados.ativo) - Number(a.id === dados.ativo))
    : [];

  return (
    <div className="mx-auto max-w-[1040px]">
      <TituloMobile titulo="Ateliê" acao={{ rotulo: "Abrir o site", Icone: ExternalLink, aoAcionar: abrirSite }} />
      {/* no celular o título vive no cabeçalho (ver cabecalho-mobile.tsx) */}
      <div className="mb-2 hidden items-center justify-between gap-4 md:flex">
        <h1 className="m-0 text-[26px] font-bold text-ink">Ateliê</h1>
        <Botao variante="secundario" onClick={abrirSite}>
          <ExternalLink size={16} /> Abrir o site
        </Botao>
      </div>
      <div className="mb-5">
        <CartaoAviso tom="info">
          O modelo no ar é o seu site: é o que abre pra quem recebe o link do estúdio. Mexer num modelo não muda o site até você pôr ele no ar.
        </CartaoAviso>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-[repeat(auto-fill,minmax(260px,1fr))]">
        {dados ? (
          <>
            {modelos.map((m) => {
              const noAr = m.id === dados.ativo;
              return (
                <CartaoModelo key={m.id} modelo={m} noAr={noAr} aoAbrir={() => router.push(rotaEditor(m.id))} menu={menuDe(m, noAr)} />
              );
            })}
            <CartaoNovo aoClicar={novo} ocupado={criando} />
          </>
        ) : (
          <>
            <CartaoCarregando />
            <CartaoCarregando />
          </>
        )}
      </div>

      {toast}
    </div>
  );
}

/*
  Editor do texto do contrato, no formato do Google Docs: barra só de ícones,
  documento em largura cheia, salvamento automático feito por quem usa (via
  `aoMudar`), sem botão de salvar.

  Portado de configuracoes.html + configuracoes-editor.js. Decisões herdadas:
  - O dropdown de estilo faz SET, não toggle: "Texto normal" precisa sempre
    virar parágrafo, e pedir Título estando em Título não pode desfazer.
  - A lista também é escolhida, não alternada, pelo mesmo motivo; clicar no
    tipo já ativo desliga, que substitui o item "sem lista".
  - Estado da barra lê `selectionUpdate`/`transaction` do Tiptap, não `click`
    do DOM: o clique dispara ANTES do ProseMirror mover a seleção e a barra
    mostrava o bloco anterior.
  - No celular a barra quebra em duas linhas (estilo e inserir em cima, ícones
    embaixo) em vez de espremer os alvos abaixo de 32px.
*/
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import type { JSONContent } from "@tiptap/core";
import type { ReactNode } from "react";
import {
  AlignCenter, AlignJustify, AlignLeft, AlignRight, Bold, ChevronDown, Italic, List, ListOrdered, PanelLeft, PenTool, Plus, Table, X,
} from "lucide-react";
import { Roboto } from "next/font/google";
import { BlocoAssinaturas, EXTENSOES, ROTULOS_CAMPO, TabelaItens, jsonParaHtml } from "@/lib/contrato-editor";
import { BlocoAssinaturasFolha, Paginacao, TabelaItensFolha, definirDadosFolha, type DadosFolha } from "@/lib/contrato-folha";

/* A fonte do PDF (pdfmake usa Roboto Regular e Medium). A folha usa a mesma
   pra as linhas quebrarem no mesmo lugar que no contrato gerado. */
const roboto = Roboto({ subsets: ["latin"], weight: ["400", "500"], style: ["normal", "italic"], variable: "--font-roboto", display: "swap" });

/* Os nós próprios ganham desenho de verdade (tabela, assinaturas) e a
   paginação vem por cima. Só aqui: o servidor importa contrato-editor puro. */
const EXTENSOES_FOLHA = [
  ...EXTENSOES.map((e) => (e === TabelaItens ? TabelaItensFolha : e === BlocoAssinaturas ? BlocoAssinaturasFolha : e)),
  Paginacao,
];

type Estilo = "p" | "h2" | "h3";
type Alinhamento = "left" | "center" | "right" | "justify";

export type EditorContratoProps = {
  conteudoInicial: JSONContent | null;
  /** chamado a cada mudança com o JSON e o HTML já serializado */
  aoMudar: (json: JSONContent, html: string) => void;
  /** Faixa que entra ACIMA da barra de formatação, dentro do mesmo cabeçalho
   *  grudado: é onde a página põe o voltar, o nome do arquivo e o estado do
   *  salvamento. Fica aqui, e não na página, pra os dois serem um bloco só —
   *  se a página desenhasse a sua faixa por fora, seriam dois cabeçalhos
   *  empilhados de novo. */
  topo?: ReactNode;
  /** Painel lateral à esquerda do documento, só de quem pede (hoje, o editor
   *  do contrato DE UM CLIENTE; o editor de modelos não tem). Recebe o editor
   *  pra poder inserir no cursor, e `fechar` pra gaveta do celular sumir
   *  depois de uma ação. */
  lateral?: (editor: Editor, fechar: () => void) => ReactNode;
  /** dados do casal pra tabela de itens e assinaturas desenhadas na folha
   *  (o editor de modelos não tem casal: elas aparecem com texto de exemplo) */
  dados?: DadosFolha;
  /** celular: barra fixa embaixo (ação principal + abrir o painel). Com ela,
   *  a barra de formatação vira uma linha só e o "Inserir" sai (o painel tem) */
  rodapeMobile?: (abrirPainel: () => void) => ReactNode;
};

export function EditorContrato({ conteudoInicial, aoMudar, topo, lateral, dados = null, rodapeMobile }: EditorContratoProps) {
  /* a loja das NodeViews acompanha o que a lateral mexe (pacote, total) */
  useEffect(() => { definirDadosFolha(dados); }, [dados]);
  useEffect(() => () => definirDadosFolha(null), []);

  const editor = useEditor({
    extensions: EXTENSOES_FOLHA,
    content: conteudoInicial ?? "<p></p>",
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      const json = editor.getJSON();
      aoMudar(json, jsonParaHtml(json));
    },
  });

  /* estado da barra: só o necessário pra acender o que está ativo no cursor */
  const [, forcar] = useState(0);
  useEffect(() => {
    if (!editor) return;
    const rerender = () => forcar((n) => n + 1);
    editor.on("selectionUpdate", rerender);
    editor.on("transaction", rerender);
    return () => { editor.off("selectionUpdate", rerender); editor.off("transaction", rerender); };
  }, [editor]);

  const [menuAberto, setMenuAberto] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!menuAberto) return;
    const fechar = (e: MouseEvent) => { if (!menuRef.current?.contains(e.target as Node)) setMenuAberto(false); };
    document.addEventListener("pointerdown", fechar);
    return () => document.removeEventListener("pointerdown", fechar);
  }, [menuAberto]);

  /* a lateral gruda logo abaixo do cabeçalho, que muda de altura (faixa do
     link do casal, barra em duas linhas no celular): mede em vez de chutar */
  const cabecalhoRef = useRef<HTMLDivElement>(null);
  const temLateral = !!lateral;
  const [alturaCabecalho, setAlturaCabecalho] = useState(0);
  useEffect(() => {
    const el = cabecalhoRef.current;
    if (!el || !temLateral) return;
    const medir = () => setAlturaCabecalho(el.offsetHeight);
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, [temLateral, editor]);

  /* folha A4 reduzida pra caber (celular), como um leitor de PDF: mede a
     área e grava o fator em --zoom-folha (globals.css). Nunca aumenta. */
  const areaFolha = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = areaFolha.current;
    if (!el) return;
    const medir = () => {
      const cs = getComputedStyle(el);
      const livre = el.clientWidth - (parseFloat(cs.paddingLeft) || 0) - (parseFloat(cs.paddingRight) || 0);
      const k = Math.min(1, livre / 793.71);
      const folha = el.querySelector<HTMLElement>(".ProseMirror");
      el.style.setProperty("--zoom-folha", String(k));
      el.style.setProperty("--altura-folha", (folha?.offsetHeight ?? 0) + "px");
      el.classList.toggle("folha-reduzida", k < 0.999);
    };
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    /* a folha cresce com o texto e com as quebras: a altura recolhida acompanha */
    const folha = el.querySelector(".ProseMirror");
    if (folha) ro.observe(folha);
    return () => ro.disconnect();
  }, [editor]);

  /* barra de formatação que rola de lado no celular: degradê nas pontas
     enquanto houver mais pra ver, e um "puxa e solta" suave nas três
     primeiras aberturas, pra ensinar que ela rola */
  const barraRef = useRef<HTMLDivElement>(null);
  const [barraRola, setBarraRola] = useState({ esq: false, dir: false });
  const medirBarra = useCallback(() => {
    const b = barraRef.current;
    if (!b) return;
    const esq = b.scrollLeft > 2;
    const dir = b.scrollLeft + b.clientWidth < b.scrollWidth - 2;
    setBarraRola((v) => (v.esq === esq && v.dir === dir ? v : { esq, dir }));
  }, []);
  useEffect(() => {
    const b = barraRef.current;
    if (!b || !rodapeMobile) return;
    const ro = new ResizeObserver(medirBarra);
    ro.observe(b);
    let volta: ReturnType<typeof setTimeout> | undefined;
    const vai = setTimeout(() => {
      if (b.scrollWidth <= b.clientWidth + 2 || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      let vezes = 0;
      try { vezes = Number(localStorage.getItem("editor:dica-barra")) || 0; } catch { /* sem storage */ }
      if (vezes >= 3) return;
      try { localStorage.setItem("editor:dica-barra", String(vezes + 1)); } catch { /* sem storage */ }
      b.scrollTo({ left: 64, behavior: "smooth" });
      volta = setTimeout(() => b.scrollTo({ left: 0, behavior: "smooth" }), 700);
    }, 800);
    return () => { ro.disconnect(); clearTimeout(vai); clearTimeout(volta); };
  }, [editor, rodapeMobile, medirBarra]);

  /* celular: a lateral vira um sheet de baixo pra cima (60% da tela), aberto
     pelo botão Painel; arrastar a alça pra baixo fecha */
  const [gavetaAberta, setGavetaAberta] = useState(false);
  const [arrasto, setArrasto] = useState<number | null>(null);
  const inicioArrasto = useRef(0);
  useEffect(() => {
    if (!gavetaAberta) return;
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setGavetaAberta(false); };
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [gavetaAberta]);
  const fecharGaveta = () => setGavetaAberta(false);

  if (!editor) return null;

  const estiloAtual: Estilo = editor.isActive("heading", { level: 2 }) ? "h2" : editor.isActive("heading", { level: 3 }) ? "h3" : "p";
  const alinhamentoAtual: Alinhamento =
    (["left", "center", "right", "justify"] as const).find((a) => editor.isActive({ textAlign: a })) ?? "justify";

  function definirEstilo(e: Estilo) {
    if (e === "p") editor!.chain().focus().setParagraph().run();
    else editor!.chain().focus().setNode("heading", { level: Number(e.slice(1)) as 2 | 3 }).run();
  }
  function definirLista(tipo: "pontos" | "numerada") {
    const c = editor!.chain().focus();
    if (tipo === "pontos") c.toggleBulletList().run(); else c.toggleOrderedList().run();
  }

  const icone = (ativo: boolean) =>
    "inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg transition-colors " +
    (ativo ? "bg-accent-tint text-accent" : `text-ink-soft hover:bg-soft hover:text-ink`);

  const divisor = <span className="mx-1.5 h-5 w-px shrink-0 self-center bg-line" aria-hidden />;

  return (
    <div className={"editor-contrato flex min-h-dvh flex-col bg-paper " + roboto.variable}>
      {/* UM cabeçalho só: o nome do arquivo e a barra de formatação são faixas
          do mesmo bloco, mesmo fundo e sem linha entre elas — foi o que o
          original fez ao abrir o editor (`.editor-aberto .topo-estudio
          {border-bottom:0}`), porque um fio no meio partia o cabeçalho ao
          meio. A única separação é embaixo, entre o cabeçalho inteiro e o
          documento. Grudado no topo: só o documento rola. */}
      <div ref={cabecalhoRef} className="sticky top-0 z-10 shrink-0 bg-paper px-5 pt-[var(--sat)] shadow-card md:px-7">
        {topo}
        {/* barra: no celular vira duas linhas por `order`; a ordem do DOM serve
            ao desktop, onde tudo cabe numa só */}
        <div className={rodapeMobile ? "relative -mx-5 md:mx-0" : ""}>
        {/* celular: a barra rola de lado; o degradê na ponta avisa que tem mais */}
        {rodapeMobile ? (
          <>
            <span aria-hidden className={"pointer-events-none absolute inset-y-0 left-0 z-[1] w-8 bg-gradient-to-r from-paper to-transparent transition-opacity duration-200 md:hidden " + (barraRola.esq ? "opacity-100" : "opacity-0")} />
            <span aria-hidden className={"pointer-events-none absolute inset-y-0 right-0 z-[1] w-12 bg-gradient-to-l from-paper to-transparent transition-opacity duration-200 md:hidden " + (barraRola.dir ? "opacity-100" : "opacity-0")} />
          </>
        ) : null}
        <div ref={barraRef} onScroll={medirBarra} className={rodapeMobile
          /* uma linha só, rolando de lado se não couber; sem `order` */
          ? "flex items-center gap-1.5 overflow-x-auto px-5 py-1.5 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:justify-center md:overflow-visible md:px-0 [&>*]:shrink-0 [&>*]:basis-auto [&_*]:order-none"
          : "flex flex-wrap items-center gap-1.5 py-1.5 pb-2 md:flex-nowrap md:justify-center"}>
        <select
          aria-label="Estilo do texto"
          value={estiloAtual}
          onChange={(e) => definirEstilo(e.target.value as Estilo)}
          className={`order-1 h-8 min-w-[132px] shrink-0 cursor-pointer appearance-none rounded-lg bg-transparent pl-2 pr-6 text-[13px] text-ink hover:bg-soft focus:bg-soft md:order-none md:min-w-[140px]`}
          style={{ backgroundImage: "url(\"data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%236B7280' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")", backgroundRepeat: "no-repeat", backgroundPosition: "right 6px center" }}
        >
          <option value="p">Texto normal</option>
          <option value="h2">Título</option>
          <option value="h3">Subtítulo</option>
        </select>

        <span className="hidden md:contents">{divisor}</span>

        {/* ícones: grupo inteiro desce pra segunda linha no celular */}
        <div className="order-3 flex basis-full items-center gap-1.5 md:order-none md:basis-auto">
          <button type="button" aria-label="Negrito" title="Negrito" className={icone(editor.isActive("bold"))} onClick={() => editor.chain().focus().toggleBold().run()}><Bold size={17} /></button>
          <button type="button" aria-label="Itálico" title="Itálico" className={icone(editor.isActive("italic"))} onClick={() => editor.chain().focus().toggleItalic().run()}><Italic size={17} /></button>
          <span className="mx-0 h-5 flex-1 self-center bg-[linear-gradient(var(--color-line),var(--color-line))] bg-[length:1px_20px] bg-center bg-no-repeat md:mx-1.5 md:w-px md:flex-none" aria-hidden />
          {([["left", AlignLeft, "Alinhar à esquerda"], ["center", AlignCenter, "Centralizar"], ["right", AlignRight, "Alinhar à direita"], ["justify", AlignJustify, "Justificar"]] as const).map(([v, I, r]) => (
            <button key={v} type="button" aria-label={r} title={r} className={icone(alinhamentoAtual === v)} onClick={() => editor.chain().focus().setTextAlign(v).run()}><I size={17} /></button>
          ))}
          <span className="mx-0 h-5 flex-1 self-center bg-[linear-gradient(var(--color-line),var(--color-line))] bg-[length:1px_20px] bg-center bg-no-repeat md:mx-1.5 md:w-px md:flex-none" aria-hidden />
          <button type="button" aria-label="Lista com marcadores" title="Lista com marcadores" className={icone(editor.isActive("bulletList"))} onClick={() => definirLista("pontos")}><List size={17} /></button>
          <button type="button" aria-label="Lista numerada" title="Lista numerada" className={icone(editor.isActive("orderedList"))} onClick={() => definirLista("numerada")}><ListOrdered size={17} /></button>
        </div>

        <span className="hidden md:contents">{divisor}</span>

        {/* Inserir: FORA do grupo dos ícones e ancorado à direita no celular,
            pra o menu dele não ser cortado e ele ficar sempre à mão */}
        <div ref={menuRef} className={"relative order-2 ml-auto md:order-none md:ml-0 " + (rodapeMobile ? "hidden md:block" : "")}>
          <button
            type="button"
            aria-haspopup="true" aria-expanded={menuAberto} aria-label="Inserir" title="Inserir"
            onClick={() => setMenuAberto((v) => !v)}
            className={`inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[13px] ${menuAberto ? "bg-soft text-ink" : `text-ink-soft hover:bg-soft hover:text-ink`}`}
          >
            <Plus size={16} /><span>Inserir</span><ChevronDown size={14} className="opacity-70" />
          </button>
          {menuAberto ? (
            <div className="absolute right-0 top-[38px] z-20 max-h-[60vh] min-w-[236px] overflow-y-auto rounded-xl bg-paper p-1.5 shadow-alta md:left-0 md:right-auto">
              <div className="px-2.5 pb-1 pt-2 text-[10.5px] font-semibold uppercase tracking-[.06em] text-ink-soft">Campos do casal</div>
              {Object.entries(ROTULOS_CAMPO).map(([nome, rotulo]) => (
                <button key={nome} type="button" onClick={() => { editor.chain().focus().insertContent({ type: "campo", attrs: { campo: nome } }).run(); setMenuAberto(false); }}
                  className={`flex w-full cursor-pointer items-center rounded-lg px-2.5 py-2 text-left text-[13.5px] text-ink hover:bg-soft`}>{rotulo}</button>
              ))}
              <div className="px-2.5 pb-1 pt-2 text-[10.5px] font-semibold uppercase tracking-[.06em] text-ink-soft">Blocos</div>
              <button type="button" onClick={() => { editor.chain().focus().insertContent({ type: "tabelaItens" }).run(); setMenuAberto(false); }}
                className={`flex w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[13.5px] text-ink hover:bg-soft`}><Table size={15} className="opacity-80" />Tabela de itens</button>
              <button type="button" onClick={() => { editor.chain().focus().insertContent({ type: "blocoAssinaturas" }).run(); setMenuAberto(false); }}
                className={`flex w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[13.5px] text-ink hover:bg-soft`}><PenTool size={15} className="opacity-80" />Bloco de assinaturas</button>
            </div>
          ) : null}
        </div>

        {lateral && !rodapeMobile ? (
          <button type="button" aria-label="Abrir painel" title="Abrir painel" onClick={() => setGavetaAberta(true)}
            className={"order-first md:hidden " + icone(gavetaAberta)}>
            <PanelLeft size={17} />
          </button>
        ) : null}
      </div>
      </div>

      </div>

      {/* a folha ocupa a largura toda, sem moldura de "caixinha" (o original
          chamava de .editor-folha) */}
      {lateral ? (
        <div className="flex flex-1">
          {/* computador: coluna fixa à esquerda, grudada abaixo do cabeçalho, rolando sozinha */}
          {/* fundo um tom abaixo do da folha (#ECEEF1 x --soft), pra lateral e mesa
              não virarem uma coisa só */}
          <aside className="hidden w-[320px] shrink-0 bg-[#ECEEF1] md:block" aria-label="Painel do contrato">
            <div className="sticky overflow-y-auto p-4 pb-8 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              style={{ top: alturaCabecalho, maxHeight: `calc(100dvh - ${alturaCabecalho}px)` }}>
              {lateral(editor, fecharGaveta)}
            </div>
          </aside>
          <EditorContent ref={areaFolha} editor={editor} className={"documento-editor folha-a4 min-w-0 flex-1 " + (rodapeMobile ? "com-rodape" : "")} />
          {rodapeMobile ? (
            <div className="fixed inset-x-0 bottom-0 z-20 bg-paper px-4 pb-[calc(10px+var(--sab))] pt-2.5 shadow-[0_-6px_20px_rgba(29,29,27,.08)] md:hidden">
              {rodapeMobile(() => setGavetaAberta(true))}
            </div>
          ) : null}
          {/* celular: sheet de baixo pra cima, por cima do documento */}
          <div className={"fixed inset-0 z-30 md:hidden " + (gavetaAberta ? "" : "pointer-events-none")} aria-hidden={!gavetaAberta}>
            <div onClick={fecharGaveta}
              className={"absolute inset-0 bg-ink/30 transition-opacity duration-300 " + (gavetaAberta ? "opacity-100" : "opacity-0")} />
            <aside aria-label="Painel do contrato"
              style={arrasto ? { translate: `0 ${arrasto}px` } : undefined}
              className={"absolute inset-x-0 bottom-0 flex h-[60dvh] flex-col rounded-t-[20px] bg-[#ECEEF1] shadow-alta " +
                (arrasto === null ? "transition-[translate] duration-300 ease-[var(--ease-desliza)] " : "") +
                (gavetaAberta ? "translate-y-0" : "translate-y-full")}>
              <div className="relative flex shrink-0 touch-none items-center justify-center px-2 pb-1 pt-2.5"
                onPointerDown={(e) => { inicioArrasto.current = e.clientY; setArrasto(0); e.currentTarget.setPointerCapture(e.pointerId); }}
                onPointerMove={(e) => { if (arrasto !== null) setArrasto(Math.max(0, e.clientY - inicioArrasto.current)); }}
                onPointerUp={() => { if ((arrasto ?? 0) > 90) fecharGaveta(); setArrasto(null); }}
                onPointerCancel={() => setArrasto(null)}>
                <span className="h-1.5 w-10 rounded-full bg-ink/15" aria-hidden />
                <button type="button" aria-label="Fechar painel" onClick={fecharGaveta} onPointerDown={(e) => e.stopPropagation()}
                  className={"absolute right-2 top-1.5 " + icone(false)}><X size={18} /></button>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-[calc(24px+var(--sab))] pt-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {gavetaAberta ? lateral(editor, fecharGaveta) : null}
              </div>
            </aside>
          </div>
        </div>
      ) : (
        <EditorContent ref={areaFolha} editor={editor} className="documento-editor folha-a4 flex-1" />
      )}
    </div>
  );
}

export { jsonParaHtml };

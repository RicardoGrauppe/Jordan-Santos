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

import { useEffect, useRef, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import type { JSONContent } from "@tiptap/core";
import type { ReactNode } from "react";
import {
  AlignCenter, AlignJustify, AlignLeft, AlignRight, Bold, ChevronDown, Italic, List, ListOrdered, PenTool, Plus, Table,
} from "lucide-react";
import { EXTENSOES, ROTULOS_CAMPO, jsonParaHtml } from "@/lib/contrato-editor";

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
};

export function EditorContrato({ conteudoInicial, aoMudar, topo }: EditorContratoProps) {
  const editor = useEditor({
    extensions: EXTENSOES,
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
    <div className="editor-contrato flex min-h-dvh flex-col bg-paper">
      {/* UM cabeçalho só: o nome do arquivo e a barra de formatação são faixas
          do mesmo bloco, mesmo fundo e sem linha entre elas — foi o que o
          original fez ao abrir o editor (`.editor-aberto .topo-estudio
          {border-bottom:0}`), porque um fio no meio partia o cabeçalho ao
          meio. A única separação é embaixo, entre o cabeçalho inteiro e o
          documento. Grudado no topo: só o documento rola. */}
      <div className="sticky top-0 z-10 shrink-0 bg-paper px-5 pt-[var(--sat)] md:px-7">
        {topo}
        {/* barra: no celular vira duas linhas por `order`; a ordem do DOM serve
            ao desktop, onde tudo cabe numa só */}
        <div className="flex flex-wrap items-center gap-1.5 py-1.5 pb-2 md:flex-nowrap">
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
        <div ref={menuRef} className="relative order-2 ml-auto md:order-none md:ml-0">
          <button
            type="button"
            aria-haspopup="true" aria-expanded={menuAberto} aria-label="Inserir" title="Inserir"
            onClick={() => setMenuAberto((v) => !v)}
            className={`inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[13px] ${menuAberto ? "bg-soft text-ink" : `text-ink-soft hover:bg-soft hover:text-ink`}`}
          >
            <Plus size={16} /><span>Inserir</span><ChevronDown size={14} className="opacity-70" />
          </button>
          {menuAberto ? (
            <div className="absolute right-0 top-[38px] z-20 max-h-[60vh] min-w-[236px] overflow-y-auto rounded-xl bg-line p-1.5 md:left-0 md:right-auto">
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
      </div>

      </div>

      {/* a folha ocupa a largura toda, sem moldura de "caixinha" (o original
          chamava de .editor-folha) */}
      <EditorContent editor={editor} className="documento-editor flex-1 px-5 pb-24 md:px-7" />
    </div>
  );
}

export { jsonParaHtml };

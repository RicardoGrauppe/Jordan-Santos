/*
  PROVA (22/10/2026): o editor do Ateliê na tela PADRÃO do Puck, pra comparar
  com a moldura própria (EditorAtelie.tsx). Abre no mesmo editor com
  `?tela=padrao`: salvamento, publicação, versões e campos são os mesmos, só
  a moldura muda.

  Aqui a tela é a do Puck (laterais que abrem/fecham e mudam de largura,
  tamanhos de tela com zoom, caminho Página › Bloco), e o nosso entra pelos
  pontos oficiais dele:
  - categorias do config: os grupos da lista;
  - overrides.componentItem: o bloco da lista, clicável pra inserir;
  - overrides.header: voltar, nome e estado do salvamento à esquerda;
  - overrides.headerActions: Ver como fica, Publicar e o menu Mais;
  - viewports: Celular, Tablet e Computador;
  - tokens de editor-tema.css: a pele da casa.
*/
"use client";

import { type ReactNode } from "react";
import { createUsePuck, Puck, type Config, type Viewports } from "@puckeditor/core";
import "@puckeditor/core/no-external.css";
import "@/lib/atelie/editor-tema.css";
import { configAtelie, type DadosSite } from "@/lib/atelie/blocos";
import type { TipoDeBloco } from "@/lib/atelie/tipos";
import {
  APRESENTACAO, DICIONARIO, GRUPOS, PERMISSOES_CELULAR, PERMISSOES_COMPUTADOR, rotuloDe, useCelular, ZONA_RAIZ,
} from "./EditorAtelie";

const usePuck = createUsePuck<typeof configAtelie>();

/* os grupos da lista viram as categorias nativas do Puck */
const configComGrupos = {
  ...configAtelie,
  categories: Object.fromEntries(
    GRUPOS.map((g, i) => ["g" + i, { title: g.titulo, components: g.tipos, defaultExpanded: true }]),
  ),
} as Config;

const TAMANHOS: Viewports = [
  { width: 390, height: "auto", label: "Celular", icon: "Smartphone" },
  { width: 768, height: "auto", label: "Tablet", icon: "Tablet" },
  { width: 1280, height: "auto", label: "Computador", icon: "Monitor" },
];

/* Bloco da lista: o mesmo ladrilho da moldura própria. Clicar põe o bloco
   logo depois do selecionado (ou no fim); arrastar continua com o Puck. */
function ItemDaLista({ name }: { name: string }) {
  const dispatch = usePuck((s) => s.dispatch);
  const seletor = usePuck((s) => s.appState.ui.itemSelector);
  const total = usePuck((s) => s.appState.data.content.length);
  const tipo = name as TipoDeBloco;
  const apresentacao = APRESENTACAO[tipo];
  const Icone = apresentacao?.Icone;

  function inserir() {
    const naRaiz = seletor && (seletor.zone ?? ZONA_RAIZ) === ZONA_RAIZ;
    const indice = naRaiz ? seletor.index + 1 : total;
    dispatch({ type: "insert", componentType: tipo, destinationIndex: indice, destinationZone: ZONA_RAIZ });
    dispatch({ type: "setUi", ui: { itemSelector: { index: indice, zone: ZONA_RAIZ } } });
  }

  return (
    <button type="button" onClick={inserir}
      className="flex w-full cursor-pointer items-center gap-2.5 rounded-xl bg-transparent px-2 py-2 text-left transition-colors hover:bg-soft">
      {Icone ? (
        <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-accent-tint text-accent">
          <Icone size={15} />
        </span>
      ) : null}
      <span className="min-w-0">
        <span className="block text-[13px] font-semibold leading-tight text-ink">{rotuloDe(tipo)}</span>
        {apresentacao ? <span className="block truncate text-[11.5px] text-ink-soft">{apresentacao.linha}</span> : null}
      </span>
    </button>
  );
}

export function EditorAtelieV2({ dados, contato, aoMudar, topo, acoes }: {
  dados: DadosSite;
  contato: unknown;
  aoMudar: (dados: DadosSite) => void;
  topo: ReactNode;
  acoes: ReactNode;
}) {
  const celular = useCelular();
  return (
    <div className="atelie-editor atelie-padrao fixed inset-0 z-50 bg-soft">
      <Puck
        config={configComGrupos}
        data={dados}
        permissions={celular ? PERMISSOES_CELULAR : PERMISSOES_COMPUTADOR}
        metadata={{ contato, celular }}
        dictionary={DICIONARIO}
        onChange={aoMudar as (d: unknown) => void}
        iframe={{ enabled: true }}
        viewports={TAMANHOS}
        height="100%"
        overrides={{
          componentItem: ({ name }) => <ItemDaLista name={name} />,
          headerActions: () => <div className="flex items-center gap-2">{acoes}</div>,
          header: ({ children }) => (
            <div className="atelie-padrao-topo flex items-center gap-3 bg-paper pl-3 shadow-card">
              <div className="min-w-0 max-w-[420px] shrink">{topo}</div>
              <div className="min-w-0 flex-1">{children}</div>
            </div>
          ),
        }}
      />
    </div>
  );
}

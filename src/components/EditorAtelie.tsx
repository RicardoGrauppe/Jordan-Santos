/*
  Editor do Ateliê (brandbook, seção 20): o Puck por dentro, a casa por fora.

  Em vez do layout pronto do Puck, a tela é montada com as peças dele
  (Puck.Preview, Puck.Fields, Puck.Outline e o Drawer dos blocos) dentro de
  uma moldura nossa: cabeçalho, colunas e cartões seguem o kit da casa, e o
  que é do Puck ganha a pele pelos tokens de `lib/atelie/editor-tema.css`.
  Textos da interface do Puck em português pelo `dictionary`.

  Quem usa passa os dados, recebe cada mudança em `aoMudar` (o salvamento é
  da página) e preenche o canto esquerdo do cabeçalho (`topo`, com voltar,
  nome e estado) e o direito (`acoes`, com publicar).

  No celular as três colunas viram uma barra flutuante (Blocos, Estrutura,
  Campos) que abre cada painel como folha de baixo pra cima, e tocar num bloco
  da página abre os campos dele.
*/
"use client";

import { useEffect, useState, type ComponentType, type ReactNode } from "react";
import { createUsePuck, Drawer, Puck, type Dictionary } from "@puckeditor/core";
import "@puckeditor/core/no-external.css";
import "@/lib/atelie/editor-tema.css";
import {
  Blocks, FileText, GalleryHorizontal, Image as IconeImagem, Images, LayoutGrid, ListTree, MessageCircle,
  Monitor, Package, PanelBottom, PanelTop, Quote, Redo2, SlidersHorizontal, Smartphone, Undo2, X,
} from "lucide-react";
import { configAtelie, type DadosSite } from "@/lib/atelie/blocos";
import { TIPOS_DE_BLOCO, type TipoDeBloco } from "@/lib/atelie/tipos";

const usePuck = createUsePuck<typeof configAtelie>();

/* zona raiz do Puck: onde moram os blocos da página */
const ZONA_RAIZ = "root:default-zone";

/* Largura da página no modo celular: um iPhone comum. */
const LARGURA_CELULAR = 390;

const DICIONARIO: Dictionary = {
  "header-publish": "Publicar",
  "header-undo": "Desfazer",
  "header-redo": "Refazer",
  "action-selectparent": "Selecionar o bloco de fora",
  "action-duplicate": "Duplicar",
  "action-delete": "Apagar",
  "label-page": "Página",
  "label-component": "Bloco",
  "outline-empty": "Nenhum bloco ainda",
  "outline-item-collapse": "Recolher",
  "outline-item-expand": "Abrir",
  "outline-header-title": "Estrutura",
  "outline-header-collapseall": "Recolher tudo",
  "outline-item-duplicate": "Duplicar",
  "outline-item-delete": "Apagar",
  "drawer-category-collapse": "Recolher {title}",
  "drawer-category-expand": "Abrir {title}",
  "drawer-category-other": "Outros",
  "canvas-noconfig": "Bloco desconhecido: {type}",
  "field-readonly": "Só leitura",
  "field-arrayitem-summary": "Item {index}",
  "field-arrayitem-duplicate": "Duplicar",
  "field-arrayitem-delete": "Apagar",
  "viewport-zoom-in": "Aproximar",
  "viewport-zoom-out": "Afastar",
  "viewport-zoom-auto": "{zoom}% (automático)",
  "viewport-toggle-menu": "Tamanhos de tela",
  "viewport-switch": "Ver em {label}",
  "viewport-switch-default": "Trocar tamanho de tela",
  "plugin-blocks": "Blocos",
  "plugin-outline": "Estrutura",
  "plugin-fields": "Campos",
  "plugin-components": "Blocos",
  "layout-maximize": "maximizar",
  "layout-minimize": "minimizar",
  "loader-loading": "carregando",
};

/* Como cada bloco se apresenta na lista: ícone e uma linha do que ele é. */
const APRESENTACAO: Record<TipoDeBloco, { Icone: ComponentType<{ size?: number }>; linha: string }> = {
  Capa: { Icone: PanelTop, linha: "Logo sobre fundo escuro, abre a página" },
  FotoInteira: { Icone: IconeImagem, linha: "Uma foto de ponta a ponta" },
  Pacotes: { Icone: Package, linha: "Cartões com itens e preço" },
  ListaSobreFoto: { Icone: GalleryHorizontal, linha: "Lista de preços em cima de uma foto" },
  Cartoes: { Icone: LayoutGrid, linha: "Cartões centrais com descrição e preço" },
  TextoComFotos: { Icone: Images, linha: "Título, parágrafos e fotos lado a lado" },
  Citacao: { Icone: Quote, linha: "Uma frase grande sobre a foto" },
  Chamada: { Icone: MessageCircle, linha: "Convite com o botão do WhatsApp" },
  Rodape: { Icone: PanelBottom, linha: "Assinatura e contatos do estúdio" },
};

/** Leva a página do editor (que mora num iframe) até o bloco quando o topo
    dele está fora da tela, assim que ele aparecer lá dentro. Bloco à vista
    não se mexe: clicar nele na própria página não pode fazer a tela pular. */
function rolarAte(id: string, tentativas = 20) {
  const frame = document.querySelector<HTMLIFrameElement>("#preview-frame");
  const alvo = frame?.contentDocument?.querySelector(`[data-puck-component="${CSS.escape(id)}"]`);
  if (!alvo) {
    if (tentativas > 0) setTimeout(() => rolarAte(id, tentativas - 1), 50);
    return;
  }
  const { top } = alvo.getBoundingClientRect();
  const altura = frame?.contentWindow?.innerHeight ?? 0;
  /* salto direto, não suave: a página tem `scroll-behavior: smooth` (é da
     proposta) e a animação nem sempre anda dentro do iframe do editor */
  if (top < 0 || top > altura * 0.8) alvo.scrollIntoView({ behavior: "instant", block: "start" });
}

const rotuloDe = (tipo: string) => configAtelie.components[tipo as TipoDeBloco]?.label ?? tipo;

/* ---------- peças da moldura ---------- */

function Cartao({ className = "", children }: { className?: string; children: ReactNode }) {
  return <div className={"rounded-[20px] bg-paper shadow-card " + className}>{children}</div>;
}

/** Seletor em pílulas (Computador/Celular, Blocos/Estrutura): o ativo é branco
    elevado sobre o trilho --soft. */
function Pilulas<T extends string>({ valor, opcoes, aoMudar, larga = false }: {
  valor: T; opcoes: { valor: T; rotulo: string; Icone?: ComponentType<{ size?: number }> }[];
  aoMudar: (v: T) => void; larga?: boolean;
}) {
  return (
    <div className={"flex gap-0.5 rounded-full bg-soft p-[3px] " + (larga ? "w-full" : "")}>
      {opcoes.map(({ valor: v, rotulo, Icone }) => (
        <button key={v} type="button" onClick={() => aoMudar(v)} aria-pressed={valor === v}
          className={
            "inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-full px-3 py-[5px] text-[12.5px] font-semibold transition-colors " +
            (larga ? "flex-1 " : "") +
            (valor === v ? "bg-paper text-accent shadow-card" : "text-ink-soft hover:text-ink")
          }>
          {Icone ? <Icone size={14} /> : null}{rotulo}
        </button>
      ))}
    </div>
  );
}

function BotaoIcone({ rotulo, desligado, aoClicar, children }: { rotulo: string; desligado?: boolean; aoClicar: () => void; children: ReactNode }) {
  return (
    <button type="button" aria-label={rotulo} title={rotulo} disabled={desligado} onClick={aoClicar}
      className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-[10px] text-ink-soft transition-colors enabled:hover:bg-soft enabled:hover:text-ink disabled:cursor-default disabled:opacity-35">
      {children}
    </button>
  );
}

/* ---------- lista de blocos ---------- */

/* Cada bloco é arrastável (o Drawer do Puck cuida do arrasto) e clicável:
   clicar põe o bloco logo depois do selecionado, ou no fim da página. */
function ListaDeBlocos({ aoInserir }: { aoInserir?: () => void }) {
  const dispatch = usePuck((s) => s.dispatch);
  const seletor = usePuck((s) => s.appState.ui.itemSelector);
  const total = usePuck((s) => s.appState.data.content.length);

  function inserir(tipo: string) {
    const naRaiz = seletor && (seletor.zone ?? ZONA_RAIZ) === ZONA_RAIZ;
    const indice = naRaiz ? seletor.index + 1 : total;
    dispatch({ type: "insert", componentType: tipo, destinationIndex: indice, destinationZone: ZONA_RAIZ });
    /* selecionar o bloco novo abre os campos dele e, pela Moldura, rola a
       página até ele: inserido fora da tela, ele parecia não ter entrado */
    dispatch({ type: "setUi", ui: { itemSelector: { index: indice, zone: ZONA_RAIZ } } });
    aoInserir?.();
  }

  return (
    <Drawer>
      <div className="grid gap-1">
        {TIPOS_DE_BLOCO.map((tipo) => {
          const { Icone, linha } = APRESENTACAO[tipo];
          return (
            <Drawer.Item key={tipo} name={tipo} label={rotuloDe(tipo)}>
              {() => (
                <button type="button" onClick={() => inserir(tipo)}
                  className="flex w-full cursor-pointer items-center gap-2.5 rounded-xl bg-transparent px-2 py-2 text-left transition-colors hover:bg-soft">
                  <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-accent-tint text-accent">
                    <Icone size={15} />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[13px] font-semibold leading-tight text-ink">{rotuloDe(tipo)}</span>
                    <span className="block truncate text-[11.5px] text-ink-soft">{linha}</span>
                  </span>
                </button>
              )}
            </Drawer.Item>
          );
        })}
      </div>
    </Drawer>
  );
}

/* ---------- campos ---------- */

function CabecalhoCampos() {
  const selecionado = usePuck((s) => s.selectedItem);
  const tipo = selecionado?.type as TipoDeBloco | undefined;
  const Icone = tipo ? APRESENTACAO[tipo]?.Icone ?? Blocks : FileText;
  return (
    <div className="flex items-center gap-2.5 px-4 pb-1 pt-4">
      <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[13px] bg-accent-tint text-accent">
        <Icone size={17} />
      </span>
      <div className="min-w-0">
        <div className="truncate text-[14px] font-semibold text-ink">{tipo ? rotuloDe(tipo) : "Página"}</div>
        <div className="text-[12px] text-ink-soft">
          {tipo ? "Campos deste bloco" : "Título e contato valem pro site inteiro"}
        </div>
      </div>
    </div>
  );
}

function PainelCampos() {
  return (
    <>
      <CabecalhoCampos />
      <div className="atelie-campos px-1 pb-3">
        <Puck.Fields />
      </div>
    </>
  );
}

/* ---------- moldura ---------- */

type Painel = "blocos" | "estrutura" | "campos";

function Moldura({ topo, acoes }: { topo: ReactNode; acoes: ReactNode }) {
  const history = usePuck((s) => s.history);
  const selecionadoId = usePuck((s) => s.selectedItem?.props.id ?? null);
  const [tela, setTela] = useState<"computador" | "celular">("computador");
  const [lateral, setLateral] = useState<"blocos" | "estrutura">("blocos");
  const [folha, setFolha] = useState<Painel | null>(null);

  /* bloco escolhido pela Estrutura ou recém-inserido: a página vai até ele */
  useEffect(() => {
    if (selecionadoId) rolarAte(selecionadoId);
  }, [selecionadoId]);

  /* no celular, tocar num bloco da página abre os campos dele; o estado é
     escrito no callback do timer, nunca solto no corpo do efeito */
  useEffect(() => {
    if (!selecionadoId) return;
    const celular = window.matchMedia("(max-width: 767.98px)");
    if (!celular.matches) return;
    const t = setTimeout(() => setFolha("campos"), 0);
    return () => clearTimeout(t);
  }, [selecionadoId]);

  const larguraPagina = tela === "celular" ? LARGURA_CELULAR : undefined;

  return (
    <div className="atelie-editor fixed inset-0 z-50 flex flex-col bg-soft">
      {/* cabeçalho */}
      <header className="relative z-10 flex shrink-0 items-center gap-3 bg-paper px-3 py-2.5 shadow-card md:px-4">
        <div className="min-w-0 flex-1">{topo}</div>
        <div className="hidden items-center gap-2 md:flex">
          <Pilulas valor={tela} aoMudar={setTela} opcoes={[
            { valor: "computador", rotulo: "Computador", Icone: Monitor },
            { valor: "celular", rotulo: "Celular", Icone: Smartphone },
          ]} />
          <BotaoIcone rotulo="Desfazer" desligado={!history.hasPast} aoClicar={history.back}><Undo2 size={17} /></BotaoIcone>
          <BotaoIcone rotulo="Refazer" desligado={!history.hasFuture} aoClicar={history.forward}><Redo2 size={17} /></BotaoIcone>
        </div>
        <div className="flex shrink-0 items-center gap-2">{acoes}</div>
      </header>

      <div className="flex min-h-0 flex-1 gap-3 p-0 md:p-3">
        {/* blocos e estrutura (computador) */}
        <aside className="hidden w-[300px] shrink-0 flex-col md:flex">
          <Cartao className="flex min-h-0 flex-1 flex-col p-3">
            <Pilulas larga valor={lateral} aoMudar={setLateral} opcoes={[
              { valor: "blocos", rotulo: "Blocos", Icone: Blocks },
              { valor: "estrutura", rotulo: "Estrutura", Icone: ListTree },
            ]} />
            <div className="atelie-rolagem mt-3 min-h-0 flex-1 overflow-y-auto">
              {lateral === "blocos" ? <ListaDeBlocos /> : <Puck.Outline />}
            </div>
          </Cartao>
        </aside>

        {/* a página */}
        <main className="flex min-h-0 min-w-0 flex-1 justify-center overflow-hidden">
          <div
            className="h-full w-full overflow-hidden bg-paper md:rounded-2xl md:shadow-alta"
            style={larguraPagina ? { maxWidth: larguraPagina } : undefined}
          >
            <Puck.Preview />
          </div>
        </main>

        {/* campos (computador) */}
        <aside className="hidden w-[340px] shrink-0 flex-col md:flex">
          <Cartao className="atelie-rolagem min-h-0 flex-1 overflow-y-auto">
            <PainelCampos />
          </Cartao>
        </aside>
      </div>

      {/* celular: barra flutuante e folha */}
      <nav className="fixed inset-x-4 bottom-[calc(0.75rem+var(--sab))] z-20 mx-auto flex h-[60px] max-w-[420px] items-center justify-around rounded-full bg-[linear-gradient(180deg,#ffffff,#f9fafb)] px-2 shadow-flutuante md:hidden">
        {([
          { id: "blocos", rotulo: "Blocos", Icone: Blocks },
          { id: "estrutura", rotulo: "Estrutura", Icone: ListTree },
          { id: "campos", rotulo: "Campos", Icone: SlidersHorizontal },
        ] as const).map(({ id, rotulo, Icone }) => (
          <button key={id} type="button" onClick={() => setFolha((f) => (f === id ? null : id))} aria-pressed={folha === id}
            className={"inline-flex h-11 cursor-pointer items-center gap-1.5 rounded-full px-4 text-[13px] font-semibold transition-colors " +
              (folha === id ? "bg-accent-tint text-accent" : "text-ink-soft")}>
            <Icone size={17} />{rotulo}
          </button>
        ))}
      </nav>

      {folha ? (
        <div className="fixed inset-x-0 bottom-0 z-30 flex max-h-[72dvh] flex-col rounded-t-[22px] bg-paper pb-[var(--sab)] shadow-flutuante md:hidden">
          <div className="flex shrink-0 items-center justify-between px-4 pb-1 pt-3">
            <span className="text-[14px] font-semibold text-ink">
              {folha === "blocos" ? "Blocos" : folha === "estrutura" ? "Estrutura" : "Campos"}
            </span>
            <BotaoIcone rotulo="Fechar" aoClicar={() => setFolha(null)}><X size={18} /></BotaoIcone>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-4">
            {folha === "blocos" ? <ListaDeBlocos aoInserir={() => setFolha(null)} /> : folha === "estrutura" ? <Puck.Outline /> : <PainelCampos />}
          </div>
        </div>
      ) : null}
    </div>
  );
}

/* ---------- editor ---------- */

export function EditorAtelie({ dados, contato, aoMudar, topo, acoes }: {
  dados: DadosSite;
  /** contato do estúdio montado dos campos da página, pros blocos lerem */
  contato: unknown;
  aoMudar: (dados: DadosSite) => void;
  topo: ReactNode;
  acoes: ReactNode;
}) {
  return (
    <Puck
      config={configAtelie}
      data={dados}
      metadata={{ contato }}
      dictionary={DICIONARIO}
      onChange={aoMudar}
      iframe={{ enabled: true }}
    >
      <Moldura topo={topo} acoes={acoes} />
    </Puck>
  );
}

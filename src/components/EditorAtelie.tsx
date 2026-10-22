/*
  Editor do Ateliê: a tela ORIGINAL do Puck, do jeito que ele vem (decisão do
  Ricardo Grauppe, 22/10/2026). Nada de tamanhos de tela próprios,
  permissões nem pele da casa: só o config dos blocos (com os campos de foto
  e foco), os textos em português, o botão Publicar do próprio Puck ligado
  à nossa publicação e dois acréscimos nos pontos oficiais dele:

  - header: uma seta de voltar no quadrado vazio que o Puck deixa no canto
    do cabeçalho, em cima da barra de ícones da esquerda (os 67px de padding
    do PuckHeader a partir de 638px). No celular, onde esse quadrado não
    existe, ela fica na ponta esquerda, que lá está vazia porque o Puck
    esconde os botões das laterais;
  - drawerItem: na lista da esquerda, cada seção pronta vira um cartão com
    a prévia de verdade dela (PreviaSecao.tsx), nome e uma linha do que vem,
    no lugar do nome solto: só o nome não dizia o que era aquilo nem que
    era pra arrastar. Clicar no cartão põe a seção logo depois do bloco
    selecionado; arrastar continua com o Puck. Os blocos soltos seguem com
    o item padrão.

  A seta é o IconButton do próprio Puck, pra ficar com a cara dele.
*/
"use client";

import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { createUsePuck, IconButton, Puck, type Config } from "@puckeditor/core";
import "@puckeditor/core/no-external.css";
import { configAtelie, DESCRICAO_SECAO, type DadosSite } from "@/lib/atelie/blocos";
import { DICIONARIO } from "@/lib/atelie/dicionario";
import { TIPOS_DE_SECAO, type TipoDeSecao } from "@/lib/atelie/tipos";
import { PreviaSecao } from "./PreviaSecao";

const usePuck = createUsePuck<typeof configAtelie>();

/* zona raiz do Puck: onde moram os blocos da página */
const ZONA_RAIZ = "root:default-zone";

const ehSecao = (nome: string): nome is TipoDeSecao => (TIPOS_DE_SECAO as readonly string[]).includes(nome);

/* Cartão de uma seção pronta na lista da esquerda. Clicar põe a seção logo
   depois do bloco selecionado (se ele está dentro de uma seção, depois da
   seção), ou no fim da página; ela entra selecionada e a página rola até
   ela. Arrastar é com o Puck, que envolve este cartão. */
function CartaoSecao({ tipo }: { tipo: TipoDeSecao }) {
  const dispatch = usePuck((s) => s.dispatch);
  const seletor = usePuck((s) => s.appState.ui.itemSelector);
  const conteudo = usePuck((s) => s.appState.data.content);

  function inserir() {
    const zona = seletor?.zone ?? ZONA_RAIZ;
    const indiceDoPai = zona === ZONA_RAIZ ? -1 : conteudo.findIndex((b) => b.props.id === zona.split(":")[0]);
    const indice = !seletor ? conteudo.length : zona === ZONA_RAIZ ? seletor.index + 1 : indiceDoPai >= 0 ? indiceDoPai + 1 : conteudo.length;
    const id = tipo + "-" + crypto.randomUUID();
    dispatch({ type: "insert", componentType: tipo, destinationIndex: indice, destinationZone: ZONA_RAIZ, id });
    dispatch({ type: "setUi", ui: { itemSelector: { index: indice, zone: ZONA_RAIZ } } });
    /* a página do editor mora no iframe do Puck; espera ele desenhar */
    setTimeout(() => {
      const quadro = document.getElementById("preview-frame") as HTMLIFrameElement | null;
      quadro?.contentDocument?.querySelector(`[data-puck-component="${id}"]`)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 120);
  }

  return (
    <div onClick={inserir} title="Clique pra pôr na página, ou arraste até onde quiser"
      className="mb-2 cursor-grab overflow-hidden rounded-[10px] bg-white shadow-[0_1px_2px_rgba(0,0,0,.08),0_2px_8px_rgba(0,0,0,.06)] transition-shadow [@media(hover:hover)]:hover:shadow-[0_2px_4px_rgba(0,0,0,.1),0_6px_16px_rgba(0,0,0,.1)]">
      <PreviaSecao tipo={tipo} />
      <div className="px-3 pb-2.5 pt-2">
        <div className="text-[13px] font-semibold leading-tight text-[#1f2329]">{configAtelie.components[tipo].label}</div>
        <div className="mt-0.5 text-[11.5px] leading-snug text-[#6b7280]">{DESCRICAO_SECAO[tipo]}</div>
      </div>
    </div>
  );
}

export function EditorAtelie({ dados, contato, aoMudar, titulo, aoPublicar, aoVoltar }: {
  dados: DadosSite;
  contato: unknown;
  aoMudar: (dados: DadosSite) => void;
  titulo: string;
  aoPublicar: () => void;
  aoVoltar: () => void;
}) {
  return (
    <Puck
      config={configAtelie as Config}
      data={dados}
      metadata={{ contato }}
      dictionary={DICIONARIO}
      onChange={aoMudar as (d: unknown) => void}
      onPublish={aoPublicar}
      headerTitle={titulo}
      overrides={{
        /* o invólucro herda a área "header" da grade do Puck, que era do
           próprio cabeçalho */
        header: ({ children }) => (
          <div className="relative" style={{ gridArea: "header" }}>
            {children}
            <div className="absolute inset-y-0 left-2 flex items-center min-[638px]:left-0 min-[638px]:w-[67px] min-[638px]:justify-center">
              <IconButton title="Voltar" onClick={aoVoltar}>
                <ArrowLeft focusable="false" />
              </IconButton>
            </div>
          </div>
        ),
        drawerItem: ({ children, name }: { children: ReactNode; name: string }) =>
          ehSecao(name) ? <CartaoSecao tipo={name} /> : <>{children}</>,
      }}
    />
  );
}

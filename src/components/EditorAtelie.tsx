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
  - headerActions: "Seções prontas", antes do Publicar, que abre a
    biblioteca de seções com prévia (SecoesProntas.tsx). Arrastar da lista
    da esquerda não dizia sozinho o que aqueles nomes eram.

  Os botões são o Button e o IconButton do próprio Puck, pra ficar com a
  cara dele.
*/
"use client";

import { useState, type ReactNode } from "react";
import { ArrowLeft, LayoutTemplate } from "lucide-react";
import { Button, createUsePuck, IconButton, Puck, type Config } from "@puckeditor/core";
import "@puckeditor/core/no-external.css";
import { configAtelie, type DadosSite } from "@/lib/atelie/blocos";
import { DICIONARIO } from "@/lib/atelie/dicionario";
import type { TipoDeSecao } from "@/lib/atelie/tipos";
import { SecoesProntas } from "./SecoesProntas";

const usePuck = createUsePuck<typeof configAtelie>();

/* zona raiz do Puck: onde moram os blocos da página */
const ZONA_RAIZ = "root:default-zone";

/* Abre a biblioteca e põe a seção escolhida logo depois do bloco
   selecionado (se ele está dentro de uma seção, depois da seção), ou no fim
   da página. A seção entra selecionada, e a página rola até ela. */
function BotaoSecoes() {
  const dispatch = usePuck((s) => s.dispatch);
  const seletor = usePuck((s) => s.appState.ui.itemSelector);
  const conteudo = usePuck((s) => s.appState.data.content);
  const [aberto, setAberto] = useState(false);

  function inserir(tipo: TipoDeSecao) {
    const zona = seletor?.zone ?? ZONA_RAIZ;
    const indiceDoPai = zona === ZONA_RAIZ ? -1 : conteudo.findIndex((b) => b.props.id === zona.split(":")[0]);
    const indice = !seletor ? conteudo.length : zona === ZONA_RAIZ ? seletor.index + 1 : indiceDoPai >= 0 ? indiceDoPai + 1 : conteudo.length;
    const id = tipo + "-" + crypto.randomUUID();
    dispatch({ type: "insert", componentType: tipo, destinationIndex: indice, destinationZone: ZONA_RAIZ, id });
    dispatch({ type: "setUi", ui: { itemSelector: { index: indice, zone: ZONA_RAIZ } } });
    setAberto(false);
    /* a página do editor mora no iframe do Puck; espera ele desenhar */
    setTimeout(() => {
      const quadro = document.getElementById("preview-frame") as HTMLIFrameElement | null;
      quadro?.contentDocument?.querySelector(`[data-puck-component="${id}"]`)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 120);
  }

  return (
    <>
      <Button variant="secondary" icon={<LayoutTemplate size={14} />} onClick={() => setAberto(true)}>Seções prontas</Button>
      {aberto ? <SecoesProntas aoEscolher={inserir} aoFechar={() => setAberto(false)} /> : null}
    </>
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
        headerActions: ({ children }: { children: ReactNode }) => (
          <>
            <BotaoSecoes />
            {children}
          </>
        ),
      }}
    />
  );
}

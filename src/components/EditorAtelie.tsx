/*
  Editor do Ateliê: a tela ORIGINAL do Puck, do jeito que ele vem (decisão do
  Ricardo Grauppe, 22/10/2026). Nada de tamanhos de tela próprios,
  permissões nem pele da casa: só o config dos blocos (com os campos de foto
  e foco), os textos em português, o botão Publicar do próprio Puck ligado
  à nossa publicação e uma seta de voltar, o único override: no quadrado
  vazio que o Puck deixa no canto do cabeçalho, em cima da barra de ícones
  da esquerda (os 67px de padding do PuckHeader a partir de 638px). No
  celular, onde esse quadrado não existe, ela fica na ponta esquerda, que lá
  está vazia porque o Puck esconde os botões das laterais. É o IconButton
  do próprio Puck, pra ficar com a cara dele.
*/
"use client";

import { ArrowLeft } from "lucide-react";
import { IconButton, Puck, type Config } from "@puckeditor/core";
import "@puckeditor/core/no-external.css";
import { configAtelie, type DadosSite } from "@/lib/atelie/blocos";
import { DICIONARIO } from "@/lib/atelie/dicionario";

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
      }}
    />
  );
}

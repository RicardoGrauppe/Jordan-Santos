/*
  Editor do Ateliê: a tela ORIGINAL do Puck, do jeito que ele vem (decisão do
  Ricardo Grauppe, 22/10/2026). Nada de override, tamanhos de tela próprios,
  permissões nem pele da casa: só o config dos blocos (com os campos de foto
  e foco), os textos em português e o botão Publicar do próprio Puck ligado
  à nossa publicação.
*/
"use client";

import { Puck, type Config } from "@puckeditor/core";
import "@puckeditor/core/no-external.css";
import { configAtelie, type DadosSite } from "@/lib/atelie/blocos";
import { DICIONARIO } from "@/lib/atelie/dicionario";

export function EditorAtelie({ dados, contato, aoMudar, titulo, aoPublicar }: {
  dados: DadosSite;
  contato: unknown;
  aoMudar: (dados: DadosSite) => void;
  titulo: string;
  aoPublicar: () => void;
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
    />
  );
}

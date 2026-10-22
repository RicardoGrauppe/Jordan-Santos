/*
  PROVA (22/10/2026): o editor do Ateliê na tela ORIGINAL do Puck, do jeito
  que ele vem, pra comparar com a moldura própria (EditorAtelie.tsx). Abre no
  mesmo editor com `?tela=padrao`: salvamento e publicação são os mesmos.

  Nada de override, tamanhos de tela, permissões nem pele da casa: só o
  config dos blocos (com os campos de foto e foco), os textos em português e
  o botão Publicar do próprio Puck ligado à nossa publicação. Não importa
  nada de EditorAtelie.tsx, senão o editor-tema.css vem junto.
*/
"use client";

import { Puck, type Config } from "@puckeditor/core";
import "@puckeditor/core/no-external.css";
import { configAtelie, type DadosSite } from "@/lib/atelie/blocos";
import { DICIONARIO } from "@/lib/atelie/dicionario";

export function EditorAtelieV2({ dados, contato, aoMudar, titulo, aoPublicar }: {
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

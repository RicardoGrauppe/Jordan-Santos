/*
  Editor de prova do Ateliê (temporário, até a tela de edição de verdade): o
  Puck em tela cheia com a proposta inteira em blocos. Nada é salvo.

  O contato do estúdio é campo da página e chega aos blocos pelo `metadata`;
  por isso ele acompanha o que é digitado nos campos da página.
*/
"use client";

import { useState } from "react";
import { Puck } from "@puckeditor/core";
import "@puckeditor/core/puck.css";
import { configAtelie, contatoDaPagina, type DadosSite } from "@/lib/atelie/blocos";
import { MODELO_INICIAL } from "@/lib/atelie/modelo-inicial";

export default function EditorProvaAtelie() {
  const [raiz, setRaiz] = useState(MODELO_INICIAL.root.props);
  return (
    <div className="fixed inset-0 z-50 bg-paper">
      <Puck
        config={configAtelie}
        data={MODELO_INICIAL}
        metadata={{ contato: contatoDaPagina(raiz) }}
        onChange={(dados: DadosSite) => setRaiz(dados.root.props)}
      />
    </div>
  );
}

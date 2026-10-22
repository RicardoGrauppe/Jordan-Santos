/*
  Editor de prova do Ateliê (temporário): o Puck em tela cheia com os blocos
  da proposta. Nada é salvo, a prova é só ver o editor funcionando por cima
  do mesmo CSS da página pública.
*/
"use client";

import { Puck } from "@puckeditor/core";
import "@puckeditor/core/puck.css";
import { configAtelie } from "@/lib/atelie/blocos";
import { DADOS_PROVA } from "@/lib/atelie/dados-prova";

export default function EditorProvaAtelie() {
  return (
    <div className="fixed inset-0 z-50 bg-paper">
      <Puck config={configAtelie} data={DADOS_PROVA} />
    </div>
  );
}

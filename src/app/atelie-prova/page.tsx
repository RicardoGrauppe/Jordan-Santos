/*
  Prova do Ateliê (temporária): o começo da proposta montado com blocos do
  Puck, renderizado no servidor. Serve só pra comparar com o /proposta; sai
  quando o Ateliê de verdade entrar.
*/
import type { Metadata } from "next";
import { Render } from "@puckeditor/core";
import { configAtelie } from "@/lib/atelie/blocos";
import { DADOS_PROVA } from "@/lib/atelie/dados-prova";

export const metadata: Metadata = { title: "Prova do Ateliê", robots: { index: false } };

export default function ProvaAtelie() {
  return <Render config={configAtelie} data={DADOS_PROVA} />;
}

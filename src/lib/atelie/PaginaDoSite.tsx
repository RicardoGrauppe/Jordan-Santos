/*
  Uma página do site montada a partir dos dados de um modelo. Server
  Component: é o que o público recebe na raiz e no /proposta, e o que a
  prévia do Ateliê mostra pro fotógrafo. O contato do estúdio sai dos campos
  da página e chega aos blocos pelo metadata (ver blocos.tsx).
*/
import { Render } from "@puckeditor/core";
import { configAtelie, contatoDaPagina, type DadosSite } from "./blocos";

export function PaginaDoSite({ dados }: { dados: DadosSite }) {
  return <Render config={configAtelie} data={dados} metadata={{ contato: contatoDaPagina(dados.root.props) }} />;
}

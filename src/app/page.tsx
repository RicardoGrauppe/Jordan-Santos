/*
  A raiz é o site do fotógrafo: o modelo do Ateliê que está no ar (versão
  publicada). Até o Ateliê, a raiz só mandava pro painel ou pro login; agora o
  fotógrafo entra por /painel (ou /entrar), e quem recebe o link do estúdio
  cai direto no site, como num WordPress.

  O /proposta mostra a mesma coisa, pra não quebrar link já enviado.
*/
import type { Metadata } from "next";
import { siteNoAr } from "@/lib/atelie/modelos";
import { PaginaDoSite } from "@/lib/atelie/PaginaDoSite";

export async function generateMetadata(): Promise<Metadata> {
  const site = await siteNoAr();
  return {
    title: site.root.props?.titulo || "Proposta",
    description: "Pacotes de fotografia de casamento, adicionais, álbum e pré-wedding.",
  };
}

export default async function Raiz() {
  return <PaginaDoSite dados={await siteNoAr()} />;
}

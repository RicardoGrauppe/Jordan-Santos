/*
  Proposta comercial, /proposta: o site que o CLIENTE do fotógrafo abre.

  Desde o Ateliê (22/10/2026) esta página não tem conteúdo próprio: mostra o
  modelo que o fotógrafo deixou no ar (versão publicada), montado com os
  blocos de `lib/atelie/blocos.tsx`. É a mesma página da raiz `/`, que virou
  o endereço do site; esta fica pra não quebrar link já enviado. Sem modelo publicado, mostra o
  MODELO_INICIAL, que é a proposta de sempre, portada do `index.html` do
  estúdio do Jordan.

  Continua valendo o que vinha do original: página estática, sem clique nem
  seleção de produto, sem CTA pro /cadastro (esse link o fotógrafo manda
  depois de conversar). A voz é a do estúdio em primeira pessoa do plural.
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

export default async function PaginaProposta() {
  return <PaginaDoSite dados={await siteNoAr()} />;
}

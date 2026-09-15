/*
  Manifest do app, servido em /manifest.webmanifest. Portado do
  estudio.webmanifest do original.

  `start_url` é /painel (lá era /estudio): ao salvar na tela de início, o iOS
  ignora a página que estava aberta e usa o start_url do manifest, então um
  start_url errado abre o atalho no lugar errado.

  `scope` segue "/" de propósito, como no original: o painel abre a revisão do
  contrato e outras rotas fora de /painel, e um escopo estreito jogaria isso
  pro navegador, fora do app.
*/
import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Estúdio",
    short_name: "Estúdio",
    description: "Painel do fotógrafo: clientes, contrato, assinatura e entrega.",
    start_url: "/painel",
    scope: "/",
    display: "standalone",
    background_color: "#003646",
    theme_color: "#003646",
    icons: [
      { src: "/img/icone-192.png", sizes: "192x192", type: "image/png" },
      { src: "/img/icone-512.png", sizes: "512x512", type: "image/png" },
      { src: "/img/icone-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}

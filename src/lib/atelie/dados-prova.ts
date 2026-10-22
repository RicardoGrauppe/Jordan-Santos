/*
  Conteúdo da prova do Ateliê: o começo da proposta do Jordan (capa, foto de
  abertura, pacotes, foto da noiva e adicionais) escrito como dados de bloco.
  Textos copiados do /proposta, pra comparar lado a lado.
*/
import type { Data } from "@puckeditor/core";

export const DADOS_PROVA: Data = {
  root: { props: {} },
  content: [
    {
      type: "Capa",
      props: { id: "capa-1", logo: "/img/logo-principal-offwhite.png", logoAlt: "Jordan Santos", frase: "Role para ver a proposta" },
    },
    {
      type: "FotoInteira",
      props: { id: "foto-1", src: "/img/casal-jardim.jpg", alt: "Casal de noivos caminhando de mãos dadas em um jardim" },
    },
    {
      type: "Pacotes",
      props: {
        id: "pacotes-1",
        selo: "Conheça os pacotes",
        titulo: "Pacotes Casamento",
        pacotes: [
          {
            nome: "01. Eternal",
            itens: [
              "Making of dos noivos",
              "Fotos da cerimônia e festa",
              "Galeria de fotos on-line",
              "Tratamento digital de luz, sombra e cor",
              "1 álbum 30x30 (60 páginas) até 100 fotos",
              "Ensaio pré-wedding",
              "1 álbum 28x20 com 40 fotos editadas e tratadas",
              "12 horas de cobertura",
              "2 fotógrafos",
            ].join("\n"),
            preco: "R$ 18.600,00",
            parcela: "10x 1.860,00",
          },
          {
            nome: "02. Heritage",
            itens: [
              "Making of dos noivos",
              "Fotos da cerimônia e festa",
              "Galeria de fotos on-line",
              "Tratamento digital de luz, sombra e cor",
              "10 horas de cobertura",
              "2 fotógrafos",
            ].join("\n"),
            preco: "R$ 10.850,00",
            parcela: "10x 1.085,00",
          },
        ],
      },
    },
    {
      type: "FotoInteira",
      props: { id: "foto-2", src: "/img/noiva-retrato.jpg", alt: "Retrato em preto e branco da noiva com véu, sentada" },
    },
    {
      type: "Adicionais",
      props: {
        id: "adicionais-1",
        selo: "Adicionais disponíveis",
        titulo: "Adicionais",
        foto: "/img/casal-campo.jpg",
        linhas: [
          { nome: "Welcome Wedding", valor: "R$ 2.790,00" },
          { nome: "Fotógrafo adicional", valor: "R$ 1.150,00" },
          { nome: "Entrega Expressa em 7 dias", valor: "R$ 3.500,00" },
          { nome: "Bride Session · Ensaio editorial da Noiva", valor: "R$ 2.790,00" },
          { nome: "Hora adicional · Cobertura Casamento", valor: "R$ 1.100,00" },
          { nome: "Cobertura fotográfica Casamento Civil", valor: "R$ 2.690,00" },
        ],
      },
    },
  ],
  zones: {},
};

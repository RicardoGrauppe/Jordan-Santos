/*
  O modelo com que o Ateliê começa: a proposta do Jordan inteira, escrita como
  dados de bloco. Textos, preços, fotos e contatos copiados do /proposta (que
  veio do `index.html` original) e o foco de cada foto, que antes ficava no
  CSS pelo nome do arquivo.

  Duas funções: é o que o site mostra enquanto nenhum modelo foi publicado, e
  é o conteúdo do primeiro modelo que o Ateliê cria no banco.
*/
import type { DadosSite } from "./blocos";

export const NOME_MODELO_INICIAL = "Proposta casamento";

export const MODELO_INICIAL: DadosSite = {
  root: {
    props: {
      titulo: "Proposta",
      nomeEstudio: "Jordan Santos Fotografia",
      telefone: "(45) 99907-7874",
      whatsapp: "5545999077874",
      mensagemWhatsapp: "Oi Jordan! Vim pelo site e queria falar sobre o casamento.",
      email: "jordansantosfotografia@gmail.com",
      instagram: "jordansantosphotography",
    },
  },
  content: [
    {
      type: "Capa",
      props: { id: "capa", logo: "/img/logo-principal-offwhite.png", logoAlt: "Jordan Santos", frase: "Role para ver a proposta" },
    },
    {
      type: "FotoInteira",
      props: { id: "foto-abertura", src: "/img/casal-jardim.jpg", alt: "Casal de noivos caminhando de mãos dadas em um jardim", foco: "50% 20%" },
    },
    {
      type: "Pacotes",
      props: {
        id: "pacotes",
        ancora: "pacotes",
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
      props: { id: "foto-noiva", src: "/img/noiva-retrato.jpg", alt: "Retrato em preto e branco da noiva com véu, sentada", foco: "48% 30%" },
    },
    {
      type: "ListaSobreFoto",
      props: {
        id: "adicionais",
        ancora: "adicionais",
        selo: "Adicionais disponíveis",
        titulo: "Adicionais",
        linhas: [
          { nome: "Welcome Wedding", detalhe: "", valor: "R$ 2.790,00" },
          { nome: "Fotógrafo adicional", detalhe: "", valor: "R$ 1.150,00" },
          { nome: "Entrega Expressa em 7 dias", detalhe: "", valor: "R$ 3.500,00" },
          { nome: "Bride Session · Ensaio editorial da Noiva", detalhe: "", valor: "R$ 2.790,00" },
          { nome: "Hora adicional · Cobertura Casamento", detalhe: "", valor: "R$ 1.100,00" },
          { nome: "Cobertura fotográfica Casamento Civil", detalhe: "", valor: "R$ 2.690,00" },
        ],
        foto: "/img/casal-campo.jpg",
        foco: "45% 45%",
        legenda: "",
        corCeu: "#FEFEFE",
        subida: 40,
      },
    },
    {
      type: "Cartoes",
      props: {
        id: "album",
        ancora: "album",
        faixa: "/img/album.jpg",
        faixaAlt: "Álbum de fotografias aberto mostrando as lâminas",
        selo: "Opções de álbum",
        titulo: "Álbum",
        cartoes: [
          { descricao: "Álbum tamanho 30x60 aberto, com 50 páginas (25 lâminas) e 100 imagens", preco: "R$ 5.500,00" },
          { descricao: "Álbum tamanho 20x60 aberto, com 40 páginas (20 lâminas) e 60 imagens", preco: "R$ 3.600,00" },
        ],
      },
    },
    {
      type: "ListaSobreFoto",
      props: {
        id: "prewedding",
        ancora: "prewedding",
        selo: "Ensaio opcional",
        titulo: "Pré Wedding",
        linhas: [
          {
            nome: "Ensaio Pré Wedding",
            detalhe: "1 hora e meia de sessão de fotos digitais · Tratamento de sombra, luz e cor · Galeria on-line",
            valor: "R$ 2.600,00",
          },
        ],
        foto: "/img/prewedding.jpg",
        foco: "50% 35%",
        legenda: "Nosso trabalho depende da verdade de vocês,\nquanto mais reais forem com a gente, mais verdadeira será a foto.",
        corCeu: "#D7E0E1",
        subida: 32,
      },
    },
    {
      type: "TextoComFotos",
      props: {
        id: "entrega",
        ancora: "entrega",
        selo: "",
        titulo: "Entrega",
        paragrafos: [
          { texto: "Cada fotografia recebe um tratamento cuidadoso de luz, cor e contraste, sem manipulações artificiais, preservando a autenticidade e a beleza natural de cada momento vivido." },
          { texto: "Todo o material é registrado com equipamentos profissionais de alta qualidade, e as imagens são disponibilizadas aos noivos por meio de uma galeria online exclusiva, garantindo praticidade e máxima qualidade na entrega." },
        ],
        fotos: [
          { src: "/img/entrega-1.jpg", alt: "Noivos em um corredor clássico", foco: "50% 25%" },
          { src: "/img/entrega-2.jpg", alt: "Noiva em um salão histórico", foco: "50% 28%" },
          { src: "/img/entrega-3.jpg", alt: "Retrato próximo dos noivos", foco: "50% 40%" },
        ],
      },
    },
    {
      type: "Citacao",
      props: {
        id: "citacao",
        texto: "“Com um olhar artístico e foco na autenticidade, entregamos imagens sofisticadas que refletem a essência do seu casamento.”",
        src: "/img/casal-palacio.jpg",
        alt: "Noivos em um palácio, em preto e branco",
        foco: "55% 28%",
      },
    },
    {
      type: "Chamada",
      props: {
        id: "chamada",
        ancora: "fale-conosco",
        selo: "Vamos conversar",
        titulo: "Vamos começar?",
        texto: "Nos conte a data do seu casamento e confirmamos a disponibilidade com você direto pelo WhatsApp.",
        botao: "Chamar no WhatsApp",
      },
    },
    {
      type: "Rodape",
      props: {
        id: "rodape",
        assinatura: "/img/assinatura-offwhite.png",
        assinaturaAlt: "Assinatura de Jordan Santos",
        frase: "Será uma honra eternizar seu momento.\nEstamos à disposição para conversarmos sobre cada detalhe.",
      },
    },
  ],
  zones: {},
};

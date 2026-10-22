/*
  O modelo com que todo "Novo modelo" do Ateliê nasce: uma estrutura curta e
  centralizada em que cada bloco explica como ele mesmo funciona. Quem abre
  entende o que está vendo (a página é feita de blocos, clica e edita do
  lado, a lista da esquerda põe mais) e vai trocando o texto de exemplo pelo
  seu. Página vazia não ensinava nada.

  Os textos de exemplo ficam numa lista porque o Ateliê confere se algum
  deles sobrou antes de publicar (`temTextoDeExemplo`): sem isso, o tutorial
  podia ir pro ar e aparecer pro casal.

  Módulo sem React nem servidor: a API monta o modelo e o editor confere os
  textos com a mesma lista.
*/
import type { DadosSite, RaizProps } from "./blocos";

const T = {
  inicioSelo: "Comece por aqui",
  inicioTitulo: "Seu novo site",
  inicioTexto:
    "Este é um bloco de Título e texto. Clique duas vezes em qualquer texto aqui na página pra escrever direto nele, ou use os campos da direita.\n\n" +
    "Cada parte da página é um bloco. Os blocos ficam na lista da esquerda: clique num deles pra colocar logo abaixo do bloco selecionado, ou arraste até onde quiser.",
  fotoSelo: "Exemplo",
  fotoTitulo: "Foto e texto",
  fotoTexto:
    "Clique no bloco, toque em \"Trocar foto\" e escolha uma das suas fotos ou envie uma nova.\n\n" +
    "Em \"Foco da foto\", marque o ponto que não pode ser cortado, quase sempre o rosto.",
  publicarSelo: "Antes de publicar",
  publicarTitulo: "Confira e ponha no ar",
  publicarTexto:
    "Use \"Ver como fica\" pra ver a página no computador e no celular. Nada disso aparece pra ninguém até você clicar em \"Pôr no ar\".\n\n" +
    "Bloco que não vai usar: selecione e toque na lixeira. O título da página e o contato do estúdio ficam em \"Campos da página\".",
  chamadaTexto: "Este botão abre o WhatsApp do estúdio, com o número e a mensagem que estão nos campos da página.",
};

/* Versões antigas dos textos acima, de modelos criados antes da troca: seguem
   contando como exemplo pro aviso de publicar. */
const ANTIGOS = [
  "Este é um bloco de Título e texto. Clique nele aqui na página e troque este texto pelo seu nos campos da direita.\n\n" +
    "Cada parte da página é um bloco. Os blocos ficam na lista da esquerda: clique num deles pra colocar logo abaixo do bloco selecionado, ou arraste até onde quiser.",
];

/** Os textos de exemplo, pra saber se algum ainda está na página. */
export const TEXTOS_DE_EXEMPLO: readonly string[] = [...Object.values(T), ...ANTIGOS];

/** O aviso da confirmação de publicar quando sobrou texto de exemplo: publicar
    com ele ainda lá é quase sempre esquecimento. */
export const AVISO_TEXTO_DE_EXEMPLO =
  "Ainda tem texto de exemplo nesta página (os que explicam como o Ateliê funciona). Se publicar assim, ele aparece pra quem abrir o site.";

/** true quando algum campo de algum bloco ainda tem um texto de exemplo. */
export function temTextoDeExemplo(dados: DadosSite | null | undefined): boolean {
  const exemplos = new Set(TEXTOS_DE_EXEMPLO);
  return (dados?.content ?? []).some((bloco) =>
    Object.values(bloco.props as Record<string, unknown>).some((v) => typeof v === "string" && exemplos.has(v.trim())),
  );
}

/** O modelo guiado, com o contato que veio do site no ar. */
export function modeloGuiado(raiz: RaizProps): DadosSite {
  const id = (tipo: string) => tipo + "-" + crypto.randomUUID();
  return {
    root: { props: raiz },
    content: [
      {
        type: "TituloTexto",
        props: {
          id: id("TituloTexto"), ancora: "", fundo: "branco", alinhamento: "centro",
          selo: T.inicioSelo, titulo: T.inicioTitulo, texto: T.inicioTexto,
        },
      },
      {
        type: "FotoComTexto",
        props: {
          id: id("FotoComTexto"), ancora: "", fundo: "claro", lado: "esquerda",
          foto: "/img/noiva-retrato.jpg", fotoAlt: "", foco: "48% 30%",
          selo: T.fotoSelo, titulo: T.fotoTitulo, texto: T.fotoTexto, botao: "", link: "",
        },
      },
      {
        type: "TituloTexto",
        props: {
          id: id("TituloTexto"), ancora: "", fundo: "branco", alinhamento: "centro",
          selo: T.publicarSelo, titulo: T.publicarTitulo, texto: T.publicarTexto,
        },
      },
      {
        type: "Chamada",
        props: {
          id: id("Chamada"), ancora: "", selo: "Vamos conversar", titulo: "Vamos começar?",
          texto: T.chamadaTexto, botao: "Chamar no WhatsApp",
        },
      },
    ],
    zones: {},
  };
}

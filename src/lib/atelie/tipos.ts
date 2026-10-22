/*
  Nomes dos blocos do Ateliê, num módulo sem React: a API valida o que chega
  do editor contra esta lista, e o `blocos.tsx` (que importa fonte e
  componente de cliente) não pode entrar numa rota do servidor.
  Bloco novo = entra aqui e no `configAtelie`.

  Seções prontas são blocos que carregam outros: um slot (`blocos`) que já
  entra preenchido com alguns dos blocos de cima. Dentro de uma seção só
  entram blocos, nunca outra seção.
*/
export const TIPOS_DE_BLOCO = [
  "Capa",
  "FotoInteira",
  "Pacotes",
  "ListaSobreFoto",
  "Cartoes",
  "TextoComFotos",
  "Citacao",
  "Chamada",
  "Rodape",
  "TituloTexto",
  "Galeria",
  "FotoComTexto",
  "Espaco",
] as const;

export type TipoDeBloco = (typeof TIPOS_DE_BLOCO)[number];

export const TIPOS_DE_SECAO = [
  "SecaoAbertura",
  "SecaoSobre",
  "SecaoPortfolio",
  "SecaoPacotes",
  "SecaoEntrega",
  "SecaoContato",
] as const;

export type TipoDeSecao = (typeof TIPOS_DE_SECAO)[number];

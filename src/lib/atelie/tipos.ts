/*
  Nomes dos blocos do Ateliê, num módulo sem React: a API valida o que chega
  do editor contra esta lista, e o `blocos.tsx` (que importa fonte e
  componente de cliente) não pode entrar numa rota do servidor.
  Bloco novo = entra aqui e no `configAtelie`.
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

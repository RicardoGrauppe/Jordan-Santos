/*
  Catálogo de produtos. Portado de `catalogo.js` do estúdio do Jordan, que era
  fonte única entre o site e o painel: rótulos divergentes vazavam pro contrato.

  Por item:
    grupo → "pacote" (seleção única) | "adicional" | "album" | "prewedding"
    preco → em reais (número)
    nome  → nome canônico, descritivo: é o que fica salvo no orçamento e no contrato
    curto → rótulo compacto, usado nas linhas do seletor de itens da ficha
*/

export type GrupoItem = "pacote" | "adicional" | "album" | "prewedding";

export type ItemCatalogo = {
  grupo: GrupoItem;
  preco: number;
  nome: string;
  curto: string;
};

export const CATALOGO: Record<string, ItemCatalogo> = {
  eternal: { grupo: "pacote", preco: 18600, nome: "Pacote 01. Eternal", curto: "Pacote 01. Eternal" },
  heritage: { grupo: "pacote", preco: 10850, nome: "Pacote 02. Heritage", curto: "Pacote 02. Heritage" },
  welcome: { grupo: "adicional", preco: 2790, nome: "Welcome Wedding", curto: "Welcome Wedding" },
  fotografo: { grupo: "adicional", preco: 1150, nome: "Fotógrafo adicional", curto: "Fotógrafo adicional" },
  expressa: { grupo: "adicional", preco: 3500, nome: "Entrega Expressa em 7 dias", curto: "Entrega Expressa" },
  bride: { grupo: "adicional", preco: 2790, nome: "Bride Session, ensaio editorial da Noiva", curto: "Bride Session" },
  hora: { grupo: "adicional", preco: 1100, nome: "Hora adicional de cobertura", curto: "Hora adicional" },
  /* a chave "civil" fica como está de propósito: é o id gravado em
     clientes.itens e no snapshot dos contratos. Renomear quebraria o vínculo
     com o que já foi vendido. Só o rótulo mudou. */
  civil: { grupo: "adicional", preco: 2690, nome: "Cobertura fotográfica Casamento Civil", curto: "Casamento Civil" },
  "album-30": { grupo: "album", preco: 5500, nome: "Álbum 30x60 (50 páginas, 100 imagens)", curto: "Álbum 30x60" },
  "album-20": { grupo: "album", preco: 3600, nome: "Álbum 20x60 (40 páginas, 60 imagens)", curto: "Álbum 20x60" },
  prewedding: { grupo: "prewedding", preco: 2600, nome: "Ensaio Pré Wedding", curto: "Ensaio Pré Wedding" },
};

/* ordem usada no seletor de itens da ficha do cliente */
export const PACOTES: readonly string[] = ["eternal", "heritage"];
export const ADICIONAIS: readonly string[] = [
  "welcome", "fotografo", "expressa", "bride", "hora", "civil", "album-30", "album-20", "prewedding",
];

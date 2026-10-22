/*
  Produtos e serviços do fotógrafo (tabela `produtos`, editada em
  /painel/produtos). Substitui o catálogo fixo de lib/catalogo.ts.

  Serve aos dois lados: a página que edita o catálogo e quem escolhe itens pro
  cliente (o cartão "Pacote e adicionais" do editor do contrato). Por isso não
  importa nada de servidor.
*/

export type TipoProduto = "pacote" | "adicional";

export type Produto = {
  id: string;
  tipo: TipoProduto;
  /** nome completo: é o que vai pro contrato */
  nome: string;
  /** rótulo curto das listas */
  curto: string;
  preco: number;
  /** ids que este pacote já traz: com ele escolhido, somem da lista */
  inclui: string[];
  ativo: boolean;
  ordem: number;
};

/** item gravado no cliente: o valor é o do momento da escolha */
export type ItemEscolhido = { id: string; nome: string; valor: number; tipo?: TipoProduto };

export const ROTULO_TIPO: Record<TipoProduto, string> = {
  pacote: "Pacote",
  adicional: "Adicional",
};

/** o PostgREST devolve numeric como string; aqui vira número de novo */
export function normalizarProduto(p: Record<string, unknown>): Produto {
  return {
    id: String(p.id),
    tipo: p.tipo === "pacote" ? "pacote" : "adicional",
    nome: String(p.nome ?? ""),
    curto: String(p.curto ?? p.nome ?? ""),
    preco: Number(p.preco) || 0,
    inclui: Array.isArray(p.inclui) ? p.inclui.map(String) : [],
    ativo: p.ativo !== false,
    ordem: Number(p.ordem) || 0,
  };
}

/** o item que o cliente guarda ao escolher um produto, com o preço de tabela */
export function itemDoProduto(p: Produto): ItemEscolhido {
  return { id: p.id, nome: p.nome, valor: p.preco, tipo: p.tipo };
}

/**
 * Marca ou desmarca um produto na lista do cliente, com as regras do
 * catálogo: pacote é escolha única (trocar de pacote tira o anterior) e o que
 * o pacote escolhido já inclui sai da lista.
 */
export function alternarItem(itens: ItemEscolhido[], produto: Produto, catalogo: Produto[]): ItemEscolhido[] {
  const jaTem = itens.some((i) => i.id === produto.id);
  if (jaTem) return itens.filter((i) => i.id !== produto.id);
  const ehPacote = (id: string) => (catalogo.find((p) => p.id === id)?.tipo ?? "adicional") === "pacote";
  let novos = produto.tipo === "pacote" ? itens.filter((i) => !ehPacote(i.id) && i.tipo !== "pacote") : [...itens];
  if (produto.tipo === "pacote") {
    novos = novos.filter((i) => !produto.inclui.includes(i.id));
    return [itemDoProduto(produto), ...novos];
  }
  return [...novos, itemDoProduto(produto)];
}

/** ids escondidos pela escolha atual (o que o pacote escolhido já inclui) */
export function incluidosPelaEscolha(itens: ItemEscolhido[], catalogo: Produto[]): Set<string> {
  const fora = new Set<string>();
  for (const i of itens) {
    const p = catalogo.find((x) => x.id === i.id);
    if (p?.tipo === "pacote") p.inclui.forEach((id) => fora.add(id));
  }
  return fora;
}

/** chave estável a partir do nome ("Álbum 30x60" → "album-30x60-k3f9") */
export function chaveNova(nome: string): string {
  const base = nome
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
    .slice(0, 32) || "produto";
  return base + "-" + Math.random().toString(36).slice(2, 6);
}

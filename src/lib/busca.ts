/*
  Busca de casal do cabeçalho. Portada de `filtrarClientes` / `garantirClientes`
  do estudio.html do Jordan.

  Herdado de lá: a busca é independente da tela que está aberta. Ela não troca
  o filtro da lista de clientes nem navega sozinha; só mostra os achados e
  espera você escolher um.

  Os dois lugares que buscam (campo do topo no computador e tela cheia no
  celular) filtram o MESMO cache em memória, sem uma ida ao servidor por tecla
  digitada. O cache tem validade curta porque o painel é uma página só: sem
  isso, um cliente cadastrado agora ficaria invisível na busca até você
  recarregar a página inteira.
*/
import { api, type ClienteLista, type RespostaLista } from "@/lib/painel";

const VALIDADE_MS = 60_000;

let cache: ClienteLista[] | null = null;
let carregadoEm = 0;
let emVoo: Promise<ClienteLista[]> | null = null;

/** Lista de clientes pra busca, do cache quando ainda vale. Lista vazia se falhar. */
export function garantirClientes(): Promise<ClienteLista[]> {
  if (cache && Date.now() - carregadoEm < VALIDADE_MS) return Promise.resolve(cache);
  if (emVoo) return emVoo;
  emVoo = api<RespostaLista>("/api/estudio?lista=1")
    .then((r) => {
      cache = r.clientes ?? [];
      carregadoEm = Date.now();
      return cache;
    })
    .catch(() => cache ?? [])
    .finally(() => { emVoo = null; });
  return emVoo;
}

/** Quem já tem a lista fresca na mão aproveita e abastece o cache. */
export function abastecerCache(clientes: ClienteLista[]): void {
  cache = clientes;
  carregadoEm = Date.now();
}

/**
 * Filtra por nome do casal. Termo vazio devolve nada (a tela mostra o convite
 * a digitar, não a lista inteira). Arquivado fica de fora: quem procura um
 * casal arquivado vai na lista de clientes e escolhe o status.
 */
export function filtrarClientes(clientes: ClienteLista[], termo: string): ClienteLista[] {
  const t = termo.trim().toLowerCase();
  if (!t) return [];
  return clientes.filter((c) => {
    if (c.status === "arquivado") return false;
    return ((c.noivo ?? "") + " " + (c.noiva ?? "")).toLowerCase().includes(t);
  });
}

/*
  Avisos do sino. Portado de `montarNotificacoes` / `renderNotificacoes` /
  `carregarNotificacoes` do estudio.html do Jordan.

  A lista não é uma tabela no banco: ela é DERIVADA da lista de clientes que o
  painel já busca. Um aviso existe enquanto o fato existir (cliente novo pelo
  site, contrato esperando assinatura, casamento chegando), e some sozinho
  quando o fato passa. Isso também é o motivo de cada aviso carregar uma
  `chave` estável: é ela, e não o texto exibido, que guarda o "já vi isto".

  Decisões herdadas de lá:
  - A chave do prazo IGNORA a contagem regressiva, senão o mesmo casamento
    viraria aviso novo todo santo dia.
  - A chave do contrato INCLUI o status: quando o casal abre o link, isso é
    novidade de verdade e o aviso volta a contar, mesmo já tendo sido lido
    enquanto estava só "enviado".
  - O título diz o que aconteceu e o sub diz de quem. Telefone fica de fora.

  Onde o estado mora: no servidor (chave `avisos` de /api/config) E no
  localStorage. O servidor é quem faz o "já vi" acompanhar você do celular pro
  computador; o localStorage é cache, pra a lista já nascer certa antes da
  resposta chegar e continuar funcionando com a rede fora do ar.
*/
import { api, dataCurta, nomeCasal, type ClienteLista, type RespostaLista } from "@/lib/painel";

export type TipoAviso = "proposta" | "assinado" | "contrato" | "prazo";

export type Aviso = {
  tipo: TipoAviso;
  /** ordem de exibição: novos clientes primeiro, prazos por último */
  ordem: number;
  /** cliente que o aviso abre */
  cid: string;
  /** identidade estável do aviso, usada pelo "já vi" e pelo "apaguei" */
  chave: string;
  titulo: string;
  sub: string;
};

/** Dias até a data (0 = hoje, negativo = passou). null quando não dá pra saber. */
export function diasAte(iso?: string | null): number | null {
  if (!iso) return null;
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const d = new Date(iso + "T00:00:00");
  if (isNaN(d.getTime())) return null;
  return Math.round((d.getTime() - hoje.getTime()) / 86400000);
}

export function montarNotificacoes(clientes: ClienteLista[] | null | undefined): Aviso[] {
  const lista: Aviso[] = [];
  const todos = clientes ?? [];

  todos.forEach((c) => {
    if (c.status === "novo" && c.origem === "Orçamento do site") {
      lista.push({
        tipo: "proposta", ordem: 0, cid: c.id, chave: "proposta|" + c.id,
        titulo: "Novo cliente", sub: nomeCasal(c),
      });
    }
  });

  todos.forEach((c) => {
    if (c.contrato_status === "assinado") {
      lista.push({
        tipo: "assinado", ordem: 1, cid: c.id, chave: "assinado|" + c.id,
        titulo: "Contrato assinado", sub: nomeCasal(c),
      });
    } else if (c.contrato_status === "enviado" || c.contrato_status === "visualizado") {
      const viu = c.contrato_status === "visualizado";
      lista.push({
        tipo: "contrato", ordem: 2, cid: c.id,
        chave: "contrato|" + c.id + "|" + c.contrato_status,
        titulo: viu ? "Casal abriu o contrato" : "Aguardando assinatura",
        sub: nomeCasal(c),
      });
    }
  });

  todos.forEach((c) => {
    if (c.status === "arquivado" || !c.data_evento) return;
    const d = diasAte(c.data_evento);
    if (d == null || d < 0 || d > 30) return;
    const quando = d === 0 ? "Casamento é hoje"
      : d === 1 ? "Casamento é amanhã"
      : "Casamento em " + d + " dias";
    lista.push({
      tipo: "prazo", ordem: 3 + d / 1000, cid: c.id, chave: "prazo|" + c.id,
      titulo: quando, sub: nomeCasal(c) + " · " + dataCurta(c.data_evento),
    });
  });

  return lista.sort((a, b) => a.ordem - b.ordem);
}

/* ---------- filtros (pills da tela cheia do celular) ---------- */

export type FiltroAviso = "todas" | "contratos" | "clientes";

export const FILTROS_AVISO: { valor: FiltroAviso; rotulo: string }[] = [
  { valor: "todas", rotulo: "Todas" },
  { valor: "contratos", rotulo: "Contratos" },
  { valor: "clientes", rotulo: "Clientes" },
];

export function passaFiltro(n: Aviso, filtro: FiltroAviso): boolean {
  if (filtro === "contratos") return n.tipo === "assinado" || n.tipo === "contrato";
  if (filtro === "clientes") return n.tipo === "proposta" || n.tipo === "prazo";
  return true;
}

/* ---------- "já vi" e "apaguei" ---------- */

export type EstadoAvisos = { vistos: string[]; apagados: string[] };

export const AVISOS_VAZIO: EstadoAvisos = { vistos: [], apagados: [] };

const CHAVE_LOCAL = "JSF_AVISOS";
/* mesmo teto da rota: a lista é só de chaves, mas não pode crescer pra sempre */
const MAX_CHAVES = 300;

function textos(valor: unknown): string[] {
  return Array.isArray(valor) ? valor.filter((k): k is string => typeof k === "string" && !!k) : [];
}

function unir(a: string[], b: string[]): string[] {
  return Array.from(new Set([...a, ...b])).slice(-MAX_CHAVES);
}

export function lerAvisosLocal(): EstadoAvisos {
  try {
    const bruto = JSON.parse(localStorage.getItem(CHAVE_LOCAL) ?? "{}") as Record<string, unknown>;
    return { vistos: textos(bruto.vistos), apagados: textos(bruto.apagados) };
  } catch { return { vistos: [], apagados: [] }; }
}

function gravarAvisosLocal(estado: EstadoAvisos): void {
  try { localStorage.setItem(CHAVE_LOCAL, JSON.stringify(estado)); } catch { /* storage bloqueado */ }
}

type RespostaConfig = { avisos?: { vistos?: unknown; apagados?: unknown } | null };

/**
 * Estado inicial: cache local primeiro, servidor por cima quando responder.
 *
 * Nos VISTOS o servidor manda: foi lá que "marcar como não lida" gravou, e um
 * cache antigo de outro aparelho não pode ressuscitar o aviso como lido.
 * Nos APAGADOS a conta é união: apagar é uma decisão sua, e nenhum dos dois
 * lados tem o direito de trazer de volta o que o outro jogou fora.
 *
 * Servidor fora do ar devolve só o local: pior caso o contador volta a
 * aparecer, nunca um erro na cara de quem está trabalhando.
 */
export async function carregarAvisos(): Promise<EstadoAvisos> {
  const local = lerAvisosLocal();
  try {
    const cfg = await api<RespostaConfig>("/api/config");
    const a = cfg.avisos ?? {};
    const juntos: EstadoAvisos = {
      vistos: textos(a.vistos),
      apagados: unir(local.apagados, textos(a.apagados)),
    };
    gravarAvisosLocal(juntos);
    return juntos;
  } catch {
    return local;
  }
}

/** Grava nos dois lugares. O servidor é best-effort: falhou, o local segue valendo. */
export function gravarAvisos(estado: EstadoAvisos): void {
  gravarAvisosLocal(estado);
  api("/api/config", { acao: "salvar-avisos", avisos: estado }).catch(() => { /* melhor esforço */ });
}

/* ---------- lista de clientes que alimenta os avisos ---------- */

/** Lista fresca do servidor. null quando a busca falhou (inclusive sessão expirada). */
export async function buscarClientesDosAvisos(): Promise<ClienteLista[] | null> {
  try {
    const r = await api<RespostaLista>("/api/estudio?lista=1");
    return r.clientes ?? [];
  } catch {
    return null;
  }
}

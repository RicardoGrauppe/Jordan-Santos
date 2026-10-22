/*
  Helpers compartilhados pelas telas do painel (Home, lista de clientes e
  pendências). Portado do bloco de funções soltas do estudio.html. Roda no
  browser: nada aqui toca banco nem segredo.
*/

/* ---------- API do painel ---------- */

/** Erro que a rota devolve quando a sessão expirou: quem chama não mostra
 *  mensagem, a página volta pra entrada. */
export const ERRO_SESSAO = "sessao";

export async function api<T = unknown>(url: string, corpo?: unknown): Promise<T> {
  const r = await fetch(url, corpo
    ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(corpo) }
    : undefined);
  if (r.status === 401) throw new Error(ERRO_SESSAO);
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((j as { erro?: string }).erro ?? "falha");
  return j as T;
}

export function esperaMin(ms?: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms ?? 0));
}

/* ---------- linha da lista (GET /api/estudio?lista=1) ---------- */

export type StatusCliente = "novo" | "confirmado" | "realizado" | "arquivado";

export type ClienteLista = {
  id: string;
  noivo?: string | null;
  noiva?: string | null;
  data_evento?: string | null;
  status?: StatusCliente | string | null;
  total?: number | string | null;
  tel_noivo?: string | null;
  origem?: string | null;
  local_evento?: string | null;
  /** quando o cliente entrou (ISO); usado pela ordem de chegada do sino */
  criado_em?: string | null;
  /** status do último contrato, que a lista já traz; null sem contrato */
  contrato_status?: string | null;
  /** quando o contrato entrou no status acima (ISO); null sem contrato */
  contrato_em?: string | null;
  /** documento na Autentique; é pra lá que "abrir contrato" leva */
  contrato_autentique_id?: string | null;
};

export type RespostaLista = { clientes?: ClienteLista[] };

export const ROTULO_STATUS: Record<string, string> = {
  novo: "Novo", confirmado: "Confirmado", realizado: "Realizado", arquivado: "Arquivado",
};

/**
 * Documento no painel da Autentique. É pra onde o "Abrir na Autentique" leva:
 * lá estão o histórico, a trilha de auditoria e a via final na fonte.
 * Abre em guia nova e com login próprio (a sessão é do navegador do
 * fotógrafo, não nossa).
 */
export function urlNoAutentique(autentiqueId: string): string {
  return "https://painel.autentique.com.br/documentos/" + encodeURIComponent(autentiqueId);
}

/** Rota da revisão do contrato de um cliente. */
export function rotaDoContrato(clienteId: string): string {
  return "/painel/clientes/" + encodeURIComponent(clienteId) + "/contrato";
}

/**
 * Pra ONDE "abrir o contrato" leva, de qualquer lugar do painel.
 *
 * Decisão do Ricardo em 22/10/2026: contrato que já foi pra Autentique abre
 * SEMPRE na página dela, antes e depois de assinado. É a mesma página que o
 * casal vê, e é onde moram assinar, conferir, o histórico e o "Baixar
 * arquivo". Enquanto é rascunho (ainda não existe documento lá) abre a nossa
 * revisão, que é onde o contrato é montado e editado.
 */
export function rotaParaAbrirContrato(
  c: { id: string; contrato_autentique_id?: string | null },
): string {
  return c.contrato_autentique_id ? urlNoAutentique(c.contrato_autentique_id) : rotaDoContrato(c.id);
}

/**
 * Abre o contrato numa GUIA NOVA, de onde quer que se clique.
 *
 * É documento: quem abre quase sempre quer conferir sem perder a ficha que
 * estava preenchendo, e o botão da timeline já mostrava o ícone de link
 * externo prometendo isso.
 *
 * Sem `noopener` de propósito: ele faz o `window.open` devolver `null`, e aqui
 * a guia precisa ser devolvida pra quem gera o contrato ANTES de ter o
 * endereço (ver `reservarGuia`).
 */
export function abrirContratoEmNovaGuia(
  clienteId: string,
  autentiqueId?: string | null,
): void {
  window.open(rotaParaAbrirContrato({ id: clienteId, contrato_autentique_id: autentiqueId }), "_blank");
}

/**
 * Guia vazia aberta AGORA, no gesto do clique, pra ser preenchida depois que
 * uma chamada ao servidor terminar.
 *
 * Sem isto o navegador bloqueia: `window.open` só passa enquanto a ativação do
 * usuário está viva, e gerar o contrato leva uma ida ao servidor no meio.
 * Quem chama preenche com `guia.location.href` no sucesso e fecha no erro —
 * deixar uma guia em branco aberta depois de uma falha é pior que não abrir.
 */
export function reservarGuia(): Window | null {
  return window.open("", "_blank");
}

export function nomeCasal(c: Pick<ClienteLista, "noivo" | "noiva">): string {
  return [c.noivo, c.noiva].filter(Boolean).join(" & ") || "(sem nome)";
}

export function iniciais(a?: string | null, b?: string | null): string {
  let ini = "";
  if (a && a.trim()) ini += a.trim()[0];
  if (b && b.trim()) ini += b.trim()[0];
  return (ini || "?").toUpperCase();
}

const MESES_ABREV = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** "2027-03-10" → "10 mar 2027"; sem data → "a definir" */
export function dataCurta(iso?: string | null): string {
  if (!iso) return "a definir";
  const p = iso.split("-");
  const mes = MESES_ABREV[parseInt(p[1], 10) - 1];
  if (!mes || !p[2]) return iso;
  return parseInt(p[2], 10) + " " + mes + " " + p[0];
}

/** Eventos de hoje em diante, do mais próximo pro mais distante. Arquivado fica de fora. */
export function proximosEventos(clientes: ClienteLista[]): ClienteLista[] {
  const hoje = new Date().toISOString().slice(0, 10);
  return clientes
    .filter((c) => !!c.data_evento && c.data_evento >= hoje && c.status !== "arquivado")
    .sort((a, b) => ((a.data_evento ?? "") < (b.data_evento ?? "") ? -1 : 1));
}

/* ---------- pendências (precisa de atenção) ----------
   Usa o contrato_status que a lista já traz. Quatro frentes de trabalho, na
   ordem em que aparecem na tela: cliente novo que ainda não foi respondido,
   rascunho ainda não enviado, casal ainda não assinou, e cliente confirmado
   sem contrato nenhum. Arquivado e realizado não contam.

   O primeiro grupo entrou em 2026-09-17, a pedido do Ricardo. Antes a tela só
   enxergava contrato, então um lead que caiu pelo site hoje de manhã não
   aparecia em lugar nenhum além do sino — e é a pendência que mais custa
   caro, porque é dinheiro esperando resposta. A regra é "novo e sem contrato
   nenhum": quem já tem rascunho ou contrato enviado aparece no grupo do
   contrato, senão o mesmo cliente contaria duas vezes. */

export type GrupoPendencia = "novo" | "rascunho" | "aguardando" | "semContrato";
export type Pendencias = Record<GrupoPendencia, ClienteLista[]>;

/* Pendências "limpas" pelo fotógrafo. Somem da lista até algo mudar no
   contrato: a chave inclui o status, então mudar de estado (casal assina,
   rascunho é enviado) gera chave nova e a pendência volta a aparecer.
   Fica no localStorage, como no original: é só um "já vi". */
const CHAVE_PEND_LIMPAS = "JSF_PEND_LIMPAS";

export function lerLimpas(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(CHAVE_PEND_LIMPAS) ?? "[]") as unknown;
    return Array.isArray(v) ? v.filter((k): k is string => typeof k === "string") : [];
  } catch { return []; }
}

export function gravarLimpas(lista: string[]): void {
  try { localStorage.setItem(CHAVE_PEND_LIMPAS, JSON.stringify(lista)); } catch { /* storage bloqueado */ }
}

export function chavePend(grupo: GrupoPendencia, c: ClienteLista): string {
  return grupo + "|" + c.id + "|" + (c.contrato_status || "nenhum");
}

/** `limpasLista` é opcional: sem ela, lê o localStorage na hora. Quem precisa
 *  reagir a "limpou agora" (a página de pendências) passa a lista como estado. */
export function pendenciasDe(clientes: ClienteLista[], limpasLista?: string[]): Pendencias {
  const g: Pendencias = { novo: [], rascunho: [], aguardando: [], semContrato: [] };
  const limpas = new Set(limpasLista ?? lerLimpas());
  clientes.forEach((c) => {
    if (c.status === "arquivado" || c.status === "realizado") return;
    const cs = c.contrato_status;
    if (!cs && c.status === "novo") { if (!limpas.has(chavePend("novo", c))) g.novo.push(c); }
    else if (cs === "rascunho") { if (!limpas.has(chavePend("rascunho", c))) g.rascunho.push(c); }
    else if (cs === "enviado" || cs === "visualizado") { if (!limpas.has(chavePend("aguardando", c))) g.aguardando.push(c); }
    else if ((!cs || cs === "cancelado") && c.status === "confirmado") { if (!limpas.has(chavePend("semContrato", c))) g.semContrato.push(c); }
  });
  /* cliente novo é fila de resposta: o último que chegou é o que está
     esperando há menos tempo, mas é também o que ainda dá pra impressionar
     respondendo rápido. Mais recente primeiro, igual ao sino. */
  g.novo.sort((a, b) => (b.criado_em || "").localeCompare(a.criado_em || ""));
  return g;
}

export function totalPendencias(g: Pendencias): number {
  return g.novo.length + g.rascunho.length + g.aguardando.length + g.semContrato.length;
}

/* ---------- saudação e clima ---------- */

export type Saudacao = { texto: string; emoji: string; subs: string[] };

/** Pela hora do dispositivo (nunca UTC): 5 a 11h manhã, 12 a 17h tarde, resto noite. */
export function saudacaoDaHora(): Saudacao {
  const h = new Date().getHours();
  if (h < 5) return { texto: "Boa madrugada", emoji: "🌙",
    subs: ["Enquanto o mundo dorme, você constrói.", "Foco silencioso rende dobrado.", "Bora deixar tudo pronto antes do sol nascer."] };
  if (h < 12) return { texto: "Bom dia", emoji: "☀️",
    subs: ["Bora fazer um dia bonito acontecer.", "Café na mão e vamos que vamos.", "Novo dia, novas fotos."] };
  if (h < 18) return { texto: "Boa tarde", emoji: "🌤️",
    subs: ["Tarde produtiva pela frente.", "Ritmo firme até o fim do dia.", "Bora tocar o que tem pra hoje."] };
  return { texto: "Boa noite", emoji: "🌆",
    subs: ["Bora fechar o dia com chave de ouro.", "Ainda dá tempo de destravar mais uma.", "Última milha do dia, vai com tudo."] };
}

export function climaInfo(codigo: number, ehDia: boolean): { emoji: string; desc: string } {
  const c = Number(codigo);
  if (c === 0) return { emoji: ehDia ? "☀️" : "🌙", desc: "Céu limpo" };
  if (c === 1) return { emoji: ehDia ? "🌤️" : "🌙", desc: "Predomínio de sol" };
  if (c === 2) return { emoji: "⛅", desc: "Parcialmente nublado" };
  if (c === 3) return { emoji: "☁️", desc: "Nublado" };
  if (c === 45 || c === 48) return { emoji: "🌫️", desc: "Névoa" };
  if (c >= 51 && c <= 57) return { emoji: "🌦️", desc: "Garoa" };
  if (c >= 61 && c <= 67) return { emoji: "🌧️", desc: "Chuva" };
  if (c >= 71 && c <= 77) return { emoji: "🌨️", desc: "Neve" };
  if (c >= 80 && c <= 82) return { emoji: "🌦️", desc: "Pancadas de chuva" };
  if (c === 85 || c === 86) return { emoji: "🌨️", desc: "Neve" };
  if (c >= 95) return { emoji: "⛈️", desc: "Tempestade" };
  return { emoji: "🌡️", desc: "Tempo instável" };
}

export type Localizacao = { cidade?: string; nome?: string; lat: number; lon: number };
export type Config = {
  localizacao?: Localizacao | null;
  perfil?: { nome?: string; username?: string } | null;
};

export type ClimaAgora = { emoji: string; desc: string; temp: number; min: number | null; max: number | null };

type RespostaMeteo = {
  current?: { temperature_2m: number; weather_code: number; is_day: number };
  daily?: { temperature_2m_max?: number[]; temperature_2m_min?: number[] };
};

/** Tempo agora na Open-Meteo (grátis, sem chave). null sem localização ou falha. */
export async function buscarClima(loc: Localizacao | null | undefined): Promise<ClimaAgora | null> {
  if (!loc || !isFinite(Number(loc.lat)) || !isFinite(Number(loc.lon))) return null;
  try {
    const u = "https://api.open-meteo.com/v1/forecast?latitude=" + loc.lat + "&longitude=" + loc.lon +
      "&current=temperature_2m,weather_code,is_day&daily=temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=1";
    const r = await fetch(u);
    if (!r.ok) return null;
    const d = (await r.json()) as RespostaMeteo;
    if (!d.current) return null;
    const info = climaInfo(d.current.weather_code, d.current.is_day === 1);
    return {
      emoji: info.emoji,
      desc: info.desc,
      temp: Math.round(d.current.temperature_2m),
      max: d.daily?.temperature_2m_max?.[0] != null ? Math.round(d.daily.temperature_2m_max[0]) : null,
      min: d.daily?.temperature_2m_min?.[0] != null ? Math.round(d.daily.temperature_2m_min[0]) : null,
    };
  } catch { return null; }
}

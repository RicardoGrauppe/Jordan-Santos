/*
  Utilitários compartilhados pelas rotas. Sem estado e sem dado de cliente em
  log. Portado de `api/_lib/util.js`.
*/

/** Corta e limpa uma string; null quando não é string útil. */
export function textoCurto(valor: unknown, max = 200): string | null {
  return valor && typeof valor === "string" ? valor.slice(0, max).trim() : null;
}

export function normalizarCpf(s: unknown): string {
  return String(s ?? "").replace(/\D/g, "");
}

export function esperar(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Throttle best-effort em memória. Zera a cada cold start, e tudo bem: serve
 * pra atrapalhar força bruta, não pra ser contabilidade exata.
 */
export function criarLimite(janelaMs: number, max: number) {
  const tentativas = new Map<string, { n: number; desde: number }>();
  return function estourou(chave: string): boolean {
    const agora = Date.now();
    const t = tentativas.get(chave) ?? { n: 0, desde: agora };
    if (agora - t.desde > janelaMs) { t.n = 0; t.desde = agora; }
    t.n++;
    tentativas.set(chave, t);
    return t.n > max;
  };
}

/**
 * IP do cliente pelos cabeçalhos de proxy.
 *
 * Devolve null (não "?") quando não dá pra saber, que é o caso do dev local.
 * Isso importa porque o IP entra na trilha de auditoria da assinatura e o
 * contrato afirma que ele fica registrado: campo vazio é honesto, um "?"
 * gravado finge ser um valor que ninguém tem. Quem usa como chave de throttle
 * precisa tratar o null.
 */
export function ipDe(headers: Headers): string | null {
  const encaminhado = (headers.get("x-forwarded-for") ?? "").split(",")[0].trim();
  return encaminhado || (headers.get("x-real-ip") ?? "").trim() || null;
}

/** Mantém só as colunas da whitelist; "" vira null. */
export function filtrarCampos<T extends Record<string, unknown>>(
  campos: readonly string[],
  origem: Record<string, unknown>,
  ajustar?: (limpo: Record<string, unknown>) => void,
): T {
  const limpo: Record<string, unknown> = {};
  campos.forEach((c) => {
    if (origem[c] !== undefined) limpo[c] = origem[c] === "" ? null : origem[c];
  });
  ajustar?.(limpo);
  return limpo as T;
}

/** Formata data ISO no padrão brasileiro, tolerando valor ausente ou inválido. */
export function fmtData(iso: string | null | undefined): string {
  if (!iso) return "";
  try { return new Date(iso).toLocaleDateString("pt-BR"); } catch { return ""; }
}

export function moeda(valor: number | null | undefined): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(valor) || 0);
}

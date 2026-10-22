/*
  Tipos e utilitários da ficha do cliente (tela /painel/clientes/[id]).
  Portado do bloco de máscaras e moeda do estudio.html.

  Três pontas precisam combinar, senão o dado sai torto:
    1. ao digitar   → máscara ao vivo;
    2. ao exibir    → o banco guarda CPF/CEP só com dígitos, então formata na
                      hora de mostrar;
    3. ao salvar    → volta pra só dígitos. Isto NÃO é cosmético: o índice
                      único do banco é (cpf_noivo, data_evento), e salvar
                      "123.456.789-01" criaria um segundo registro pro mesmo casal.
*/

export type ItemContrato = { id: string; nome: string; valor: number };

export type StatusContrato = "rascunho" | "enviado" | "visualizado" | "assinado" | "cancelado";

/** Campos de texto da ficha, na mesma chave que a coluna do banco. */
export const CAMPOS_FICHA = [
  "noivo", "cpf_noivo", "tel_noivo", "noiva", "cpf_noiva", "tel_noiva", "email",
  "data_evento", "horario", "local_evento",
  "cep", "endereco", "numero", "complemento", "bairro", "cidade", "estado",
  "origem", "observacoes", "total", "entrada",
] as const;

export type CampoFicha = (typeof CAMPOS_FICHA)[number];
export type Ficha = Record<CampoFicha, string>;

export const FICHA_VAZIA: Ficha = CAMPOS_FICHA.reduce((acc, c) => {
  acc[c] = "";
  return acc;
}, {} as Ficha);

export type Cliente = Partial<Record<CampoFicha, string | number | null>> & {
  id: string;
  status?: string | null;
  itens?: ItemContrato[] | null;
};

export type Contrato = {
  id: string;
  token?: string | null;
  status: StatusContrato;
  versao?: number | null;
  criado_em?: string | null;
  enviado_em?: string | null;
  visualizado_em?: string | null;
  assinado_em?: string | null;
  expira_em?: string | null;
  jordan_confirmado_em?: string | null;
  jordan_assinatura_nome?: string | null;
  signatario_nome?: string | null;
  signatario_cpf?: string | null;
  signatario_email?: string | null;
  assinante_ip?: string | null;
  assinante_ua?: string | null;
  doc_sha256?: string | null;
  /* vínculo com o documento na Autentique (desde 21/10/2026) */
  autentique_id?: string | null;
  autentique_link?: string | null;
  recusado_em?: string | null;
  /* calculados no servidor (22/10/2026): tem texto editável e não foi
     assinado; e o que está na Autentique é anterior à última edição */
  editavel?: boolean;
  alterado_desde_envio?: boolean;
  template_json_snapshot?: unknown;
  /* modelo que deu origem ao texto (o texto em si é a cópia acima) */
  template_id?: string | null;
  template_nome?: string | null;
  aceite_texto?: string | null;
  aceite_em?: string | null;
  verificado_em?: string | null;
  verificacao_metodo?: string | null;
};

/* ---------- máscaras ---------- */

export function soDigitos(v: unknown): string {
  return String(v ?? "").replace(/\D/g, "");
}

/** `padrao` usa "9" pra cada dígito, o resto é literal: "999.999.999-99". */
export function mascarar(valor: unknown, padrao: string): string {
  const digitos = soDigitos(valor);
  let out = "";
  let di = 0;
  for (let i = 0; i < padrao.length && di < digitos.length; i++) {
    if (padrao[i] === "9") { out += digitos[di]; di++; }
    else out += padrao[i];
  }
  return out;
}

/** Só formata número nacional. Valor que já vem com DDI ("+55 45...") fica intacto. */
export function formatarTelefone(v: unknown): string {
  const s = String(v ?? "");
  if (s.indexOf("+") !== -1) return s;
  const d = soDigitos(s).slice(0, 11);
  if (!d.length) return "";
  if (d.length <= 2) return "(" + d;
  const ddd = d.slice(0, 2), resto = d.slice(2);
  if (d.length <= 10) return "(" + ddd + ") " + resto.slice(0, 4) + (resto.length > 4 ? "-" + resto.slice(4) : "");
  return "(" + ddd + ") " + resto.slice(0, 5) + "-" + resto.slice(5);
}

export const MASCARAS: Partial<Record<CampoFicha, (v: string) => string>> = {
  cpf_noivo: (v) => mascarar(v, "999.999.999-99"),
  cpf_noiva: (v) => mascarar(v, "999.999.999-99"),
  cep: (v) => mascarar(v, "99999-999"),
  tel_noivo: formatarTelefone,
  tel_noiva: formatarTelefone,
};

/** O que volta pro backend só com dígitos (telefone não: guarda o DDI). */
export const SO_DIGITOS_AO_SALVAR: readonly CampoFicha[] = ["cpf_noivo", "cpf_noiva", "cep"];

/* ---------- dinheiro ---------- */

/** 18600 → "18.600,00" */
export function formatarMoeda(n: unknown): string {
  const num = Number(n);
  return isFinite(num) ? num.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "";
}

/** "18.600,00" → 18600; null quando não é número. */
export function parseMoeda(v: unknown): number | null {
  if (v == null || v === "") return null;
  const num = parseFloat(String(v).replace(/\./g, "").replace(",", "."));
  return isFinite(num) ? num : null;
}

/* ---------- datas ---------- */

/** "15/09/2026 às 14:32" */
export function fmtDataHora(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR") + " às " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

/** Dias entre hoje e a data (YYYY-MM-DD); negativo quando já passou. */
export function diasAte(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const d = new Date(iso + "T00:00:00");
  if (isNaN(d.getTime())) return null;
  return Math.round((d.getTime() - hoje.getTime()) / 86400000);
}

/* ---------- área de transferência ---------- */

/** Cópia sem depender de HTTPS: navigator.clipboard só existe em contexto seguro. */
export function copiaLegado(texto: string): boolean {
  if (typeof document === "undefined") return false;
  const ta = document.createElement("textarea");
  ta.value = texto;
  ta.setAttribute("aria-hidden", "true");
  ta.style.cssText = "position:fixed;top:0;left:0;width:1px;height:1px;padding:0;border:0;opacity:0";
  document.body.appendChild(ta);
  const focoAnterior = document.activeElement as HTMLElement | null;
  ta.focus({ preventScroll: true });
  ta.select();
  ta.setSelectionRange(0, texto.length);
  let copiou = false;
  try { copiou = document.execCommand("copy"); } catch { copiou = false; }
  document.body.removeChild(ta);
  focoAnterior?.focus?.({ preventScroll: true });
  return copiou;
}

/** Tenta a API moderna e cai pro execCommand. Resolve com true quando copiou. */
export async function copiarTexto(texto: string): Promise<boolean> {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    try { await navigator.clipboard.writeText(texto); return true; } catch { /* cai pro legado */ }
  }
  return copiaLegado(texto);
}

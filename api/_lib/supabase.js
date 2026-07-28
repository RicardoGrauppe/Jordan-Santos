/*
  Helpers de acesso ao Supabase (PostgREST + Auth) com a SERVICE ROLE KEY.
  Só rodam no servidor (Vercel Functions) — a chave nunca chega ao browser.
  Logs carregam apenas status HTTP, nunca corpo de resposta (PII).
*/

const BASE = process.env.SUPABASE_URL;
const CHAVE = process.env.SUPABASE_SERVICE_ROLE_KEY;

export function supabaseConfigurado() {
  return Boolean(BASE && CHAVE);
}

function cabecalhos(temCorpo, extra) {
  return {
    apikey: CHAVE,
    Authorization: "Bearer " + CHAVE,
    ...(temCorpo ? { "Content-Type": "application/json" } : {}),
    ...extra
  };
}

/* PostgREST: rest("clientes?id=eq.<uuid>&select=*", {method, body, prefer}) */
export async function rest(caminho, { method = "GET", body, prefer } = {}) {
  const r = await fetch(BASE + "/rest/v1/" + caminho, {
    method,
    headers: cabecalhos(body !== undefined, prefer ? { Prefer: prefer } : undefined),
    body: body !== undefined ? JSON.stringify(body) : undefined
  });
  if (!r.ok) {
    console.error("supabase rest falhou:", r.status, method, caminho.split("?")[0]);
    throw new Error("supabase " + r.status);
  }
  if (r.status === 204) return null;
  const texto = await r.text();
  return texto ? JSON.parse(texto) : null;
}

/* ---------- Supabase Auth (GoTrue) ---------- */

/* Login por e-mail + senha (admin/Jordan). Devolve o usuário ou null. */
export async function loginSenha(email, senha) {
  const r = await fetch(BASE + "/auth/v1/token?grant_type=password", {
    method: "POST",
    headers: cabecalhos(true),
    body: JSON.stringify({ email: email, password: senha })
  });
  if (r.status === 400 || r.status === 401 || r.status === 403) return null;
  if (!r.ok) {
    console.error("supabase auth login falhou:", r.status);
    throw new Error("auth " + r.status);
  }
  const dados = await r.json();
  return dados.user || null;
}

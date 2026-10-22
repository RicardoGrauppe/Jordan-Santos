/*
  Acesso ao Supabase (PostgREST + Auth) com a SERVICE ROLE KEY.

  SÓ roda no servidor. O `import "server-only"` não é decoração: é o que faz o
  build QUEBRAR se alguém importar isto de um Client Component, em vez de a
  chave de service role vazar silenciosamente pro browser.

  Logs levam só status HTTP e a tabela, nunca o corpo da resposta (é dado de
  cliente).
*/
import "server-only";

const BASE = process.env.SUPABASE_URL;
const CHAVE = process.env.SUPABASE_SERVICE_ROLE_KEY;

export function supabaseConfigurado(): boolean {
  return Boolean(BASE && CHAVE);
}

function cabecalhos(temCorpo: boolean, extra?: Record<string, string>): Record<string, string> {
  return {
    apikey: CHAVE!,
    Authorization: "Bearer " + CHAVE,
    ...(temCorpo ? { "Content-Type": "application/json" } : {}),
    ...extra,
  };
}

type OpcoesRest = {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  prefer?: string;
};

/** PostgREST: rest("clientes?id=eq.<uuid>&select=*", { method, body, prefer }) */
export async function rest<T = unknown>(caminho: string, opcoes: OpcoesRest = {}): Promise<T | null> {
  const { method = "GET", body, prefer } = opcoes;
  const r = await fetch(BASE + "/rest/v1/" + caminho, {
    method,
    headers: cabecalhos(body !== undefined, prefer ? { Prefer: prefer } : undefined),
    body: body !== undefined ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  if (!r.ok) {
    console.error("supabase rest falhou:", r.status, method, caminho.split("?")[0]);
    throw new Error("supabase " + r.status);
  }
  if (r.status === 204) return null;
  const texto = await r.text();
  return texto ? (JSON.parse(texto) as T) : null;
}

/* ---------- Supabase Storage ---------- */

/**
 * Storage com a service role: storage("object/<bucket>/<arquivo>", init).
 * Devolve a Response crua, porque quem chama decide o que fazer com o corpo
 * (gravar, repassar a imagem, ignorar). Erro de rede vira exceção; status
 * de erro, não: olhe o `ok`.
 */
export async function storage(caminho: string, init: { method?: string; body?: BodyInit; contentType?: string; extra?: Record<string, string> } = {}): Promise<Response> {
  const { method = "GET", body, contentType, extra } = init;
  return fetch(BASE + "/storage/v1/" + caminho, {
    method,
    headers: { apikey: CHAVE!, Authorization: "Bearer " + CHAVE, ...(contentType ? { "Content-Type": contentType } : {}), ...extra },
    body,
    cache: "no-store",
  });
}

/* ---------- Supabase Auth (GoTrue) ---------- */

export type UsuarioAuth = { id: string; email?: string } & Record<string, unknown>;

/**
 * Dispara o e-mail de redefinição de senha. Sempre resolve, mesmo quando o
 * e-mail não existe: responder diferente pra e-mail cadastrado entregaria
 * quem tem conta pra quem estiver sondando.
 */
export async function recuperarSenha(email: string, redirect?: string): Promise<boolean> {
  const url = BASE + "/auth/v1/recover" + (redirect ? "?redirect_to=" + encodeURIComponent(redirect) : "");
  const r = await fetch(url, {
    method: "POST",
    headers: cabecalhos(true),
    body: JSON.stringify({ email }),
  });
  if (!r.ok && r.status >= 500) {
    console.error("supabase recover falhou:", r.status);
    throw new Error("recover " + r.status);
  }
  return true;
}

/** Login por e-mail e senha. Devolve o usuário, ou null quando não confere. */
export async function loginSenha(email: string, senha: string): Promise<UsuarioAuth | null> {
  const r = await fetch(BASE + "/auth/v1/token?grant_type=password", {
    method: "POST",
    headers: cabecalhos(true),
    body: JSON.stringify({ email, password: senha }),
  });
  if (r.status === 400 || r.status === 401 || r.status === 403) return null;
  if (!r.ok) {
    console.error("supabase auth login falhou:", r.status);
    throw new Error("auth " + r.status);
  }
  const dados = await r.json();
  return dados.user ?? null;
}

/**
 * Troca a senha do próprio usuário.
 *
 * Reautentica com a senha ATUAL de propósito: ter o cookie de sessão não pode
 * bastar pra trocar a senha, senão uma sessão roubada tranca o dono pra fora
 * da própria conta. E usa o access_token que o login devolve pro PUT, ou seja,
 * é o usuário trocando a própria senha, não a service role sobrescrevendo.
 *
 * Devolve false quando a senha atual não confere; lança em falha real.
 */
export async function trocarSenha(email: string, senhaAtual: string, novaSenha: string): Promise<boolean> {
  const r = await fetch(BASE + "/auth/v1/token?grant_type=password", {
    method: "POST",
    headers: cabecalhos(true),
    body: JSON.stringify({ email, password: senhaAtual }),
  });
  if (r.status === 400 || r.status === 401 || r.status === 403) return false;
  if (!r.ok) {
    console.error("supabase auth (reautenticar pra troca de senha) falhou:", r.status);
    throw new Error("auth " + r.status);
  }
  const dados = await r.json();
  if (!dados.access_token) throw new Error("auth sem access_token");

  const u = await fetch(BASE + "/auth/v1/user", {
    method: "PUT",
    headers: cabecalhos(true, { Authorization: "Bearer " + dados.access_token }),
    body: JSON.stringify({ password: novaSenha }),
  });
  if (!u.ok) {
    console.error("supabase troca de senha falhou:", u.status);
    throw new Error("senha " + u.status);
  }
  return true;
}

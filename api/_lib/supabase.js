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

/* Dispara o e-mail de redefinição de senha (GoTrue /recover). Não distingue
   e-mail existente de inexistente — sempre resolve, pra não vazar quem tem
   conta. `redirect` é pra onde o link do e-mail leva (Site URL do Supabase se
   vazio). */
export async function recuperarSenha(email, redirect) {
  const url = BASE + "/auth/v1/recover" +
    (redirect ? "?redirect_to=" + encodeURIComponent(redirect) : "");
  const r = await fetch(url, {
    method: "POST",
    headers: cabecalhos(true),
    body: JSON.stringify({ email: email })
  });
  // 200 = enviado; 4xx do GoTrue (ex.: rate limit) também não deve vazar nada
  if (!r.ok && r.status >= 500) {
    console.error("supabase recover falhou:", r.status);
    throw new Error("recover " + r.status);
  }
  return true;
}

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

/* Troca a senha do próprio usuário. Reautentica com a senha ATUAL de propósito
   (prova de posse: ter o cookie de sessão não basta pra trocar a senha, senão
   uma sessão roubada trancaria o dono pra fora) e usa o access_token que o
   login devolve pra o PUT /auth/v1/user — ou seja, o usuário trocando a
   própria senha, não a service role sobrescrevendo por cima.
   Devolve false quando a senha atual não confere; lança em falha real. */
export async function trocarSenha(email, senhaAtual, novaSenha) {
  const r = await fetch(BASE + "/auth/v1/token?grant_type=password", {
    method: "POST",
    headers: cabecalhos(true),
    body: JSON.stringify({ email: email, password: senhaAtual })
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
    body: JSON.stringify({ password: novaSenha })
  });
  if (!u.ok) {
    console.error("supabase troca de senha falhou:", u.status);
    throw new Error("senha " + u.status);
  }
  return true;
}

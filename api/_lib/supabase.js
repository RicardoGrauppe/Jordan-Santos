/*
  Helpers de acesso ao Supabase (PostgREST + Storage) com a SERVICE ROLE KEY.
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
    /* Content-Type só com corpo: o parser do Storage devolve 400
       pra "application/json" sem body */
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

/* Storage: storage("object/list/fotos-clientes", {method:"POST", body:{...}}) */
export async function storage(caminho, { method = "GET", body } = {}) {
  const r = await fetch(BASE + "/storage/v1/" + caminho, {
    method,
    headers: cabecalhos(body !== undefined),
    body: body !== undefined ? JSON.stringify(body) : undefined
  });
  if (!r.ok) {
    console.error("supabase storage falhou:", r.status, method, caminho.split("?")[0]);
    throw new Error("storage " + r.status);
  }
  const texto = await r.text();
  return texto ? JSON.parse(texto) : null;
}

export const BUCKET = "fotos-clientes";

/* Lista os arquivos de um cliente no bucket (retorna [{name, ...}]) */
export async function listarFotos(clienteId) {
  const itens = await storage("object/list/" + BUCKET, {
    method: "POST",
    body: { prefix: clienteId, limit: 1000, sortBy: { column: "name", order: "asc" } }
  });
  /* o Storage devolve placeholders de pasta vazia com name ".emptyFolderPlaceholder" */
  return (itens || []).filter(function (f) { return f.name && !f.name.startsWith("."); });
}

/* Assina URLs de visualização (expiresIn em segundos) → [{nome, url}] */
export async function assinarFotos(clienteId, nomes, expiresIn) {
  if (!nomes.length) return [];
  const caminhos = nomes.map(function (n) { return clienteId + "/" + n; });
  const assinadas = await storage("object/sign/" + BUCKET, {
    method: "POST",
    body: { expiresIn: expiresIn, paths: caminhos }
  });
  return (assinadas || []).map(function (a, i) {
    return { nome: nomes[i], url: a.signedURL ? BASE + "/storage/v1" + a.signedURL : null };
  }).filter(function (f) { return f.url; });
}

/* URL da API do Storage pra montar links de upload assinado */
export function urlStorage(caminho) {
  return BASE + "/storage/v1" + caminho;
}

/* ---------- Supabase Auth (GoTrue) ---------- */

/* Login por e-mail + senha. Devolve o usuário ou null (credencial inválida). */
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

/* Cria usuário confirmado; devolve {id} ou null se o e-mail já existe. */
export async function criarUsuarioAuth(email, senha) {
  const r = await fetch(BASE + "/auth/v1/admin/users", {
    method: "POST",
    headers: cabecalhos(true),
    body: JSON.stringify({ email: email, password: senha, email_confirm: true })
  });
  if (r.status === 422) return null; /* e-mail já cadastrado */
  if (!r.ok) {
    console.error("supabase auth criar falhou:", r.status);
    throw new Error("auth " + r.status);
  }
  return r.json();
}

/* Troca a senha de um usuário existente (admin API). */
export async function definirSenhaAuth(userId, senha) {
  const r = await fetch(BASE + "/auth/v1/admin/users/" + userId, {
    method: "PUT",
    headers: cabecalhos(true),
    body: JSON.stringify({ password: senha })
  });
  if (!r.ok) {
    console.error("supabase auth senha falhou:", r.status);
    throw new Error("auth " + r.status);
  }
  return r.json();
}

/* Procura um usuário pelo e-mail (fallback quando criar devolve 422). */
export async function buscarUsuarioAuth(email) {
  const alvo = String(email || "").toLowerCase();
  const r = await fetch(BASE + "/auth/v1/admin/users?per_page=1000", {
    method: "GET",
    headers: cabecalhos(false)
  });
  if (!r.ok) {
    console.error("supabase auth busca falhou:", r.status);
    throw new Error("auth " + r.status);
  }
  const dados = await r.json();
  const lista = dados.users || dados || [];
  return lista.find(function (u) { return (u.email || "").toLowerCase() === alvo; }) || null;
}

/* Senha temporária legível (ex.: "fjq2-m8xk-4tpn") gerada no servidor. */
export function senhaTemporaria() {
  const abc = "abcdefghjkmnpqrstuvwxyz23456789"; /* sem 0/O, 1/l/i */
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  let s = "";
  for (let i = 0; i < 12; i++) {
    if (i === 4 || i === 8) s += "-";
    s += abc[bytes[i] % abc.length];
  }
  return s;
}

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

function cabecalhos(extra) {
  return {
    apikey: CHAVE,
    Authorization: "Bearer " + CHAVE,
    "Content-Type": "application/json",
    ...extra
  };
}

/* PostgREST: rest("clientes?id=eq.<uuid>&select=*", {method, body, prefer}) */
export async function rest(caminho, { method = "GET", body, prefer } = {}) {
  const r = await fetch(BASE + "/rest/v1/" + caminho, {
    method,
    headers: cabecalhos(prefer ? { Prefer: prefer } : undefined),
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
    headers: cabecalhos(),
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

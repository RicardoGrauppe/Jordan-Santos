/*
  Sessões sem estado: token = base64url(payload JSON) + "." + base64url(HMAC-SHA256).
  Payload: { sub: "<uuid do cliente>" | "estudio", role: "cliente" | "admin", exp: <unix s> }.
  Vive num cookie HttpOnly; Secure; SameSite=Lax chamado "sessao".
*/

const enc = new TextEncoder();

function b64url(dados) {
  const bytes = typeof dados === "string" ? enc.encode(dados) : new Uint8Array(dados);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function deB64url(s) {
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

async function chave() {
  if (!process.env.SESSION_SECRET) {
    /* sem segredo não há sessão: erro claro em vez de crash do Web Crypto */
    throw new Error("SESSION_SECRET não configurada na Vercel");
  }
  return crypto.subtle.importKey(
    "raw", enc.encode(process.env.SESSION_SECRET),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]
  );
}

export async function assinar(payload) {
  const corpo = b64url(JSON.stringify(payload));
  const sig = await crypto.subtle.sign("HMAC", await chave(), enc.encode(corpo));
  return corpo + "." + b64url(sig);
}

export async function verificar(token) {
  try {
    const partes = (token || "").split(".");
    if (partes.length !== 2) return null;
    const ok = await crypto.subtle.verify(
      "HMAC", await chave(), deB64url(partes[1]), enc.encode(partes[0])
    ); /* crypto.subtle.verify é timing-safe */
    if (!ok) return null;
    const payload = JSON.parse(new TextDecoder().decode(deB64url(partes[0])));
    return payload.exp > Date.now() / 1000 ? payload : null;
  } catch (_) {
    return null;
  }
}

/* ---- cookies ---- */

export function lerCookie(req) {
  const bruto = req.headers.cookie || "";
  const par = bruto.split(/;\s*/).find(function (c) { return c.startsWith("sessao="); });
  return par ? par.slice("sessao=".length) : null;
}

export function cookieDeSessao(token, maxAgeSegundos) {
  return "sessao=" + token +
    "; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=" + maxAgeSegundos;
}

export const COOKIE_LIMPO = "sessao=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0";

/* Valida a sessão da request; devolve o payload ou null. */
export async function sessaoDe(req, role) {
  const payload = await verificar(lerCookie(req));
  if (!payload) return null;
  if (role && payload.role !== role) return null;
  return payload;
}

/* ---- util ---- */

export function normalizarCpf(s) {
  return String(s || "").replace(/\D/g, "");
}

/* Comparação em tempo constante (senha do estúdio) */
export function comparaConstante(a, b) {
  const x = enc.encode(String(a || ""));
  const y = enc.encode(String(b || ""));
  let dif = x.length ^ y.length;
  const n = Math.max(x.length, y.length);
  for (let i = 0; i < n; i++) dif |= (x[i] || 0) ^ (y[i] || 0);
  return dif === 0;
}

export function esperar(ms) {
  return new Promise(function (r) { setTimeout(r, ms); });
}

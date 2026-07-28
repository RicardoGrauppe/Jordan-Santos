/*
  Servidor de desenvolvimento local: estático (com cleanUrls, como a Vercel)
  + as functions de api/*.js, pra testar login e dados reais sem deploy.

  Uso:  node dev-server.mjs          (porta em $PORT, default 8020)
  Env:  lê .env.local na raiz do repo (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
        SESSION_SECRET, RESEND_API_KEY...) — o .gitignore já cobre .env*.

  Diferenças da produção (de propósito):
  - remove o flag "Secure" dos cookies (http://localhost e IP da rede local
    não são HTTPS; sem isso o login não persistiria no iPhone).
  - zero cache. Nunca usar em produção.
*/

import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync, readFileSync, statSync } from "node:fs";
import { extname, join, normalize, sep, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const RAIZ = dirname(fileURLToPath(import.meta.url));
const PORTA = Number(process.env.PORT || 8020);

/* ---- .env.local ---- */
const envPath = join(RAIZ, ".env.local");
if (existsSync(envPath)) {
  for (const linha of readFileSync(envPath, "utf8").split("\n")) {
    const m = linha.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && m[2] && !(m[1] in process.env)) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
}

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".webp": "image/webp", ".svg": "image/svg+xml", ".ico": "image/x-icon",
  ".woff": "font/woff", ".woff2": "font/woff2", ".pdf": "application/pdf",
  ".webmanifest": "application/manifest+json"
};

/* ---- adapter estilo Vercel pras functions ---- */
const cacheHandlers = {};
async function handlerDe(nome) {
  if (!cacheHandlers[nome]) {
    const mod = await import(pathToFileURL(join(RAIZ, "api", nome + ".js")));
    cacheHandlers[nome] = mod.default;
  }
  return cacheHandlers[nome];
}

function semSecure(res) {
  const set = res.getHeader("Set-Cookie");
  if (set) {
    res.setHeader(
      "Set-Cookie",
      [].concat(set).map((c) => c.replace(/;\s*Secure/gi, ""))
    );
  }
}

async function tratarApi(req, res, url) {
  const nome = url.pathname.slice("/api/".length).replace(/\/+$/, "");
  if (!/^[a-z-]+$/.test(nome) || !existsSync(join(RAIZ, "api", nome + ".js"))) {
    res.writeHead(404, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ erro: "função não encontrada" }));
  }

  let bruto = "";
  for await (const parte of req) bruto += parte;
  req.query = Object.fromEntries(url.searchParams);
  req.body = undefined;
  if (bruto) {
    try { req.body = JSON.parse(bruto); } catch { req.body = bruto; }
  }

  res.status = function (c) { res.statusCode = c; return res; };
  res.json = function (o) {
    semSecure(res);
    if (!res.getHeader("Content-Type")) {
      res.setHeader("Content-Type", "application/json; charset=utf-8");
    }
    res.end(JSON.stringify(o));
    return res;
  };
  res.send = function (t) { semSecure(res); res.end(t); return res; };

  try {
    await (await handlerDe(nome))(req, res);
  } catch (e) {
    console.error("[dev]", nome, "explodiu:", e);
    if (!res.headersSent) {
      res.writeHead(500, { "Content-Type": "application/json" });
    }
    res.end(JSON.stringify({ erro: "erro no servidor de dev" }));
  }
}

/* ---- estático com cleanUrls ---- */
async function tratarEstatico(req, res, url) {
  let caminho = decodeURIComponent(url.pathname);
  if (caminho === "/") caminho = "/index.html";
  let alvo = normalize(join(RAIZ, caminho));
  if (!alvo.startsWith(RAIZ + sep)) { res.writeHead(403); return res.end(); }
  if (!extname(alvo) && existsSync(alvo + ".html")) alvo += ".html";
  if (!existsSync(alvo) || !statSync(alvo).isFile()) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    return res.end("não encontrado");
  }
  res.writeHead(200, {
    "Content-Type": MIME[extname(alvo).toLowerCase()] || "application/octet-stream",
    "Cache-Control": "no-store"
  });
  res.end(await readFile(alvo));
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  try {
    if (url.pathname.startsWith("/api/")) return await tratarApi(req, res, url);
    return await tratarEstatico(req, res, url);
  } catch (e) {
    console.error("[dev] erro:", e);
    if (!res.headersSent) res.writeHead(500);
    res.end();
  }
});

server.listen(PORTA, "0.0.0.0", () => {
  const temSupabase = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
  console.log(`[dev] servindo ${RAIZ}`);
  console.log(`[dev] http://localhost:${PORTA}  (rede: porta ${PORTA} em todas as interfaces)`);
  console.log(`[dev] Supabase ${temSupabase ? "configurado" : "SEM chave — preencha .env.local"}`);
});

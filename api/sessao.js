/*
  Logins e logout. POST {acao: "entrar-casal" | "entrar-estudio" | "sair"}.
  GET devolve {ok, role} se o cookie de sessão for válido.

  Casal entra com CPF (de qualquer um dos dois) + data do casamento.
  Estúdio (Jordan) entra com a senha do env ADMIN_PASSWORD.
  Falha de login: espera ~800ms e devolve erro genérico, sem dizer qual campo errou.
*/

import { rest, supabaseConfigurado } from "./_lib/supabase.js";
import {
  assinar, sessaoDe, cookieDeSessao, COOKIE_LIMPO,
  normalizarCpf, comparaConstante, esperar
} from "./_lib/sessao.js";

const DIA = 86400;

/* throttle best-effort em memória (zera em cold start, e tudo bem) */
const tentativas = new Map();
function estourou(ip) {
  const agora = Date.now();
  const t = tentativas.get(ip) || { n: 0, desde: agora };
  if (agora - t.desde > 15 * 60_000) { t.n = 0; t.desde = agora; }
  t.n++;
  tentativas.set(ip, t);
  return t.n > 30;
}

export default async function handler(req, res) {
  try {
    return await tratar(req, res);
  } catch (e) {
    console.error("sessao falhou:", e.message);
    return res.status(500).json({ erro: "erro de configuração no servidor" });
  }
}

async function tratar(req, res) {
  if (req.method === "GET") {
    const sessao = await sessaoDe(req);
    if (!sessao) return res.status(401).json({ ok: false });
    return res.status(200).json({ ok: true, role: sessao.role });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ erro: "método não permitido" });
  }

  const { acao } = req.body || {};

  if (acao === "sair") {
    res.setHeader("Set-Cookie", COOKIE_LIMPO);
    return res.status(200).json({ ok: true });
  }

  const ip = (req.headers["x-forwarded-for"] || "").split(",")[0].trim() || "?";
  if (estourou(ip)) {
    await esperar(800);
    return res.status(429).json({ erro: "muitas tentativas, aguarde alguns minutos" });
  }

  if (acao === "entrar-estudio") {
    const confere = process.env.ADMIN_PASSWORD &&
      comparaConstante(req.body.senha, process.env.ADMIN_PASSWORD);
    if (!confere) {
      await esperar(800);
      return res.status(401).json({ erro: "senha incorreta" });
    }
    const token = await assinar({
      sub: "estudio", role: "admin", exp: Math.floor(Date.now() / 1000) + 7 * DIA
    });
    res.setHeader("Set-Cookie", cookieDeSessao(token, 7 * DIA));
    return res.status(200).json({ ok: true, role: "admin" });
  }

  if (acao === "entrar-casal") {
    if (!supabaseConfigurado()) {
      return res.status(500).json({ erro: "banco não configurado" });
    }
    const cpf = normalizarCpf(req.body.cpf);
    const data = String(req.body.dataEvento || "");
    const dataOk = /^\d{4}-\d{2}-\d{2}$/.test(data);
    if (cpf.length !== 11 || !dataOk) {
      await esperar(800);
      return res.status(401).json({ erro: "dados não encontrados" });
    }
    let linhas = [];
    try {
      linhas = await rest(
        "clientes?or=(cpf_noivo.eq." + cpf + ",cpf_noiva.eq." + cpf + ")" +
        "&data_evento=eq." + data + "&status=neq.arquivado&select=id&limit=1"
      );
    } catch (_) {
      return res.status(502).json({ erro: "banco indisponível, tente de novo" });
    }
    if (!linhas || !linhas.length) {
      await esperar(800);
      return res.status(401).json({ erro: "dados não encontrados" });
    }
    const token = await assinar({
      sub: linhas[0].id, role: "cliente", exp: Math.floor(Date.now() / 1000) + 30 * DIA
    });
    res.setHeader("Set-Cookie", cookieDeSessao(token, 30 * DIA));
    return res.status(200).json({ ok: true, role: "cliente" });
  }

  return res.status(400).json({ erro: "ação desconhecida" });
}

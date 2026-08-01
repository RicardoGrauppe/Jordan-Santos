/*
  Login, logout e checagem de sessão do admin (Jordan), em cima do Supabase Auth.

  POST {acao:"entrar", email, senha}
    → valida no Supabase Auth. Só admin: o usuário precisa ter
      app_metadata.role = "admin" (ou casar com ADMIN_EMAIL). Sessão de 7 dias.
      A senha nunca é armazenada aqui: quem guarda (hasheada) é o Supabase.
  POST {acao:"sair"} → expira o cookie.
  GET → {ok, role} se o cookie de sessão for válido.

  Falha de login: espera ~800ms e devolve erro genérico.
*/

import { supabaseConfigurado, loginSenha } from "./_lib/supabase.js";
import {
  assinar, sessaoDe, cookieDeSessao, COOKIE_LIMPO, esperar
} from "./_lib/sessao.js";
import { criarLimite, ipDe } from "./_lib/util.js";

const DIA = 86400;
const estourou = criarLimite(15 * 60_000, 30);

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

  if (!supabaseConfigurado()) {
    return res.status(500).json({ erro: "banco não configurado" });
  }

  const ip = ipDe(req);
  if (estourou(ip || "sem-ip")) {   /* ipDe devolve null quando não há proxy */
    await esperar(800);
    return res.status(429).json({ erro: "muitas tentativas, aguarde alguns minutos" });
  }

  if (acao === "entrar") {
    const email = String(req.body.email || "").trim().toLowerCase();
    const senha = String(req.body.senha || "");
    if (!email || !senha) {
      await esperar(800);
      return res.status(401).json({ erro: "e-mail ou senha incorretos" });
    }

    const usuario = await loginSenha(email, senha);
    if (!usuario) {
      await esperar(800);
      return res.status(401).json({ erro: "e-mail ou senha incorretos" });
    }

    /* Jordan: usuário do Auth com app_metadata.role = "admin" (só o servidor
       consegue gravar app_metadata, então isso não é forjável pelo cliente).
       ADMIN_EMAIL segue aceito como fallback opcional. */
    const adminEmail = String(process.env.ADMIN_EMAIL || "").trim().toLowerCase();
    const ehAdmin = (usuario.app_metadata && usuario.app_metadata.role === "admin") ||
      (adminEmail && email === adminEmail);
    if (!ehAdmin) {
      await esperar(800);
      return res.status(401).json({ erro: "e-mail ou senha incorretos" });
    }
    const token = await assinar({
      sub: "estudio", role: "admin", exp: Math.floor(Date.now() / 1000) + 7 * DIA
    });
    res.setHeader("Set-Cookie", cookieDeSessao(token, 7 * DIA));
    return res.status(200).json({ ok: true, role: "admin" });
  }

  return res.status(400).json({ erro: "ação desconhecida" });
}

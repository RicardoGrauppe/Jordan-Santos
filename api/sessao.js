/*
  Logins, logout e troca de senha, em cima do Supabase Auth (e-mail + senha).

  POST {acao:"entrar", email, senha}
    → valida no Supabase Auth. Se o e-mail for o ADMIN_EMAIL (Jordan), sessão de
      admin (7 dias); senão procura o cliente vinculado (auth_user_id) e abre a
      sessão do casal (30 dias). A senha nunca é armazenada aqui: quem guarda
      (hasheada) é o Supabase.
  POST {acao:"trocar-senha", senhaAtual, senhaNova}
    → exige sessão de cliente; confirma a senha atual no Auth e grava a nova.
  POST {acao:"sair"} → expira o cookie.
  GET → {ok, role} se o cookie de sessão for válido.

  Falha de login: espera ~800ms e devolve erro genérico.
  Esqueceu a senha: o Jordan gera uma temporária no /estudio (reset por e-mail
  fica pra quando o domínio estiver verificado no Resend).
*/

import { rest, supabaseConfigurado, loginSenha, definirSenhaAuth } from "./_lib/supabase.js";
import {
  assinar, sessaoDe, cookieDeSessao, COOKIE_LIMPO, esperar
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

  if (!supabaseConfigurado()) {
    return res.status(500).json({ erro: "banco não configurado" });
  }

  const ip = (req.headers["x-forwarded-for"] || "").split(",")[0].trim() || "?";
  if (estourou(ip)) {
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
    if (ehAdmin) {
      const token = await assinar({
        sub: "estudio", role: "admin", exp: Math.floor(Date.now() / 1000) + 7 * DIA
      });
      res.setHeader("Set-Cookie", cookieDeSessao(token, 7 * DIA));
      return res.status(200).json({ ok: true, role: "admin" });
    }

    /* casal: precisa de um cliente vinculado ao usuário do Auth */
    const linhas = await rest(
      "clientes?auth_user_id=eq." + usuario.id +
      "&status=neq.arquivado&select=id&limit=1"
    );
    if (!linhas || !linhas.length) {
      await esperar(800);
      return res.status(401).json({ erro: "e-mail ou senha incorretos" });
    }
    const token = await assinar({
      sub: linhas[0].id, role: "cliente", exp: Math.floor(Date.now() / 1000) + 30 * DIA
    });
    res.setHeader("Set-Cookie", cookieDeSessao(token, 30 * DIA));
    return res.status(200).json({ ok: true, role: "cliente" });
  }

  if (acao === "trocar-senha") {
    const sessao = await sessaoDe(req, "cliente");
    if (!sessao) return res.status(401).json({ erro: "sessão inválida" });

    const senhaAtual = String(req.body.senhaAtual || "");
    const senhaNova = String(req.body.senhaNova || "");
    if (senhaNova.length < 8) {
      return res.status(400).json({ erro: "a nova senha precisa de pelo menos 8 caracteres" });
    }

    const linhas = await rest(
      "clientes?id=eq." + sessao.sub + "&select=email,auth_user_id&limit=1"
    );
    const cliente = linhas && linhas[0];
    if (!cliente || !cliente.auth_user_id) {
      return res.status(400).json({ erro: "acesso sem usuário vinculado, fale com o Jordan" });
    }

    const confere = await loginSenha(cliente.email, senhaAtual);
    if (!confere || confere.id !== cliente.auth_user_id) {
      await esperar(800);
      return res.status(401).json({ erro: "senha atual incorreta" });
    }

    await definirSenhaAuth(cliente.auth_user_id, senhaNova);
    return res.status(200).json({ ok: true });
  }

  return res.status(400).json({ erro: "ação desconhecida" });
}

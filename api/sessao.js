/*
  Login, logout e checagem de sessão do admin (Jordan), em cima do Supabase Auth.

  POST {acao:"entrar", email, senha}
    → valida no Supabase Auth. Só admin: o usuário precisa ter
      app_metadata.role = "admin" (ou casar com ADMIN_EMAIL). Sessão de 7 dias.
      A senha nunca é armazenada aqui: quem guarda (hasheada) é o Supabase.
  POST {acao:"sair"} → expira o cookie.
  POST {acao:"trocar-senha", atual, nova}
    → troca a senha de quem está logado. Exige a senha atual (o cookie sozinho
      não basta) e pega o e-mail do próprio token, nunca do corpo.
  GET → {ok, role, email} se o cookie de sessão for válido.

  Falha de login: espera ~800ms e devolve erro genérico.
*/

import { supabaseConfigurado, loginSenha, recuperarSenha, trocarSenha } from "./_lib/supabase.js";
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
    /* email pode não existir em sessão antiga (assinada antes dele entrar no
       payload); vai null e o cliente esconde a linha em vez de mostrar vazio */
    return res.status(200).json({ ok: true, role: sessao.role, email: sessao.email || null });
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
    /* email no payload pra a tela de Configurações poder mostrar de quem é a
       conta sem uma chamada extra. Só leitura: trocar de e-mail passa pelo
       Auth (confirmação), não por aqui. */
    const token = await assinar({
      sub: "estudio", role: "admin", email, exp: Math.floor(Date.now() / 1000) + 7 * DIA
    });
    res.setHeader("Set-Cookie", cookieDeSessao(token, 7 * DIA));
    return res.status(200).json({ ok: true, role: "admin" });
  }

  if (acao === "recuperar") {
    const email = String(req.body.email || "").trim().toLowerCase();
    /* resposta sempre igual (mesmo sem e-mail ou se ele não existir), pra não
       revelar quais e-mails têm conta. O link do e-mail volta pro /estudio. */
    if (email) {
      const origem = req.headers.origin ||
        ("https://" + (req.headers.host || "jordansantosfotografia.com"));
      try { await recuperarSenha(email, origem + "/estudio"); }
      catch (e) { console.error("recuperar falhou:", e.message); }
    }
    await esperar(500);
    return res.status(200).json({ ok: true });
  }

  /* Troca de senha de quem já está logado. Exige a senha ATUAL além do cookie:
     sessão válida sozinha não pode trocar a senha, senão um cookie roubado
     trancaria o Jordan pra fora da própria conta. O e-mail vem do token, não
     do corpo — assim não dá pra apontar a troca pra outra conta. */
  if (acao === "trocar-senha") {
    const sessao = await sessaoDe(req, "admin");
    if (!sessao) return res.status(401).json({ erro: "sua sessão expirou, entre de novo" });
    if (!sessao.email) {
      /* sessão assinada antes do e-mail entrar no payload */
      return res.status(409).json({ erro: "saia e entre de novo pra poder trocar a senha" });
    }
    const atual = String(req.body.atual || "");
    const nova = String(req.body.nova || "");
    if (!atual || !nova) return res.status(400).json({ erro: "preencha a senha atual e a nova" });
    if (nova.length < 8) return res.status(400).json({ erro: "a nova senha precisa de pelo menos 8 caracteres" });
    if (nova === atual) return res.status(400).json({ erro: "a nova senha precisa ser diferente da atual" });

    const trocou = await trocarSenha(sessao.email, atual, nova);
    if (!trocou) {
      await esperar(800);
      return res.status(401).json({ erro: "senha atual incorreta" });
    }
    return res.status(200).json({ ok: true });
  }

  return res.status(400).json({ erro: "ação desconhecida" });
}

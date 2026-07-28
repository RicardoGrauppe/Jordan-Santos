/*
  Preferências do estúdio (role "admin"): a assinatura do Jordan.
  Guardada na tabela `config` (chave/valor) pra valer em qualquer dispositivo — é o
  que faz a assinatura do Jordan aparecer no contrato que o casal assina em /assinar
  (antes ficava só no localStorage do navegador dele e nunca chegava ao casal).

  GET                      → { assinatura_jordan }
  POST {chave, valor}      → grava uma preferência (chave da whitelist); valor "" apaga
*/

import { rest } from "./_lib/supabase.js";
import { sessaoDe } from "./_lib/sessao.js";

const CHAVES = ["assinatura_jordan"];
const LIMITE_VALOR = 2_000_000; /* dataURL cabe no body da Vercel (~4.5MB) */

export default async function handler(req, res) {
  const sessao = await sessaoDe(req, "admin");
  if (!sessao) return res.status(401).json({ erro: "sessão inválida" });

  try {
    if (req.method === "GET") {
      const linhas = await rest("config?chave=eq.assinatura_jordan&select=valor&limit=1");
      const valor = linhas && linhas[0] && linhas[0].valor;
      return res.status(200).json({ assinatura_jordan: valor || null });
    }

    if (req.method !== "POST") {
      return res.status(405).json({ erro: "método não permitido" });
    }

    const { chave, valor } = req.body || {};
    if (!CHAVES.includes(chave)) return res.status(400).json({ erro: "chave inválida" });
    if (typeof valor === "string" && valor.length > LIMITE_VALOR) {
      return res.status(413).json({ erro: "conteúdo grande demais" });
    }

    /* valor vazio → apaga a preferência */
    if (!valor) {
      await rest("config?chave=eq." + chave, { method: "DELETE" });
      return res.status(200).json({ ok: true });
    }

    await rest("config?on_conflict=chave", {
      method: "POST",
      prefer: "resolution=merge-duplicates,return=minimal",
      body: { chave: chave, valor: valor, atualizado_em: new Date().toISOString() }
    });
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error("config falhou:", e.message);
    return res.status(502).json({ erro: "não deu pra salvar, tente de novo" });
  }
}

/*
  Config leve do estúdio (tabela `config`, chave/valor texto).
  Guarda a localização do Jordan (previsão do tempo), o perfil e o estado dos
  avisos (vistos/apagados) — esse último persistido aqui (não mais em
  localStorage) pra "já vi isto" acompanhar o Jordan entre celular e PC.

  GET                                  → { localizacao, perfil, avisos:{vistos,apagados} }
  POST {acao:"salvar-localizacao", localizacao:{cidade,lat,lon,nome}}  → upsert
  POST {acao:"limpar-localizacao"}     → remove
  POST {acao:"salvar-perfil", perfil:{nome,username}}                 → upsert
  POST {acao:"salvar-avisos", avisos:{vistos:[chave...], apagados:[chave...]}} → upsert
*/

import { rest } from "./_lib/supabase.js";
import { sessaoDe } from "./_lib/sessao.js";

const CHAVE = "localizacao";
const CHAVE_PERFIL = "perfil";
const CHAVE_AVISOS = "avisos";
/* teto de segurança: nunca deixa a lista crescer sem fim (chaves antigas de
   avisos que já nem existem mais continuam ocupando espaço à toa) */
const MAX_CHAVES_AVISO = 300;

async function lerChave(chave) {
  try {
    const linhas = await rest("config?chave=eq." + encodeURIComponent(chave) + "&select=valor&limit=1");
    const bruto = linhas && linhas[0] && linhas[0].valor;
    if (!bruto) return null;
    try { return JSON.parse(bruto); } catch (_) { return null; }
  } catch (_) { return null; }
}
async function lerLocalizacao() { return lerChave(CHAVE); }

async function gravarChave(chave, obj) {
  await rest("config", {
    method: "POST",
    body: { chave: chave, valor: JSON.stringify(obj), atualizado_em: new Date().toISOString() },
    prefer: "resolution=merge-duplicates"
  });
}

export default async function handler(req, res) {
  const sessao = await sessaoDe(req, "admin");
  if (!sessao) return res.status(401).json({ erro: "sessão inválida" });

  try {
    if (req.method === "GET") {
      const avisos = await lerChave(CHAVE_AVISOS);
      return res.status(200).json({
        localizacao: await lerLocalizacao(),
        perfil: await lerChave(CHAVE_PERFIL),
        avisos: avisos && typeof avisos === "object" ? avisos : { vistos: [], apagados: [] }
      });
    }

    if (req.method !== "POST") {
      return res.status(405).json({ erro: "método não permitido" });
    }

    const body = req.body || {};

    if (body.acao === "salvar-localizacao") {
      const l = body.localizacao || {};
      const lat = Number(l.lat), lon = Number(l.lon);
      const cidade = String(l.cidade || "").trim();
      if (!cidade || !isFinite(lat) || !isFinite(lon)) {
        return res.status(400).json({ erro: "localização inválida" });
      }
      await gravarChave(CHAVE, {
        cidade: cidade.slice(0, 120),
        nome: String(l.nome || cidade).slice(0, 160),
        lat: lat, lon: lon
      });
      return res.status(200).json({ ok: true });
    }

    if (body.acao === "salvar-perfil") {
      const p = body.perfil || {};
      await gravarChave(CHAVE_PERFIL, {
        nome: String(p.nome || "").trim().slice(0, 120),
        username: String(p.username || "").trim().slice(0, 60)
      });
      return res.status(200).json({ ok: true });
    }

    if (body.acao === "salvar-avisos") {
      const a = body.avisos || {};
      /* string por string, corta lixo e limita o tamanho — é só uma lista de
         chaves estáveis (ver chaveAviso() no front), nunca texto livre */
      const normaliza = (arr) => (Array.isArray(arr) ? arr : [])
        .filter((k) => typeof k === "string" && k)
        .map((k) => k.slice(0, 160))
        .slice(-MAX_CHAVES_AVISO);
      await gravarChave(CHAVE_AVISOS, {
        vistos: normaliza(a.vistos),
        apagados: normaliza(a.apagados)
      });
      return res.status(200).json({ ok: true });
    }

    if (body.acao === "limpar-localizacao") {
      await rest("config?chave=eq." + CHAVE, { method: "DELETE" });
      return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ erro: "ação desconhecida" });
  } catch (e) {
    console.error("config falhou:", e.message);
    return res.status(502).json({ erro: "banco indisponível, tente de novo" });
  }
}

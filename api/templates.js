/*
  Modelos de contrato (nomeados) + assinatura padrão do Jordan, editáveis em
  /configuracoes → "Contrato e assinatura".

  Modelos ficam em contrato_templates (agora com `nome`; `ativo` = é o padrão).
  São editáveis IN PLACE — não quebra contratos já gerados porque a geração
  grava um snapshot do HTML no próprio contrato (contratos.template_html_snapshot).

  GET                         → { padrao, modelos:[...], assinatura, assinaturas:[...] }
  GET ?id=<uuid>              → { modelo:{...conteudo_json,conteudo_html} }
  POST {acao:"criar", nome}                          → cria modelo (copia o padrão como base)
  POST {acao:"salvar", id, conteudo_json, conteudo_html}
  POST {acao:"renomear", id, nome}
  POST {acao:"definir-padrao", id}
  POST {acao:"excluir", id}                          → não deixa apagar o padrão nem o último

  Assinaturas seguem a MESMA forma dos modelos (várias, nomeadas, `ativo` = é a
  padrão), na tabela assinaturas. Antes era assinatura_padrao, de linha única
  (PK booleana com check(id)), que não comportava mais de uma:
  POST {acao:"assinatura-criar", tipo, valor, nome}  → cria; a 1ª já nasce padrão
  POST {acao:"assinatura-salvar", id, tipo, valor, nome}
  POST {acao:"assinatura-renomear", id, nome}
  POST {acao:"assinatura-definir-padrao", id}
  POST {acao:"assinatura-excluir", id}               → não deixa apagar a padrão
*/

import { rest } from "./_lib/supabase.js";
import { sessaoDe } from "./_lib/sessao.js";

const TIPOS_ASSINATURA = ["rubrica", "imagem", "cursiva"];

async function listaAssinaturas() {
  try {
    return await rest("assinaturas?select=id,nome,tipo,valor,ativo,atualizado_em&order=ativo.desc,atualizado_em.desc") || [];
  } catch (_) { return []; }
}

export default async function handler(req, res) {
  const sessao = await sessaoDe(req, "admin");
  if (!sessao) return res.status(401).json({ erro: "sessão inválida" });

  try {
    if (req.method === "GET") {
      if (req.query && req.query.id) {
        const linhas = await rest(
          "contrato_templates?id=eq." + encodeURIComponent(req.query.id) +
          "&select=id,nome,ativo,conteudo_json,conteudo_html,atualizado_em&limit=1"
        );
        const modelo = (linhas && linhas[0]) || null;
        if (!modelo) return res.status(404).json({ erro: "modelo não encontrado" });
        return res.status(200).json({ modelo: modelo });
      }
      const modelos = await rest(
        "contrato_templates?select=id,nome,ativo,atualizado_em&order=ativo.desc,atualizado_em.desc"
      );
      /* padrão completo (compat: antes o GET devolvia {ativo}) */
      const padraoLeve = (modelos || []).find(function (m) { return m.ativo; }) || null;
      let padrao = null;
      if (padraoLeve) {
        const full = await rest(
          "contrato_templates?id=eq." + padraoLeve.id +
          "&select=id,nome,conteudo_json,conteudo_html&limit=1"
        );
        padrao = (full && full[0]) || null;
      }
      const assinaturas = await listaAssinaturas();
      return res.status(200).json({
        ativo: padrao,               /* compat com quem ainda lê resp.ativo */
        padrao: padrao,
        modelos: modelos || [],
        /* `assinatura` (singular) = a padrão. É o que revisar-contrato.html usa
           pra já vir preenchida na confirmação, e mantém a forma antiga da
           resposta pra quem só quer a padrão. */
        assinatura: assinaturas.find(function (a) { return a.ativo; }) || null,
        assinaturas: assinaturas
      });
    }

    if (req.method !== "POST") {
      return res.status(405).json({ erro: "método não permitido" });
    }

    const body = req.body || {};
    const acao = body.acao;

    if (acao === "criar") {
      const nome = String(body.nome || "").trim() || "Novo modelo";
      /* base: copia o conteúdo do modelo padrão (se houver) pra não nascer vazio */
      let base = { conteudo_json: { type: "doc", content: [] }, conteudo_html: "<p></p>" };
      const p = await rest("contrato_templates?ativo=eq.true&select=conteudo_json,conteudo_html&limit=1");
      if (p && p[0]) base = { conteudo_json: p[0].conteudo_json, conteudo_html: p[0].conteudo_html };
      const linha = await rest("contrato_templates", {
        method: "POST",
        body: { nome: nome, ativo: false, conteudo_json: base.conteudo_json, conteudo_html: base.conteudo_html },
        prefer: "return=representation"
      });
      return res.status(200).json({ ok: true, modelo: linha[0] });
    }

    if (acao === "salvar") {
      if (!body.id) return res.status(400).json({ erro: "id do modelo ausente" });
      if (!body.conteudo_json || typeof body.conteudo_json !== "object") {
        return res.status(400).json({ erro: "conteúdo do modelo ausente" });
      }
      if (typeof body.conteudo_html !== "string" || !body.conteudo_html.trim()) {
        return res.status(400).json({ erro: "html do modelo ausente" });
      }
      const patch = {
        conteudo_json: body.conteudo_json,
        conteudo_html: body.conteudo_html,
        atualizado_em: new Date().toISOString()
      };
      if (typeof body.nome === "string" && body.nome.trim()) patch.nome = body.nome.trim();
      const linha = await rest("contrato_templates?id=eq." + encodeURIComponent(body.id), {
        method: "PATCH", body: patch, prefer: "return=representation"
      });
      return res.status(200).json({ ok: true, modelo: (linha && linha[0]) || null });
    }

    if (acao === "renomear") {
      if (!body.id || !String(body.nome || "").trim()) {
        return res.status(400).json({ erro: "id e nome obrigatórios" });
      }
      await rest("contrato_templates?id=eq." + encodeURIComponent(body.id), {
        method: "PATCH", body: { nome: String(body.nome).trim(), atualizado_em: new Date().toISOString() }
      });
      return res.status(200).json({ ok: true });
    }

    if (acao === "definir-padrao") {
      if (!body.id) return res.status(400).json({ erro: "id obrigatório" });
      /* tira o padrão de todos e põe no escolhido (índice único de um-ativo
         bloquearia dois true ao mesmo tempo, então desliga antes) */
      await rest("contrato_templates?ativo=eq.true", { method: "PATCH", body: { ativo: false } });
      await rest("contrato_templates?id=eq." + encodeURIComponent(body.id), { method: "PATCH", body: { ativo: true } });
      return res.status(200).json({ ok: true });
    }

    if (acao === "excluir") {
      if (!body.id) return res.status(400).json({ erro: "id obrigatório" });
      const todos = await rest("contrato_templates?select=id,ativo");
      if (!todos || todos.length <= 1) return res.status(400).json({ erro: "não dá pra apagar o único modelo" });
      const alvo = todos.find(function (m) { return m.id === body.id; });
      if (alvo && alvo.ativo) return res.status(400).json({ erro: "defina outro modelo como padrão antes de apagar este" });
      await rest("contrato_templates?id=eq." + encodeURIComponent(body.id), { method: "DELETE" });
      return res.status(200).json({ ok: true });
    }

    /* ---------- assinaturas ---------- */

    if (acao === "assinatura-criar" || acao === "assinatura-salvar") {
      const tipo = String(body.tipo || "").trim();
      const valor = String(body.valor || "");
      if (TIPOS_ASSINATURA.indexOf(tipo) === -1) {
        return res.status(400).json({ erro: "tipo de assinatura inválido" });
      }
      if (!valor.trim()) return res.status(400).json({ erro: "assinatura vazia" });
      /* mesmo teto do PNG que api/estudio.js aceita na confirmação: assinatura
         desenhada ou enviada como imagem vira data URL e pode crescer */
      if (valor.length > 500000) return res.status(413).json({ erro: "assinatura grande demais" });
      const nome = String(body.nome || "").trim() || "Assinatura";
      const agora = new Date().toISOString();

      if (acao === "assinatura-salvar" && body.id) {
        const linha = await rest("assinaturas?id=eq." + encodeURIComponent(body.id), {
          method: "PATCH",
          body: { nome: nome, tipo: tipo, valor: valor, atualizado_em: agora },
          prefer: "return=representation"
        });
        return res.status(200).json({ ok: true, assinatura: (linha && linha[0]) || null });
      }

      /* a primeira assinatura já nasce padrão: não faz sentido guardar uma só e
         ela não valer em lugar nenhum */
      const existentes = await rest("assinaturas?select=id&limit=1");
      const primeira = !existentes || existentes.length === 0;
      const criada = await rest("assinaturas", {
        method: "POST",
        body: { nome: nome, tipo: tipo, valor: valor, ativo: primeira, criado_em: agora, atualizado_em: agora },
        prefer: "return=representation"
      });
      return res.status(200).json({ ok: true, assinatura: (criada && criada[0]) || null });
    }

    if (acao === "assinatura-renomear") {
      if (!body.id || !String(body.nome || "").trim()) {
        return res.status(400).json({ erro: "id e nome obrigatórios" });
      }
      await rest("assinaturas?id=eq." + encodeURIComponent(body.id), {
        method: "PATCH", body: { nome: String(body.nome).trim(), atualizado_em: new Date().toISOString() }
      });
      return res.status(200).json({ ok: true });
    }

    if (acao === "assinatura-definir-padrao") {
      if (!body.id) return res.status(400).json({ erro: "id obrigatório" });
      /* desliga antes de ligar: o índice único assinaturas_uma_padrao recusaria
         duas ativas ao mesmo tempo */
      await rest("assinaturas?ativo=eq.true", { method: "PATCH", body: { ativo: false } });
      await rest("assinaturas?id=eq." + encodeURIComponent(body.id), { method: "PATCH", body: { ativo: true } });
      return res.status(200).json({ ok: true });
    }

    if (acao === "assinatura-excluir") {
      if (!body.id) return res.status(400).json({ erro: "id obrigatório" });
      const todas = await rest("assinaturas?select=id,ativo");
      const alvo = (todas || []).find(function (a) { return a.id === body.id; });
      /* apagar a padrão deixaria a confirmação de contrato sem assinatura pra
         aplicar; apagar a única é permitido (volta ao estado de nenhuma salva) */
      if (alvo && alvo.ativo && todas.length > 1) {
        return res.status(400).json({ erro: "defina outra assinatura como padrão antes de apagar esta" });
      }
      await rest("assinaturas?id=eq." + encodeURIComponent(body.id), { method: "DELETE" });
      return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ erro: "ação desconhecida" });
  } catch (e) {
    console.error("templates falhou:", e.message);
    return res.status(502).json({ erro: "banco indisponível, tente de novo" });
  }
}

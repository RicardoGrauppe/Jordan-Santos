/*
  Modelos de contrato (nomeados) + assinatura padrão do fotógrafo, editáveis em
  /configuracoes → "Contrato e assinatura".

  Portado de `api/templates.js` do estúdio do Jordan.

  Modelos ficam em contrato_templates (`nome`; `ativo` = é o padrão).
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
import { NextResponse } from "next/server";
import { rest } from "@/lib/supabase";
import { sessaoAtual } from "@/lib/sessao";

const TIPOS_ASSINATURA = ["rubrica", "imagem", "cursiva"];

/* ---------- tipos das linhas que cada leitura pede ao PostgREST ---------- */

type LinhaModeloResumo = {
  id: string;
  nome: string | null;
  ativo: boolean;
  atualizado_em: string | null;
};
type LinhaModelo = LinhaModeloResumo & { conteudo_json: unknown; conteudo_html: string | null };
type LinhaPadrao = { id: string; nome: string | null; conteudo_json: unknown; conteudo_html: string | null };
type LinhaBase = { conteudo_json: unknown; conteudo_html: string | null };
type LinhaIdAtivo = { id: string; ativo: boolean };

type LinhaAssinatura = {
  id: string;
  nome: string | null;
  tipo: string;
  valor: string;
  ativo: boolean;
  atualizado_em: string | null;
};

/** Objeto do corpo, ou {} quando veio outra coisa (o original lia `req.body || {}`). */
function objeto(valor: unknown): Record<string, unknown> {
  return valor && typeof valor === "object" ? (valor as Record<string, unknown>) : {};
}

async function listaAssinaturas(): Promise<LinhaAssinatura[]> {
  try {
    return (await rest<LinhaAssinatura[]>(
      "assinaturas?select=id,nome,tipo,valor,ativo,atualizado_em&order=ativo.desc,atualizado_em.desc",
    )) || [];
  } catch { return []; }
}

export async function GET(req: Request) {
  const sessao = await sessaoAtual("admin");
  if (!sessao) return NextResponse.json({ erro: "sessão inválida" }, { status: 401 });

  try {
    const id = new URL(req.url).searchParams.get("id");
    if (id) {
      const linhas = await rest<LinhaModelo[]>(
        "contrato_templates?id=eq." + encodeURIComponent(id) +
        "&select=id,nome,ativo,conteudo_json,conteudo_html,atualizado_em&limit=1",
      );
      const modelo = (linhas && linhas[0]) || null;
      if (!modelo) return NextResponse.json({ erro: "modelo não encontrado" }, { status: 404 });
      return NextResponse.json({ modelo: modelo });
    }
    const modelos = await rest<LinhaModeloResumo[]>(
      "contrato_templates?select=id,nome,ativo,atualizado_em&order=ativo.desc,atualizado_em.desc",
    );
    /* padrão completo (compat: antes o GET devolvia {ativo}) */
    const padraoLeve = (modelos || []).find((m) => m.ativo) || null;
    let padrao: LinhaPadrao | null = null;
    if (padraoLeve) {
      const full = await rest<LinhaPadrao[]>(
        "contrato_templates?id=eq." + padraoLeve.id +
        "&select=id,nome,conteudo_json,conteudo_html&limit=1",
      );
      padrao = (full && full[0]) || null;
    }
    const assinaturas = await listaAssinaturas();
    return NextResponse.json({
      ativo: padrao,               /* compat com quem ainda lê resp.ativo */
      padrao: padrao,
      modelos: modelos || [],
      /* `assinatura` (singular) = a padrão. É o que a revisão do contrato usa
         pra já vir preenchida na confirmação, e mantém a forma antiga da
         resposta pra quem só quer a padrão. */
      assinatura: assinaturas.find((a) => a.ativo) || null,
      assinaturas: assinaturas,
    });
  } catch (e) {
    console.error("templates falhou:", (e as Error).message);
    return NextResponse.json({ erro: "banco indisponível, tente de novo" }, { status: 502 });
  }
}

export async function POST(req: Request) {
  const sessao = await sessaoAtual("admin");
  if (!sessao) return NextResponse.json({ erro: "sessão inválida" }, { status: 401 });

  try {
    const body = objeto(await req.json().catch(() => ({})));
    const acao = body.acao;

    if (acao === "criar") {
      const nome = String(body.nome || "").trim() || "Novo modelo";
      /* base: copia o conteúdo do modelo padrão (se houver) pra não nascer vazio */
      let base: LinhaBase = { conteudo_json: { type: "doc", content: [] }, conteudo_html: "<p></p>" };
      const p = await rest<LinhaBase[]>("contrato_templates?ativo=eq.true&select=conteudo_json,conteudo_html&limit=1");
      if (p && p[0]) base = { conteudo_json: p[0].conteudo_json, conteudo_html: p[0].conteudo_html };
      const linha = await rest<LinhaModelo[]>("contrato_templates", {
        method: "POST",
        body: { nome: nome, ativo: false, conteudo_json: base.conteudo_json, conteudo_html: base.conteudo_html },
        prefer: "return=representation",
      });
      /* `return=representation` sempre traz a linha; se não vier, o `!` estoura
         como o `linha[0]` do original e cai no mesmo 502 do catch */
      return NextResponse.json({ ok: true, modelo: linha![0] });
    }

    if (acao === "salvar") {
      if (!body.id) return NextResponse.json({ erro: "id do modelo ausente" }, { status: 400 });
      const conteudoJson = body.conteudo_json;
      const conteudoHtml = body.conteudo_html;
      if (!conteudoJson || typeof conteudoJson !== "object") {
        return NextResponse.json({ erro: "conteúdo do modelo ausente" }, { status: 400 });
      }
      if (typeof conteudoHtml !== "string" || !conteudoHtml.trim()) {
        return NextResponse.json({ erro: "html do modelo ausente" }, { status: 400 });
      }
      const patch: Record<string, unknown> = {
        conteudo_json: conteudoJson,
        conteudo_html: conteudoHtml,
        atualizado_em: new Date().toISOString(),
      };
      if (typeof body.nome === "string" && body.nome.trim()) patch.nome = body.nome.trim();
      const linha = await rest<LinhaModelo[]>("contrato_templates?id=eq." + encodeURIComponent(String(body.id)), {
        method: "PATCH", body: patch, prefer: "return=representation",
      });
      return NextResponse.json({ ok: true, modelo: (linha && linha[0]) || null });
    }

    if (acao === "renomear") {
      if (!body.id || !String(body.nome || "").trim()) {
        return NextResponse.json({ erro: "id e nome obrigatórios" }, { status: 400 });
      }
      await rest("contrato_templates?id=eq." + encodeURIComponent(String(body.id)), {
        method: "PATCH", body: { nome: String(body.nome).trim(), atualizado_em: new Date().toISOString() },
      });
      return NextResponse.json({ ok: true });
    }

    if (acao === "definir-padrao") {
      if (!body.id) return NextResponse.json({ erro: "id obrigatório" }, { status: 400 });
      /* tira o padrão de todos e põe no escolhido (índice único de um-ativo
         bloquearia dois true ao mesmo tempo, então desliga antes) */
      await rest("contrato_templates?ativo=eq.true", { method: "PATCH", body: { ativo: false } });
      await rest("contrato_templates?id=eq." + encodeURIComponent(String(body.id)), { method: "PATCH", body: { ativo: true } });
      return NextResponse.json({ ok: true });
    }

    if (acao === "excluir") {
      if (!body.id) return NextResponse.json({ erro: "id obrigatório" }, { status: 400 });
      const todos = await rest<LinhaIdAtivo[]>("contrato_templates?select=id,ativo");
      if (!todos || todos.length <= 1) return NextResponse.json({ erro: "não dá pra apagar o único modelo" }, { status: 400 });
      const alvo = todos.find((m) => m.id === body.id);
      if (alvo && alvo.ativo) return NextResponse.json({ erro: "defina outro modelo como padrão antes de apagar este" }, { status: 400 });
      await rest("contrato_templates?id=eq." + encodeURIComponent(String(body.id)), { method: "DELETE" });
      return NextResponse.json({ ok: true });
    }

    /* ---------- assinaturas ---------- */

    if (acao === "assinatura-criar" || acao === "assinatura-salvar") {
      const tipo = String(body.tipo || "").trim();
      const valor = String(body.valor || "");
      if (TIPOS_ASSINATURA.indexOf(tipo) === -1) {
        return NextResponse.json({ erro: "tipo de assinatura inválido" }, { status: 400 });
      }
      if (!valor.trim()) return NextResponse.json({ erro: "assinatura vazia" }, { status: 400 });
      /* mesmo teto do PNG que a rota do painel (/api/estudio) aceita na
         confirmação: assinatura desenhada ou enviada como imagem vira data URL
         e pode crescer */
      if (valor.length > 500000) return NextResponse.json({ erro: "assinatura grande demais" }, { status: 413 });
      const nome = String(body.nome || "").trim() || "Assinatura";
      const agora = new Date().toISOString();

      if (acao === "assinatura-salvar" && body.id) {
        const linha = await rest<LinhaAssinatura[]>("assinaturas?id=eq." + encodeURIComponent(String(body.id)), {
          method: "PATCH",
          body: { nome: nome, tipo: tipo, valor: valor, atualizado_em: agora },
          prefer: "return=representation",
        });
        return NextResponse.json({ ok: true, assinatura: (linha && linha[0]) || null });
      }

      /* a primeira assinatura já nasce padrão: não faz sentido guardar uma só e
         ela não valer em lugar nenhum */
      const existentes = await rest<{ id: string }[]>("assinaturas?select=id&limit=1");
      const primeira = !existentes || existentes.length === 0;
      const criada = await rest<LinhaAssinatura[]>("assinaturas", {
        method: "POST",
        body: { nome: nome, tipo: tipo, valor: valor, ativo: primeira, criado_em: agora, atualizado_em: agora },
        prefer: "return=representation",
      });
      return NextResponse.json({ ok: true, assinatura: (criada && criada[0]) || null });
    }

    if (acao === "assinatura-renomear") {
      if (!body.id || !String(body.nome || "").trim()) {
        return NextResponse.json({ erro: "id e nome obrigatórios" }, { status: 400 });
      }
      await rest("assinaturas?id=eq." + encodeURIComponent(String(body.id)), {
        method: "PATCH", body: { nome: String(body.nome).trim(), atualizado_em: new Date().toISOString() },
      });
      return NextResponse.json({ ok: true });
    }

    if (acao === "assinatura-definir-padrao") {
      if (!body.id) return NextResponse.json({ erro: "id obrigatório" }, { status: 400 });
      /* desliga antes de ligar: o índice único assinaturas_uma_padrao recusaria
         duas ativas ao mesmo tempo */
      await rest("assinaturas?ativo=eq.true", { method: "PATCH", body: { ativo: false } });
      await rest("assinaturas?id=eq." + encodeURIComponent(String(body.id)), { method: "PATCH", body: { ativo: true } });
      return NextResponse.json({ ok: true });
    }

    if (acao === "assinatura-excluir") {
      if (!body.id) return NextResponse.json({ erro: "id obrigatório" }, { status: 400 });
      const todas = (await rest<LinhaIdAtivo[]>("assinaturas?select=id,ativo")) || [];
      const alvo = todas.find((a) => a.id === body.id);
      /* apagar a padrão deixaria a confirmação de contrato sem assinatura pra
         aplicar; apagar a única é permitido (volta ao estado de nenhuma salva) */
      if (alvo && alvo.ativo && todas.length > 1) {
        return NextResponse.json({ erro: "defina outra assinatura como padrão antes de apagar esta" }, { status: 400 });
      }
      await rest("assinaturas?id=eq." + encodeURIComponent(String(body.id)), { method: "DELETE" });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ erro: "ação desconhecida" }, { status: 400 });
  } catch (e) {
    console.error("templates falhou:", (e as Error).message);
    return NextResponse.json({ erro: "banco indisponível, tente de novo" }, { status: 502 });
  }
}

/* O original checava a sessão e depois respondia 405 com JSON pra qualquer
   método fora GET/POST. O App Router só devolve 405 sozinho, sem corpo; isto
   mantém a resposta (e a ordem: 401 antes do 405) igual. */
async function metodoNaoPermitido() {
  const sessao = await sessaoAtual("admin");
  if (!sessao) return NextResponse.json({ erro: "sessão inválida" }, { status: 401 });
  return NextResponse.json({ erro: "método não permitido" }, { status: 405 });
}
export const PUT = metodoNaoPermitido;
export const PATCH = metodoNaoPermitido;
export const DELETE = metodoNaoPermitido;

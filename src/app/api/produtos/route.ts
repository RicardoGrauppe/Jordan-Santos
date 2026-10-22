/*
  Produtos e serviços do fotógrafo (tabela `produtos`), editados em
  /painel/produtos. Ver lib/produtos.ts.

  GET                                       → { produtos: [...] } (ativos e desativados, na ordem)
  POST {acao:"criar", tipo, nome, curto?, preco}
  POST {acao:"salvar", id, tipo?, nome?, curto?, preco?, inclui?, ativo?}
  POST {acao:"reordenar", ids:[...]}         → ordem = posição na lista
  POST {acao:"excluir", id}                  → só se nenhum cliente usou; senão 409 (desative)
*/
import { NextResponse } from "next/server";
import { rest } from "@/lib/supabase";
import { sessaoAtual } from "@/lib/sessao";
import { chaveNova, normalizarProduto } from "@/lib/produtos";

const ID = /^[a-z0-9-]{1,48}$/;

function objeto(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : {};
}

function texto(v: unknown, max: number): string {
  return String(v ?? "").trim().slice(0, max);
}

function preco(v: unknown): number | null {
  const n = typeof v === "number" ? v : Number(String(v ?? "").replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) && n >= 0 && n < 10_000_000 ? Math.round(n * 100) / 100 : null;
}

async function lista() {
  const linhas = await rest<Record<string, unknown>[]>(
    "produtos?select=id,tipo,nome,curto,preco,inclui,ativo,ordem&order=ordem.asc,criado_em.asc",
  );
  return (linhas || []).map(normalizarProduto);
}

export async function GET() {
  const sessao = await sessaoAtual("admin");
  if (!sessao) return NextResponse.json({ erro: "sessão inválida" }, { status: 401 });
  try {
    return NextResponse.json({ produtos: await lista() });
  } catch (e) {
    console.error("produtos falhou:", (e as Error).message);
    return NextResponse.json({ erro: "banco indisponível, tente de novo" }, { status: 502 });
  }
}

export async function POST(req: Request) {
  const sessao = await sessaoAtual("admin");
  if (!sessao) return NextResponse.json({ erro: "sessão inválida" }, { status: 401 });

  try {
    const body = objeto(await req.json().catch(() => ({})));
    const acao = body.acao;
    const agora = new Date().toISOString();

    if (acao === "criar") {
      const nome = texto(body.nome, 120);
      if (!nome) return NextResponse.json({ erro: "dê um nome ao produto" }, { status: 400 });
      const valor = preco(body.preco);
      if (valor === null) return NextResponse.json({ erro: "preço inválido" }, { status: 400 });
      const atuais = await lista();
      const linha = await rest<Record<string, unknown>[]>("produtos", {
        method: "POST",
        prefer: "return=representation",
        body: {
          id: chaveNova(nome),
          tipo: body.tipo === "pacote" ? "pacote" : "adicional",
          nome,
          curto: texto(body.curto, 60) || nome.slice(0, 60),
          preco: valor,
          ordem: (atuais.reduce((m, p) => Math.max(m, p.ordem), 0) || 0) + 10,
          criado_em: agora,
          atualizado_em: agora,
        },
      });
      return NextResponse.json({ ok: true, produto: normalizarProduto(linha![0]) });
    }

    if (acao === "salvar") {
      const id = String(body.id || "");
      if (!ID.test(id)) return NextResponse.json({ erro: "produto inválido" }, { status: 400 });
      const patch: Record<string, unknown> = { atualizado_em: agora };
      if (body.tipo === "pacote" || body.tipo === "adicional") patch.tipo = body.tipo;
      if (body.nome !== undefined) {
        const nome = texto(body.nome, 120);
        if (!nome) return NextResponse.json({ erro: "o nome não pode ficar vazio" }, { status: 400 });
        patch.nome = nome;
      }
      if (body.curto !== undefined) patch.curto = texto(body.curto, 60) || String(patch.nome ?? "").slice(0, 60);
      if (body.preco !== undefined) {
        const valor = preco(body.preco);
        if (valor === null) return NextResponse.json({ erro: "preço inválido" }, { status: 400 });
        patch.preco = valor;
      }
      if (Array.isArray(body.inclui)) patch.inclui = body.inclui.map(String).filter((x) => ID.test(x) && x !== id).slice(0, 50);
      if (typeof body.ativo === "boolean") patch.ativo = body.ativo;
      const linha = await rest<Record<string, unknown>[]>("produtos?id=eq." + id, {
        method: "PATCH", body: patch, prefer: "return=representation",
      });
      if (!linha || !linha[0]) return NextResponse.json({ erro: "produto não encontrado" }, { status: 404 });
      return NextResponse.json({ ok: true, produto: normalizarProduto(linha[0]) });
    }

    if (acao === "reordenar") {
      const ids = Array.isArray(body.ids) ? body.ids.map(String).filter((x) => ID.test(x)).slice(0, 200) : [];
      await Promise.all(ids.map((id, i) =>
        rest("produtos?id=eq." + id, { method: "PATCH", body: { ordem: (i + 1) * 10 } })));
      return NextResponse.json({ ok: true });
    }

    if (acao === "excluir") {
      const id = String(body.id || "");
      if (!ID.test(id)) return NextResponse.json({ erro: "produto inválido" }, { status: 400 });
      /* item que já foi pra algum cliente fica: apagar deixaria contrato e
         orçamento apontando pro nada. Desativar tira das listas sem quebrar. */
      const usado = await rest<{ id: string }[]>(
        "clientes?itens=cs." + encodeURIComponent(JSON.stringify([{ id }])) + "&select=id&limit=1",
      );
      if (usado && usado.length) {
        return NextResponse.json(
          { erro: "este produto já foi escolhido por algum cliente; desative em vez de excluir", emUso: true },
          { status: 409 },
        );
      }
      await rest("produtos?id=eq." + id, { method: "DELETE" });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ erro: "ação desconhecida" }, { status: 400 });
  } catch (e) {
    console.error("produtos falhou:", (e as Error).message);
    return NextResponse.json({ erro: "banco indisponível, tente de novo" }, { status: 502 });
  }
}

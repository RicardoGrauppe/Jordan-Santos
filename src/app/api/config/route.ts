/*
  Config leve do estúdio (tabela `config`, chave/valor texto).
  Guarda a localização do fotógrafo (previsão do tempo), o perfil e o estado dos
  avisos (vistos/apagados) — esse último persistido aqui (não em localStorage)
  pra "já vi isto" acompanhar o fotógrafo entre celular e PC.

  Portado de `api/config.js` do estúdio do Jordan.

  GET                                  → { localizacao, perfil, avisos:{vistos,apagados} }
  POST {acao:"salvar-localizacao", localizacao:{cidade,lat,lon,nome}}  → upsert
  POST {acao:"limpar-localizacao"}     → remove
  POST {acao:"salvar-perfil", perfil:{nome,username}}                 → upsert
  POST {acao:"salvar-avisos", avisos:{vistos:[chave...], apagados:[chave...]}} → upsert
*/
import { NextResponse } from "next/server";
import { rest } from "@/lib/supabase";
import { sessaoAtual } from "@/lib/sessao";

const CHAVE = "localizacao";
const CHAVE_PERFIL = "perfil";
const CHAVE_AVISOS = "avisos";
/* teto de segurança: nunca deixa a lista crescer sem fim (chaves antigas de
   avisos que já nem existem mais continuam ocupando espaço à toa) */
const MAX_CHAVES_AVISO = 300;

type LinhaConfig = { valor: string | null };

/** Conteúdo gravado numa chave, já como JSON; null quando não existe ou não parseia. */
async function lerChave(chave: string): Promise<unknown> {
  try {
    const linhas = await rest<LinhaConfig[]>(
      "config?chave=eq." + encodeURIComponent(chave) + "&select=valor&limit=1",
    );
    const bruto = linhas && linhas[0] && linhas[0].valor;
    if (!bruto) return null;
    try { return JSON.parse(bruto) as unknown; } catch { return null; }
  } catch { return null; }
}
async function lerLocalizacao(): Promise<unknown> { return lerChave(CHAVE); }

async function gravarChave(chave: string, obj: unknown): Promise<void> {
  await rest("config", {
    method: "POST",
    body: { chave, valor: JSON.stringify(obj), atualizado_em: new Date().toISOString() },
    prefer: "resolution=merge-duplicates",
  });
}

/** Mesmo `String(x || "")` do original: falsy vira string vazia. */
function str(valor: unknown): string {
  return valor ? String(valor) : "";
}

/** Objeto do corpo, ou {} quando veio outra coisa. */
function objeto(valor: unknown): Record<string, unknown> {
  return valor && typeof valor === "object" ? (valor as Record<string, unknown>) : {};
}

export async function GET() {
  const sessao = await sessaoAtual("admin");
  if (!sessao) return NextResponse.json({ erro: "sessão inválida" }, { status: 401 });

  try {
    const avisos = await lerChave(CHAVE_AVISOS);
    return NextResponse.json({
      localizacao: await lerLocalizacao(),
      perfil: await lerChave(CHAVE_PERFIL),
      avisos: avisos && typeof avisos === "object" ? avisos : { vistos: [], apagados: [] },
    });
  } catch (e) {
    console.error("config falhou:", (e as Error).message);
    return NextResponse.json({ erro: "banco indisponível, tente de novo" }, { status: 502 });
  }
}

export async function POST(req: Request) {
  const sessao = await sessaoAtual("admin");
  if (!sessao) return NextResponse.json({ erro: "sessão inválida" }, { status: 401 });

  try {
    const corpo = objeto(await req.json().catch(() => ({})));
    const acao = corpo.acao;

    if (acao === "salvar-localizacao") {
      const l = objeto(corpo.localizacao);
      const lat = Number(l.lat), lon = Number(l.lon);
      const cidade = str(l.cidade).trim();
      if (!cidade || !isFinite(lat) || !isFinite(lon)) {
        return NextResponse.json({ erro: "localização inválida" }, { status: 400 });
      }
      await gravarChave(CHAVE, {
        cidade: cidade.slice(0, 120),
        nome: (l.nome ? String(l.nome) : cidade).slice(0, 160),
        lat, lon,
      });
      return NextResponse.json({ ok: true });
    }

    if (acao === "salvar-perfil") {
      const p = objeto(corpo.perfil);
      await gravarChave(CHAVE_PERFIL, {
        nome: str(p.nome).trim().slice(0, 120),
        username: str(p.username).trim().slice(0, 60),
      });
      return NextResponse.json({ ok: true });
    }

    if (acao === "salvar-avisos") {
      const a = objeto(corpo.avisos);
      /* string por string, corta lixo e limita o tamanho — é só uma lista de
         chaves estáveis (ver chaveAviso() no front), nunca texto livre */
      const normaliza = (arr: unknown): string[] =>
        (Array.isArray(arr) ? arr : [])
          .filter((k): k is string => typeof k === "string" && !!k)
          .map((k) => k.slice(0, 160))
          .slice(-MAX_CHAVES_AVISO);
      await gravarChave(CHAVE_AVISOS, {
        vistos: normaliza(a.vistos),
        apagados: normaliza(a.apagados),
      });
      return NextResponse.json({ ok: true });
    }

    if (acao === "limpar-localizacao") {
      await rest("config?chave=eq." + CHAVE, { method: "DELETE" });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ erro: "ação desconhecida" }, { status: 400 });
  } catch (e) {
    console.error("config falhou:", (e as Error).message);
    return NextResponse.json({ erro: "banco indisponível, tente de novo" }, { status: 502 });
  }
}

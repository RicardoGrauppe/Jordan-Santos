/*
  Biblioteca de fotos do Ateliê (só fotógrafo logado).

  GET  → { midias: Midia[] }
  POST multipart (arquivo, largura?, altura?) → { midia }   envia uma foto
  POST {acao:"apagar", id} → { ok } | 409 { erro, emUso }    foto em uso não sai
*/
import { NextResponse } from "next/server";
import { sessaoAtual } from "@/lib/sessao";
import { apagarMidia, guardarMidia, listarMidias, TAMANHO_MAX, TIPOS_DE_FOTO } from "@/lib/atelie/midias";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function erro(mensagem: string, status: number, extra?: object) {
  return NextResponse.json({ erro: mensagem, ...extra }, { status });
}

/** Número inteiro positivo do formulário, ou null. */
function medida(valor: FormDataEntryValue | null): number | null {
  const n = Number(valor);
  return Number.isInteger(n) && n > 0 && n < 100_000 ? n : null;
}

export async function GET() {
  if (!(await sessaoAtual("admin"))) return erro("sessão inválida", 401);
  try {
    return NextResponse.json({ midias: await listarMidias() });
  } catch (e) {
    console.error("midia falhou:", (e as Error).message);
    return erro("Não consegui carregar suas fotos, tente de novo.", 502);
  }
}

export async function POST(req: Request) {
  if (!(await sessaoAtual("admin"))) return erro("sessão inválida", 401);

  try {
    if ((req.headers.get("content-type") ?? "").startsWith("multipart/form-data")) {
      const form = await req.formData();
      const arquivo = form.get("arquivo");
      if (!(arquivo instanceof File)) return erro("Escolha uma foto pra enviar.", 400);
      if (!(TIPOS_DE_FOTO as readonly string[]).includes(arquivo.type)) {
        return erro("Essa foto não é JPG, PNG nem WebP.", 415);
      }
      if (arquivo.size > TAMANHO_MAX) return erro("Essa foto passa de 15 MB.", 413);
      const midia = await guardarMidia({
        dados: await arquivo.arrayBuffer(), tipo: arquivo.type, nome: arquivo.name || "foto",
        largura: medida(form.get("largura")), altura: medida(form.get("altura")),
      });
      return NextResponse.json({ midia });
    }

    const corpo = (await req.json().catch(() => ({}))) as { acao?: unknown; id?: unknown };
    if (corpo.acao === "apagar") {
      if (typeof corpo.id !== "string" || !UUID.test(corpo.id)) return erro("foto inválida", 400);
      const r = await apagarMidia(corpo.id);
      if (!r) return erro("Essa foto não existe mais.", 404);
      if ("emUso" in r) {
        return erro("Essa foto está em uso em " + r.emUso.map((n) => `"${n}"`).join(", ") + ". Troque ela lá antes de apagar.", 409, { emUso: r.emUso });
      }
      return NextResponse.json({ ok: true });
    }
    return erro("ação desconhecida", 400);
  } catch (e) {
    console.error("midia falhou:", (e as Error).message);
    return erro("Não consegui salvar a foto agora, tente de novo.", 502);
  }
}

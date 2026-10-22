/*
  Config do formulário de cadastro, pra tela /painel/formulario.

  GET                    → { formulario }
  POST { formulario }    → normaliza (travas dos campos que o contrato usa),
                           grava e devolve { formulario } como ficou. Foto
                           enviada que saiu da lista tem os arquivos apagados
                           DEPOIS de gravar: se apagasse antes e a gravação
                           falhasse, a config apontaria pra foto inexistente

  Só o fotógrafo. O /cadastro, que é público, não passa por aqui: lê a config
  direto no servidor (lib/formulario-servidor.ts).
*/
import { NextResponse } from "next/server";
import { sessaoAtual } from "@/lib/sessao";
import { gravarFormulario, lerFormulario } from "@/lib/formulario-servidor";
import { apagarFoto } from "@/lib/formulario-fotos";

export async function GET() {
  const sessao = await sessaoAtual("admin");
  if (!sessao) return NextResponse.json({ erro: "sessão inválida" }, { status: 401 });
  return NextResponse.json({ formulario: await lerFormulario() });
}

export async function POST(req: Request) {
  const sessao = await sessaoAtual("admin");
  if (!sessao) return NextResponse.json({ erro: "sessão inválida" }, { status: 401 });

  const corpo = (await req.json().catch(() => ({}))) as { formulario?: unknown };
  try {
    const antes = await lerFormulario();
    const formulario = await gravarFormulario(corpo.formulario);
    const ficam = new Set(formulario.fotos.map((f) => f.id));
    await Promise.all(
      antes.fotos.filter((f) => f.origem === "enviada" && !ficam.has(f.id)).map((f) => apagarFoto(f.id)),
    );
    return NextResponse.json({ formulario });
  } catch (e) {
    console.error("formulário: gravação falhou:", (e as Error).message);
    return NextResponse.json({ erro: "não deu pra salvar, tente de novo" }, { status: 502 });
  }
}

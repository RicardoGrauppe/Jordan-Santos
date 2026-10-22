/*
  Fotos da abertura do /cadastro (editor de Formulário). Só o fotógrafo.

  POST multipart { foto: File }  → converte, guarda e devolve { foto } pronta
                                   pra entrar na lista (o editor salva a lista)

  A lista em si (ordem, enquadramento) mora na config do formulário e é salva
  pelo /api/formulario, como o resto do editor. Tirar uma foto não passa por
  aqui: quem apaga os arquivos é o /api/formulario, depois de gravar a lista
  sem ela.
*/
import { NextResponse } from "next/server";
import { sessaoAtual } from "@/lib/sessao";
import { guardarFoto } from "@/lib/formulario-fotos";
import type { FotoAbertura } from "@/lib/formulario";

const TIPOS = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);
const MAX_BYTES = 15 * 1024 * 1024;

export async function POST(req: Request) {
  const sessao = await sessaoAtual("admin");
  if (!sessao) return NextResponse.json({ erro: "sessão inválida" }, { status: 401 });

  const dados = await req.formData().catch(() => null);
  const arquivo = dados?.get("foto");
  if (!(arquivo instanceof File)) {
    return NextResponse.json({ erro: "Escolha uma foto." }, { status: 400 });
  }
  if (arquivo.type && !TIPOS.has(arquivo.type)) {
    return NextResponse.json({ erro: "Essa foto precisa ser JPG, PNG ou WEBP." }, { status: 400 });
  }
  if (arquivo.size > MAX_BYTES) {
    return NextResponse.json({ erro: "Essa foto passa de 15 MB. Tente uma menor." }, { status: 400 });
  }

  try {
    const id = await guardarFoto(Buffer.from(await arquivo.arrayBuffer()));
    const foto: FotoAbertura = { id, origem: "enviada", foco: 50, alt: "Foto do portfólio" };
    return NextResponse.json({ foto });
  } catch (e) {
    return NextResponse.json({ erro: (e as Error).message }, { status: 502 });
  }
}


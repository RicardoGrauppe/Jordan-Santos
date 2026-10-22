/*
  API do Ateliê (só fotógrafo logado).

  GET → { modelos: ResumoModelo[], ativo: id | null }
        Na primeira chamada, com o banco vazio, cria o modelo da proposta já
        publicado e no ar (garantirModeloInicial).

  As ações de criar, duplicar, renomear, ativar e apagar entram com a galeria
  de modelos.
*/
import { NextResponse } from "next/server";
import { sessaoAtual } from "@/lib/sessao";
import { garantirModeloInicial, idDoSiteAtivo, listarModelos } from "@/lib/atelie/modelos";

export async function GET() {
  const sessao = await sessaoAtual("admin");
  if (!sessao) return NextResponse.json({ erro: "sessão inválida" }, { status: 401 });

  try {
    await garantirModeloInicial();
    return NextResponse.json({ modelos: await listarModelos(), ativo: await idDoSiteAtivo() });
  } catch (e) {
    console.error("atelie falhou:", (e as Error).message);
    return NextResponse.json({ erro: "banco indisponível, tente de novo" }, { status: 502 });
  }
}

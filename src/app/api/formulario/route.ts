/*
  Formulários de cadastro, pro Ateliê (desde 22/10/2026 o formulário é um tipo
  de modelo, ver lib/formulario-servidor.ts).

  GET                         → { modelos: ResumoFormulario[], ativo }
  GET ?id=<id>                → { formulario, nome, ativo }  o que o editor abre
  POST { id, formulario }     → normaliza (travas dos campos que o contrato
                                usa), grava e devolve { formulario }. Foto
                                enviada que saiu da lista e que nenhum outro
                                modelo usa tem os arquivos apagados DEPOIS de
                                gravar: se apagasse antes e a gravação
                                falhasse, a config apontaria pra foto inexistente
  POST { formulario }         → o mesmo, no modelo em uso (como era antes)
  POST { acao:"criar", nome }      → { id }  parte do formulário padrão
  POST { acao:"duplicar", id }     → { id }
  POST { acao:"renomear", id, nome }
  POST { acao:"usar", id }         → passa a ser o que o /cadastro mostra
  POST { acao:"apagar", id }       → nunca o que está em uso

  Só o fotógrafo. O /cadastro, que é público, não passa por aqui: lê direto
  no servidor (lerFormulario).
*/
import { NextResponse } from "next/server";
import { sessaoAtual } from "@/lib/sessao";
import {
  apagarModelo, criarModelo, duplicarModelo, fotosSemDono, gravarFormulario, lerModelos, renomearModelo,
  resumo, usarModelo,
} from "@/lib/formulario-servidor";
import { apagarFoto } from "@/lib/formulario-fotos";

function erro(mensagem: string, status: number) {
  return NextResponse.json({ erro: mensagem }, { status });
}

export async function GET(req: Request) {
  const sessao = await sessaoAtual("admin");
  if (!sessao) return erro("sessão inválida", 401);
  try {
    const { modelos, ativo } = await lerModelos();
    const id = new URL(req.url).searchParams.get("id");
    if (id !== null) {
      const m = modelos.find((x) => x.id === id);
      if (!m) return erro("Esse formulário não existe mais.", 404);
      return NextResponse.json({ formulario: m.formulario, nome: m.nome, ativo });
    }
    return NextResponse.json({ modelos: modelos.map(resumo), ativo });
  } catch (e) {
    console.error("formulário: leitura falhou:", (e as Error).message);
    return erro("Não consegui carregar os formulários, tente de novo.", 502);
  }
}

export async function POST(req: Request) {
  const sessao = await sessaoAtual("admin");
  if (!sessao) return erro("sessão inválida", 401);

  const corpo = (await req.json().catch(() => ({}))) as { acao?: string; id?: string; nome?: string; formulario?: unknown };
  const id = typeof corpo.id === "string" ? corpo.id : "";

  try {
    if (corpo.acao === "criar") return NextResponse.json({ id: await criarModelo(String(corpo.nome ?? "")) });
    if (corpo.acao === "duplicar") return NextResponse.json({ id: await duplicarModelo(id) });
    if (corpo.acao === "renomear") { await renomearModelo(id, String(corpo.nome ?? "")); return NextResponse.json({ ok: true }); }
    if (corpo.acao === "usar") { await usarModelo(id); return NextResponse.json({ ok: true }); }
    if (corpo.acao === "apagar") {
      const orfas = await apagarModelo(id);
      await Promise.all(orfas.map((f) => apagarFoto(f)));
      return NextResponse.json({ ok: true });
    }
    if (corpo.acao) return erro("ação desconhecida", 400);

    const alvo = id || (await lerModelos()).ativo;
    const { antes, depois } = await gravarFormulario(alvo, corpo.formulario);
    const ficam = new Set(depois.fotos.map((f) => f.id));
    const sairam = antes.fotos.filter((f) => f.origem === "enviada" && !ficam.has(f.id)).map((f) => f.id);
    await Promise.all((await fotosSemDono(sairam)).map((f) => apagarFoto(f)));
    return NextResponse.json({ formulario: depois });
  } catch (e) {
    const msg = (e as Error).message;
    if (msg === "em uso") return erro("Esse é o formulário em uso. Escolha outro pra usar antes de apagar.", 409);
    if (msg === "modelo não encontrado") return erro("Esse formulário não existe mais.", 404);
    console.error("formulário: gravação falhou:", msg);
    return erro("não deu pra salvar, tente de novo", 502);
  }
}

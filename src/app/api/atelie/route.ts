/*
  API do Ateliê (só fotógrafo logado).

  GET → { modelos: ResumoModelo[], ativo: id | null }
        Na primeira chamada, com o banco vazio, cria o modelo da proposta já
        publicado e no ar (garantirModeloInicial).

  POST {acao:"criar", nome}        → { id }  modelo em branco, com o contato do site no ar
  POST {acao:"duplicar", id}       → { id }  cópia do rascunho, fora do ar
  POST {acao:"renomear", id, nome} → { ok }
  POST {acao:"por-no-ar", id}      → { ok }  publica o rascunho e vira o site
  POST {acao:"apagar", id}         → { ok }  nunca o que está no ar
*/
import { NextResponse } from "next/server";
import { sessaoAtual } from "@/lib/sessao";
import {
  apagarModelo, criarModeloEmBranco, duplicarModelo, garantirModeloInicial, idDoSiteAtivo,
  listarModelos, nomeValido, porNoAr, renomearModelo,
} from "@/lib/atelie/modelos";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function erro(mensagem: string, status: number) {
  return NextResponse.json({ erro: mensagem }, { status });
}

export async function GET() {
  const sessao = await sessaoAtual("admin");
  if (!sessao) return erro("sessão inválida", 401);

  try {
    await garantirModeloInicial();
    return NextResponse.json({ modelos: await listarModelos(), ativo: await idDoSiteAtivo() });
  } catch (e) {
    console.error("atelie falhou:", (e as Error).message);
    return erro("Não consegui carregar seus modelos agora, tente de novo.", 502);
  }
}

export async function POST(req: Request) {
  const sessao = await sessaoAtual("admin");
  if (!sessao) return erro("sessão inválida", 401);

  const corpo = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const acao = corpo.acao;
  const id = typeof corpo.id === "string" && UUID.test(corpo.id) ? corpo.id : null;

  try {
    if (acao === "criar") {
      const nome = nomeValido(corpo.nome);
      if (!nome) return erro("Dê um nome pro modelo.", 400);
      return NextResponse.json({ id: await criarModeloEmBranco(nome) });
    }

    if (!id) return erro("modelo inválido", 400);

    if (acao === "duplicar") {
      const novo = await duplicarModelo(id);
      if (!novo) return erro("Esse modelo não existe mais.", 404);
      return NextResponse.json({ id: novo });
    }

    if (acao === "renomear") {
      const nome = nomeValido(corpo.nome);
      if (!nome) return erro("Dê um nome pro modelo.", 400);
      await renomearModelo(id, nome);
      return NextResponse.json({ ok: true });
    }

    if (acao === "por-no-ar") {
      const r = await porNoAr(id);
      if (r === "nao-existe") return erro("Esse modelo não existe mais.", 404);
      if (r === "vazio") return erro("Coloque pelo menos um bloco antes de pôr no ar.", 409);
      return NextResponse.json({ ok: true });
    }

    if (acao === "apagar") {
      const r = await apagarModelo(id);
      if (r === "no-ar") return erro("Esse é o modelo que está no ar. Ponha outro no ar antes de apagar.", 409);
      return NextResponse.json({ ok: true });
    }

    return erro("ação desconhecida", 400);
  } catch (e) {
    console.error("atelie falhou:", acao, (e as Error).message);
    return erro("Não consegui salvar agora, tente de novo.", 502);
  }
}

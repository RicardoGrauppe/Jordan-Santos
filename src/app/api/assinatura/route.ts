/*
  Via assinada do contrato, em PDF.

  Isto já foi a rota inteira da assinatura: a tela do casal (/assinar) pedia o
  contrato aqui, mandava o código por e-mail, recebia o traço da assinatura,
  gerava o PDF carimbado e gravava a trilha de auditoria. Desde 21/10/2026 quem
  faz tudo isso é a Autentique (ver `lib/contrato-autentique.ts`), e desta rota
  sobrou o que continua sendo nosso: entregar a via guardada no banco.

  Por que ela não morreu junto: o PDF assinado é baixado da Autentique UMA vez
  e guardado em `contratos.pdf_base64`. Depois disso o painel baixa daqui, sem
  depender de a Autentique estar no ar, de a chave continuar válida ou de o
  plano seguir ativo. Contratos assinados na tela antiga também continuam
  saindo por aqui, com o PDF que nós mesmos geramos na época.

  O token segue sendo a credencial: quem tem o link tem a via.
*/
import { NextResponse } from "next/server";
import { rest, supabaseConfigurado } from "@/lib/supabase";
import type { SnapshotContrato } from "@/lib/contrato-pdf/gerar";

type Snapshot = SnapshotContrato & { email?: string | null };

type LinhaPdf = {
  status: string | null;
  pdf_base64: string | null;
  snapshot: Snapshot | null;
};

function tokenValido(t: unknown): t is string {
  return typeof t === "string" && /^[A-Za-z0-9_-]{20,64}$/.test(t);
}

export async function GET(req: Request) {
  if (!supabaseConfigurado()) {
    return NextResponse.json({ erro: "indisponível no momento" }, { status: 503 });
  }

  const params = new URL(req.url).searchParams;
  const token = params.get("token");
  if (!params.get("pdf") || !tokenValido(token)) {
    return NextResponse.json({ erro: "link inválido" }, { status: 400 });
  }

  /* select explícito e só aqui: o blob do PDF nunca vem junto nas outras leituras */
  const linhas = await rest<LinhaPdf[]>(
    "contratos?token=eq." + token + "&select=status,pdf_base64,snapshot&limit=1",
  );
  const c = linhas && linhas[0];
  if (!c) return NextResponse.json({ erro: "contrato não encontrado" }, { status: 404 });
  if (c.status !== "assinado" || !c.pdf_base64) {
    return NextResponse.json({ erro: "este contrato ainda não foi assinado" }, { status: 404 });
  }

  const s: Snapshot = c.snapshot || {};
  const casal = [s.noivo, s.noiva].filter(Boolean).join(" e ");
  return NextResponse.json({
    pdf: c.pdf_base64,
    arquivo: "Contrato assinado" + (casal ? " - " + casal : "") + ".pdf",
  });
}

/* A coleta da assinatura é da Autentique. Responde 410 (e não 404) pra deixar
   claro que o endereço existiu e foi aposentado, caso algum link velho poste
   aqui. */
export async function POST() {
  return NextResponse.json({ erro: "assinatura é feita pela Autentique" }, { status: 410 });
}

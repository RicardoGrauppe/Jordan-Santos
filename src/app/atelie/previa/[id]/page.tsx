/*
  Prévia de um modelo do Ateliê, desenhada exatamente como o site público. Só
  o fotógrafo logado abre; pra qualquer outra pessoa a página não existe (404,
  e não "faça login", pra não confirmar que o endereço é real).

  - sem nada: o RASCUNHO (é o que a miniatura da galeria mostra);
  - ?versao=<id>: uma versão publicada daquele modelo;
  - ?barra=1: com a barra da prévia por cima (o "Ver como fica").

  Fica fora de /painel de propósito: o layout do painel põe a moldura do app
  (lateral, barra de baixo) em volta, e a prévia tem de ser a página nua.
*/
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { sessaoAtual } from "@/lib/sessao";
import { rascunhoDe, versaoDe } from "@/lib/atelie/modelos";
import { PaginaDoSite } from "@/lib/atelie/PaginaDoSite";
import { BarraDaPrevia } from "@/components/BarraDaPrevia";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const metadata: Metadata = { title: "Prévia", robots: { index: false, follow: false } };

export default async function PreviaModelo({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ versao?: string; barra?: string }>;
}) {
  const { id } = await params;
  const { versao, barra } = await searchParams;
  if (!UUID.test(id) || !(await sessaoAtual("admin"))) notFound();
  const modelo = await rascunhoDe(id).catch(() => null);
  if (!modelo) notFound();

  let dados = modelo.rascunho;
  let publicadoEm: string | null = null;
  if (versao) {
    if (!UUID.test(versao)) notFound();
    const daVersao = await versaoDe(id, versao).catch(() => null);
    if (!daVersao) notFound();
    dados = daVersao.dados;
    publicadoEm = daVersao.publicado_em;
  }

  return (
    <>
      <PaginaDoSite dados={dados} />
      {barra === "1" ? <BarraDaPrevia idModelo={id} nome={modelo.nome} versao={versao ?? null} publicadoEm={publicadoEm} /> : null}
    </>
  );
}

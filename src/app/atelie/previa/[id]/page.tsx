/*
  Prévia de um modelo do Ateliê: o RASCUNHO, desenhado exatamente como o site
  público. Só o fotógrafo logado abre; pra qualquer outra pessoa a página não
  existe (404, e não "faça login", pra não confirmar que o endereço é real).

  Fica fora de /painel de propósito: o layout do painel põe a moldura do app
  (lateral, barra de baixo) em volta, e a prévia tem de ser a página nua. É a
  mesma página que aparece encolhida nas miniaturas da galeria.
*/
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { sessaoAtual } from "@/lib/sessao";
import { rascunhoDe } from "@/lib/atelie/modelos";
import { PaginaDoSite } from "@/lib/atelie/PaginaDoSite";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const metadata: Metadata = { title: "Prévia", robots: { index: false, follow: false } };

export default async function PreviaModelo({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id) || !(await sessaoAtual("admin"))) notFound();
  const modelo = await rascunhoDe(id).catch(() => null);
  if (!modelo) notFound();
  return <PaginaDoSite dados={modelo.rascunho} />;
}

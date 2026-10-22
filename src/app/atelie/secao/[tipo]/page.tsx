/*
  Uma seção pronta do Ateliê sozinha numa página, com o conteúdo de exemplo e
  o contato do site no ar: é o que cada cartão da biblioteca de seções mostra
  num iframe encolhido (como a miniatura da galeria), pra prévia sair com o
  layout de computador de verdade mesmo no celular. Só o fotógrafo logado
  abre; pros outros, 404, como a prévia do modelo.
*/
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { sessaoAtual } from "@/lib/sessao";
import { siteNoAr } from "@/lib/atelie/modelos";
import { secaoComIds } from "@/lib/atelie/blocos";
import { PaginaDoSite } from "@/lib/atelie/PaginaDoSite";
import { TIPOS_DE_SECAO, type TipoDeSecao } from "@/lib/atelie/tipos";

export const metadata: Metadata = { title: "Seção", robots: { index: false, follow: false } };

export default async function PreviaSecao({ params }: { params: Promise<{ tipo: string }> }) {
  const { tipo } = await params;
  const tipos: readonly string[] = TIPOS_DE_SECAO;
  if (!tipos.includes(tipo) || !(await sessaoAtual("admin"))) notFound();
  const raiz = (await siteNoAr()).root;
  return <PaginaDoSite dados={{ root: raiz, content: [secaoComIds(tipo as TipoDeSecao)], zones: {} }} />;
}

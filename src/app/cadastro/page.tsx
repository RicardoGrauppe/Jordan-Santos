import type { Metadata } from "next";
import { lerFormulario } from "@/lib/formulario-servidor";
import { FormularioCadastro } from "./FormularioCadastro";

/* Página pública, mas não indexável: o link é mandado pelo fotógrafo, um a
   um, depois de uma conversa (mesmo padrão do link de assinatura). */
export const metadata: Metadata = {
  title: "Confirmar nossa data",
  robots: { index: false, follow: false },
};

/* lê a config a cada visita: o fotógrafo edita em /painel/formulario e o
   próximo casal que abrir o link já vê a versão nova */
export const dynamic = "force-dynamic";

export default async function PaginaCadastro() {
  return <FormularioCadastro formulario={await lerFormulario()} />;
}

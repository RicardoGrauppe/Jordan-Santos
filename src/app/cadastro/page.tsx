import type { Metadata } from "next";
import { FormularioCadastro } from "./FormularioCadastro";

/* Página pública, mas não indexável: o link é mandado pelo fotógrafo, um a
   um, depois de uma conversa (mesmo padrão do link de assinatura). */
export const metadata: Metadata = {
  title: "Confirmar nossa data",
  robots: { index: false, follow: false },
};

export default function PaginaCadastro() {
  return <FormularioCadastro />;
}

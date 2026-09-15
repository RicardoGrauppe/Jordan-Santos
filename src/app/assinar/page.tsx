import type { Metadata } from "next";
import { Assinar } from "./Assinar";

/* Página pública e tokenizada: o link exclusivo é a credencial. Nunca
   indexável. */
export const metadata: Metadata = {
  title: "Assinar contrato",
  robots: { index: false, follow: false },
};

export default async function PaginaAssinar({ searchParams }: { searchParams: Promise<{ token?: string | string[] }> }) {
  const { token } = await searchParams;
  return <Assinar token={typeof token === "string" ? token : ""} />;
}

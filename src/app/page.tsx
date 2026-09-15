import { redirect } from "next/navigation";
import { sessaoAtual } from "@/lib/sessao";

/* A raiz não tem tela própria: manda pro painel se já tem sessão, pro login se
   não tem. É a mesma decisão do /estudio antigo, que abria login ou app
   conforme o cookie. */
export default async function Raiz() {
  const sessao = await sessaoAtual("admin");
  redirect(sessao ? "/painel" : "/entrar");
}

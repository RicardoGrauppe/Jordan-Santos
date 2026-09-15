import { redirect } from "next/navigation";
import { sessaoAtual } from "@/lib/sessao";
import { AppShell } from "@/components/AppShell";

/*
  Portão de entrada do painel. A checagem fica AQUI, no servidor, e não em cada
  página: assim uma tela nova nasce protegida por estar na pasta, em vez de
  depender de alguém lembrar de checar. No app antigo isso era um `if` repetido
  em cada arquivo HTML.
*/
export default async function LayoutPainel({ children }: { children: React.ReactNode }) {
  const sessao = await sessaoAtual("admin");
  if (!sessao) redirect("/entrar");
  return <AppShell nome={sessao.email?.split("@")[0]}>{children}</AppShell>;
}

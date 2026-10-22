import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { sessaoAtual } from "@/lib/sessao";
import { rest } from "@/lib/supabase";
import { AppShell } from "@/components/AppShell";

/*
  Portão de entrada do painel. A checagem fica AQUI, no servidor, e não em cada
  página: assim uma tela nova nasce protegida por estar na pasta, em vez de
  depender de alguém lembrar de checar. No app antigo isso era um `if` repetido
  em cada arquivo HTML.
*/

/*
  PWA fica AQUI, não no layout raiz: vale só pra área logada.

  - `appleWebApp` é o trio apple-mobile-web-app-*: salvo na tela de início, o
    painel abre SEM a barra do Safari, que é o que dá cara de aplicativo.
    `statusBarStyle: "default"` (texto escuro) porque o header é claro;
    "black-translucent" deixaria a hora branca sobre fundo branco.
  - A trava de zoom mora no layout RAIZ desde 22/10/2026: o Ricardo quis o
    app sem zoom nenhum, como app nativo. A regra de 16px nos campos não
    bastava porque a folha do contrato é texto editável em letra pequena.
*/
export const metadata: Metadata = {
  appleWebApp: { capable: true, title: "Estúdio", statusBarStyle: "default" },
};

type LinhaConfig = { valor: string | null };

/* O nome do estúdio vem do perfil (Configurações), não do e-mail: o cabeçalho
   mostrava "admin" porque usava o pedaço antes do @. No estúdio original ali
   ficava a LOGO do fotógrafo; enquanto a marca não é dado do produto, o nome
   que ele escolheu é o mais próximo disso. Falha de leitura não derruba o
   painel: cai no e-mail, como antes. */
async function nomeDoEstudio(email?: string | null): Promise<string | undefined> {
  const reserva = email?.split("@")[0];
  try {
    const linhas = await rest<LinhaConfig[]>("config?chave=eq.perfil&select=valor&limit=1");
    const valor = linhas?.[0]?.valor;
    if (!valor) return reserva;
    const perfil = JSON.parse(valor) as { nome?: string };
    return perfil.nome?.trim() || reserva;
  } catch {
    return reserva;
  }
}

export default async function LayoutPainel({ children }: { children: React.ReactNode }) {
  const sessao = await sessaoAtual("admin");
  if (!sessao) redirect("/entrar");
  return <AppShell nome={await nomeDoEstudio(sessao.email)}>{children}</AppShell>;
}

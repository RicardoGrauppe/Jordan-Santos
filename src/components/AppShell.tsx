/*
  Moldura do painel: header fixo, menu lateral recolhível e barra inferior no
  celular. Portado do estúdio do Jordan.

  Decisões herdadas de lá, que custaram tempo e não devem ser redescobertas:
  - Hover SÓ com `[@media(hover:hover)]`. Sem isso, no celular o item fica
    preso no estado de hover depois do toque e não volta.
  - O menu lateral tem fundo próprio (não o da página) pra se distinguir sem
    precisar de borda.
  - A preferência de recolhido persiste, senão ele reabre a cada navegação e
    quem recolheu tem que recolher de novo toda vez.
*/
"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { Bell, House, LogOut, PanelLeft, Search, Settings, Users } from "lucide-react";

const HOVER = "[@media(hover:hover)]:";
const CHAVE_RECOLHIDO = "menu-recolhido";

const ITENS = [
  { href: "/painel", rotulo: "Home", Icone: House },
  { href: "/painel/clientes", rotulo: "Clientes", Icone: Users },
];

/* A preferência de recolhido vive no localStorage e entra pelo
   useSyncExternalStore: no servidor (e na hidratação) vale "aberto", e o
   cliente troca pro valor guardado sem setState em efeito. */
const ouvintesRecolhido = new Set<() => void>();
function assinarRecolhido(cb: () => void) {
  ouvintesRecolhido.add(cb);
  return () => { ouvintesRecolhido.delete(cb); };
}
function lerRecolhido() {
  try { return localStorage.getItem(CHAVE_RECOLHIDO) === "1"; } catch { return false; }
}
function gravarRecolhido(v: boolean) {
  try { localStorage.setItem(CHAVE_RECOLHIDO, v ? "1" : "0"); } catch { /* storage bloqueado */ }
  ouvintesRecolhido.forEach((cb) => cb());
}

export function AppShell({ children, nome }: { children: ReactNode; nome?: string }) {
  const caminho = usePathname();
  const router = useRouter();
  const recolhido = useSyncExternalStore(assinarRecolhido, lerRecolhido, () => false);
  const [menuAberto, setMenuAberto] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuAberto) return;
    const fechar = () => setMenuAberto(false);
    document.addEventListener("pointerdown", fechar);
    return () => document.removeEventListener("pointerdown", fechar);
  }, [menuAberto]);

  async function sair() {
    await fetch("/api/sessao", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ acao: "sair" }) });
    router.refresh();
    router.push("/entrar");
  }

  function alternar() { gravarRecolhido(!recolhido); }

  const ativo = (href: string) =>
    href === "/painel" ? caminho === "/painel" : caminho.startsWith(href);

  return (
    <div className="min-h-dvh bg-soft">
      <header className="sticky top-0 z-30 grid h-14 grid-cols-[auto_1fr_auto] items-center gap-4 bg-paper px-4 shadow-card">
        <Link href="/painel" className="text-[15px] font-semibold tracking-tight text-ink no-underline">
          {nome ?? "Estúdio"}
        </Link>

        <label className="mx-auto flex w-full max-w-[420px] items-center gap-2 rounded-[10px] bg-soft px-3 py-2">
          <Search size={15} className="shrink-0 text-ink-soft" />
          <input
            type="search"
            placeholder="Buscar"
            aria-label="Buscar"
            className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-ink-soft"
          />
        </label>

        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="Notificações"
            className={`inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-[10px] text-ink-soft ${HOVER}hover:bg-soft ${HOVER}hover:text-ink`}
          >
            <Bell size={17} />
          </button>
          {/* menu do usuário: fecha com clique fora (pointerdown no document) */}
          <div ref={menuRef} className="relative ml-1">
            <button
              type="button"
              aria-label="Menu da conta" aria-haspopup="true" aria-expanded={menuAberto}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => setMenuAberto((v) => !v)}
              className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-accent-tint text-[12px] font-semibold text-accent"
            >
              {(nome ?? "E").slice(0, 1).toUpperCase()}
            </button>
            {menuAberto ? (
              <div onPointerDown={(e) => e.stopPropagation()} className="absolute right-0 top-10 z-40 min-w-[200px] rounded-xl bg-paper p-1.5 shadow-alta">
                <div className="px-3 pb-2 pt-1.5 text-[12px] text-ink-soft">{nome ?? "Conta"}</div>
                <Link href="/painel/configuracoes" onClick={() => setMenuAberto(false)}
                  className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[13.5px] text-ink no-underline ${HOVER}hover:bg-soft`}>
                  <Settings size={15} className="opacity-85" /> Configurações
                </Link>
                <button type="button" onClick={sair}
                  className={`flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13.5px] text-erro ${HOVER}hover:bg-erro-tint`}>
                  <LogOut size={15} className="opacity-85" /> Sair
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </header>

      {/* grid SÓ a partir de md: no celular o aside some (display:none) e, se o
          grid continuasse, o <main> cairia na primeira faixa de 240px */}
      <div
        className="md:grid transition-[grid-template-columns] duration-200"
        style={{ gridTemplateColumns: recolhido ? "64px 1fr" : "240px 1fr" }}
      >
        <aside className="sticky top-14 hidden h-[calc(100dvh-3.5rem)] flex-col justify-between bg-paper py-4 shadow-card md:flex">
          <nav className="flex flex-col gap-1 px-3">
            {ITENS.map(({ href, rotulo, Icone }) => (
              <Link
                key={href}
                href={href}
                title={recolhido ? rotulo : undefined}
                className={
                  "flex items-center gap-3 rounded-[10px] px-3 py-2.5 text-[13.5px] no-underline transition-colors " +
                  (ativo(href) ? "bg-soft font-semibold text-ink" : `text-ink-soft ${HOVER}hover:bg-soft ${HOVER}hover:text-ink`)
                }
              >
                <Icone size={17} className="shrink-0" />
                {!recolhido ? <span>{rotulo}</span> : null}
              </Link>
            ))}
          </nav>

          <button
            type="button"
            onClick={alternar}
            aria-label={recolhido ? "Expandir menu" : "Recolher menu"}
            className={`mx-3 flex cursor-pointer items-center gap-3 rounded-[10px] px-3 py-2.5 text-[12px] uppercase tracking-[.1em] text-ink-soft ${HOVER}hover:bg-soft`}
          >
            <PanelLeft size={16} className="shrink-0" />
            {!recolhido ? <span>Recolher</span> : null}
          </button>
        </aside>

        <main className="min-w-0 px-5 pb-24 pt-6 md:px-8 md:pb-10">{children}</main>
      </div>

      {/* celular: o menu vira barra embaixo, ao alcance do polegar */}
      <nav className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-around bg-paper pb-[var(--sab)] shadow-[0_-1px_2px_rgba(29,29,27,.06)] md:hidden">
        {ITENS.map(({ href, rotulo, Icone }) => (
          <Link
            key={href}
            href={href}
            className={
              "flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] no-underline " +
              (ativo(href) ? "text-accent" : "text-ink-soft")
            }
          >
            <Icone size={19} />
            {rotulo}
          </Link>
        ))}
      </nav>
    </div>
  );
}

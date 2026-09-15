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
  - No celular a barra de baixo é a navegação inteira: os cinco destinos são os
    mesmos que o computador tem espalhados pelo header e pela lateral. Avisos,
    busca e conta viram tela cheia, porque dropdown no polegar não funciona.
*/
"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { Bell, ChevronRight, FileText, House, LogOut, Menu, PanelLeft, Search, Settings, Users } from "lucide-react";
import { BuscaTopo, TelaBuscaMobile } from "@/components/Busca";
import { DropdownAvisos, TelaAvisosMobile, useAvisos } from "@/components/Notificacoes";
import { TelaMobile, TopoTelaMobile, CorpoTelaMobile } from "@/components/TelaMobile";

const HOVER = "[@media(hover:hover)]:";
const CHAVE_RECOLHIDO = "menu-recolhido";

const ITENS = [
  { href: "/painel", rotulo: "Home", Icone: House },
  { href: "/painel/clientes", rotulo: "Clientes", Icone: Users },
];

/** telas cheias que só existem no celular */
type TelaMobileAberta = null | "avisos" | "busca" | "conta";

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

/** contador vermelho do sino, nos dois lugares em que ele aparece */
function Contador({ quantos, className = "" }: { quantos: number; className?: string }) {
  if (!quantos) return null;
  return (
    <span
      aria-hidden
      className={
        "pointer-events-none absolute flex h-4 min-w-4 items-center justify-center rounded-full " +
        "bg-erro px-1 text-[10px] font-semibold leading-none text-white shadow-[0_0_0_1.5px_var(--color-paper)] " + className
      }
    >
      {quantos > 9 ? "9+" : quantos}
    </span>
  );
}

export function AppShell({ children, nome }: { children: ReactNode; nome?: string }) {
  const caminho = usePathname();
  const router = useRouter();
  const recolhido = useSyncExternalStore(assinarRecolhido, lerRecolhido, () => false);
  const [menuAberto, setMenuAberto] = useState(false);
  const [notifAberto, setNotifAberto] = useState(false);
  const [tela, setTela] = useState<TelaMobileAberta>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const avisos = useAvisos();

  /* Fechar ao tocar FORA, e o "fora" precisa ser medido pelo elemento, não por
     stopPropagation: o App Router hidrata o documento inteiro, então o React e
     este ouvinte moram no mesmo nó e stopPropagation não segura um o outro (só
     stopImmediatePropagation faria isso, e aí quem quebraria era o React). Sem
     a checagem do `contains`, clicar nos três pontos de um aviso fechava o
     dropdown inteiro antes de o clique chegar no botão.
     pointerdown (e não click) porque no toque do iOS o click não dispara em
     área vazia. */
  useEffect(() => {
    if (!menuAberto) return;
    function fora(ev: Event) {
      const alvo = ev.target as Node | null;
      if (alvo && menuRef.current?.contains(alvo)) return;
      setMenuAberto(false);
    }
    document.addEventListener("pointerdown", fora);
    return () => document.removeEventListener("pointerdown", fora);
  }, [menuAberto]);

  useEffect(() => {
    if (!notifAberto) return;
    function fora(ev: Event) {
      const alvo = ev.target as Node | null;
      if (alvo && notifRef.current?.contains(alvo)) return;
      setNotifAberto(false);
    }
    document.addEventListener("pointerdown", fora);
    return () => document.removeEventListener("pointerdown", fora);
  }, [notifAberto]);

  /* Esc fecha o que estiver por cima: primeiro os menus do computador, depois a
     tela cheia do celular */
  useEffect(() => {
    function tecla(ev: KeyboardEvent) {
      if (ev.key !== "Escape") return;
      setMenuAberto(false);
      setNotifAberto(false);
      setTela(null);
    }
    document.addEventListener("keydown", tecla);
    return () => document.removeEventListener("keydown", tecla);
  }, []);

  async function sair() {
    await fetch("/api/sessao", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ acao: "sair" }) });
    router.refresh();
    router.push("/entrar");
  }

  function alternar() { gravarRecolhido(!recolhido); }

  /* Tocar no ícone da tela que já está aberta FECHA. É o que substitui o botão
     X, que nenhuma dessas telas tem de propósito: a barra fica por cima delas,
     então ela é sempre o caminho de volta (mesma decisão do original). */
  function alternarTela(qual: Exclude<TelaMobileAberta, null>) {
    setTela((atual) => (atual === qual ? null : qual));
    if (qual === "avisos" && tela !== "avisos") avisos.aoAbrir();
  }

  function alternarNotifDesktop() {
    const abrir = !notifAberto;
    setNotifAberto(abrir);
    /* abriu = leu: o contador zera na hora, e só depois a lista é atualizada */
    if (abrir) avisos.aoAbrir();
  }

  const ativo = (href: string) =>
    href === "/painel" ? caminho === "/painel" : caminho.startsWith(href);

  /* no celular, quem manda no destaque é a tela cheia aberta; sem nenhuma, a
     rota é que decide */
  const ativoMobile = (href: string) => tela === null && ativo(href);

  const itemNav = "flex flex-1 cursor-pointer flex-col items-center gap-1 py-2.5 text-[11px] no-underline";

  return (
    <div className="min-h-dvh bg-soft">
      <header className="sticky top-0 z-30 grid h-14 grid-cols-[auto_1fr_auto] items-center gap-4 bg-paper px-4 shadow-card">
        <Link href="/painel" className="text-[15px] font-semibold tracking-tight text-ink no-underline">
          {nome ?? "Estúdio"}
        </Link>

        <BuscaTopo />

        <div className="flex items-center gap-1">
          {/* sino: no computador abre o dropdown aqui do lado; no celular ele
              some, porque o mesmo destino já está na barra de baixo */}
          <div ref={notifRef} className="relative hidden md:block">
            <button
              type="button"
              aria-label="Notificações"
              aria-haspopup="true"
              aria-expanded={notifAberto}
              onClick={alternarNotifDesktop}
              className={
                "relative inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-[10px] " +
                (notifAberto ? "bg-soft text-ink" : `text-ink-soft ${HOVER}hover:bg-soft ${HOVER}hover:text-ink`)
              }
            >
              <Bell size={17} />
              <Contador quantos={avisos.naoLidos} className="right-1 top-1" />
            </button>
            {notifAberto ? <DropdownAvisos avisos={avisos} aoFechar={() => setNotifAberto(false)} /> : null}
          </div>

          {/* menu do usuário: fecha com clique fora (pointerdown no document) */}
          <div ref={menuRef} className="relative ml-1 hidden md:block">
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

      {/* telas cheias do celular. Ficam sempre montadas: é o que deixa a entrada
          e a saída deslizarem, em vez de piscarem. */}
      <TelaAvisosMobile avisos={avisos} aberta={tela === "avisos"} aoFechar={() => setTela(null)} />
      <TelaBuscaMobile aberta={tela === "busca"} aoFechar={() => setTela(null)} />
      <TelaContaMobile
        nome={nome}
        aberta={tela === "conta"}
        aoFechar={() => setTela(null)}
        aoSair={sair}
      />

      {/* celular: o menu vira barra embaixo, ao alcance do polegar */}
      <nav className="fixed inset-x-0 bottom-0 z-70 flex items-center justify-around bg-paper pb-[var(--sab)] shadow-[0_-1px_2px_rgba(29,29,27,.06)] md:hidden">
        {ITENS.map(({ href, rotulo, Icone }) => (
          <Link
            key={href}
            href={href}
            onClick={() => setTela(null)}
            className={itemNav + " " + (ativoMobile(href) ? "text-accent" : "text-ink-soft")}
          >
            <Icone size={19} />
            {rotulo}
          </Link>
        ))}

        <button
          type="button"
          aria-label="Notificações"
          onClick={() => alternarTela("avisos")}
          className={itemNav + " " + (tela === "avisos" ? "text-accent" : "text-ink-soft")}
        >
          <span className="relative inline-flex">
            <Bell size={19} />
            <Contador quantos={avisos.naoLidos} className="-right-2 -top-1.5" />
          </span>
          Avisos
        </button>

        <button
          type="button"
          aria-label="Buscar casal"
          onClick={() => alternarTela("busca")}
          className={itemNav + " " + (tela === "busca" ? "text-accent" : "text-ink-soft")}
        >
          <Search size={19} />
          Buscar
        </button>

        <button
          type="button"
          aria-label="Menu da conta"
          onClick={() => alternarTela("conta")}
          className={itemNav + " " + (tela === "conta" ? "text-accent" : "text-ink-soft")}
        >
          <Menu size={19} />
          Menu
        </button>
      </nav>
    </div>
  );
}

/* ---------- menu da conta em tela cheia (celular) ----------
   Portado de `#conta-mobile`. No computador o mesmo conteúdo é o dropdown do
   avatar; aqui ele ganha a tela toda porque é onde cabe o toque.
   O cartão escuro do topo é o do original, sem o nome do plano: por enquanto
   este produto não tem planos, e um selo inventado seria mentira na tela. */
function TelaContaMobile({
  nome, aberta, aoFechar, aoSair,
}: { nome?: string; aberta: boolean; aoFechar: () => void; aoSair: () => void }) {
  const item = "flex w-full cursor-pointer items-center gap-3 rounded-xl px-1.5 py-4 text-left text-[15.5px] text-ink no-underline active:opacity-60";
  const aba = aberta ? 0 : -1;

  return (
    <TelaMobile aberta={aberta} rotulo="Menu da conta">
      <TopoTelaMobile>
        <h2 className="flex-1 text-[26px] font-bold text-ink">Menu</h2>
      </TopoTelaMobile>

      <CorpoTelaMobile>
        <div className="mb-5 flex items-center gap-4 rounded-[26px] bg-[linear-gradient(150deg,#161616,#0b0b0b_55%,#000)] p-[18px] text-white shadow-[0_6px_16px_rgba(0,0,0,.18)]">
          <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-white/10 text-[22px] font-semibold text-white shadow-[0_0_0_2px_rgba(255,255,255,.14)]">
            {(nome ?? "E").slice(0, 1).toUpperCase()}
          </span>
          <div className="min-w-0">
            <div className="truncate text-[24px] font-semibold text-white">{nome ?? "Conta"}</div>
            <div className="mt-0.5 text-[12px] text-white/60">Seu estúdio</div>
          </div>
        </div>

        <Link href="/painel/configuracoes/contrato" tabIndex={aba} onClick={aoFechar} className={item}>
          <FileText size={19} className="shrink-0 text-ink-soft" />
          Contrato e assinatura
          <ChevronRight size={18} className="ml-auto shrink-0 text-line" />
        </Link>
        <Link href="/painel/configuracoes" tabIndex={aba} onClick={aoFechar} className={item}>
          <Settings size={19} className="shrink-0 text-ink-soft" />
          Configurações
          <ChevronRight size={18} className="ml-auto shrink-0 text-line" />
        </Link>
        <button type="button" tabIndex={aba} onClick={aoSair} className={item + " text-erro"}>
          <LogOut size={19} className="shrink-0 text-erro" />
          Sair
        </button>
      </CorpoTelaMobile>
    </TelaMobile>
  );
}

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
/* eslint-disable @next/next/no-img-element */
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
/* Foto do fotógrafo no avatar. Hoje é arquivo fixo, como o resto da marca dele
   (ver "Nome e marca" nas dívidas do CLAUDE.md); quando houver mais de um
   estúdio, sai daqui pro perfil. */
const FOTO_PERFIL = "/img/jordan-perfil.webp";
/* Raio da pastilha da marca, num lugar só: ele vale pro ícone quadrado que
   aparece com a lateral recolhida E pro fundo que acende no hover da faixa. Os
   dois PRECISAM casar, então não podem ser dois literais. */
const RAIO_MARCA = "rounded-md";

/* Cor de fundo do ÍCONE da marca, amostrada do pixel do próprio arquivo
   (public/img/icone-192.png). Não é o token `accent` (#003646): o ícone é
   #003344, dois pontos abaixo. A diferença é invisível isolada, mas com a
   lateral recolhida a pastilha fica DENTRO do fundo do hover, e aí os dois
   pontos viram um contorno visível em volta dela. Como isto é cor de ARTE, não
   de interface, ela mora aqui junto do arquivo de onde saiu, e não no tema. */
const FUNDO_MARCA = "#003344";

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

  /* A revisão do contrato traz a PRÓPRIA navegação (voltar, abas de assinantes
     e histórico) e é uma tela de leitura de documento, então a navegação do app
     sai de cena ali: menu lateral e barra de baixo são a mesma coisa em dois
     tamanhos, some com os dois ou com nenhum. No estúdio original essa tela era
     um arquivo separado, sem shell nenhum. */
  const semNavegacao = /^\/painel\/clientes\/[^/]+\/contrato(\/|$)/.test(caminho);

  /* No celular a Home não leva cabeçalho: ali ele só carregaria a logo (busca,
     sino e conta já vivem na barra de baixo), e uma faixa de 56px só com a
     marca é espaço que a saudação e os indicadores usam melhor. Quem abre a
     Home já sabe de quem é o app. No computador ele continua, porque lá é onde
     moram a busca e os menus. */
  const semCabecalhoNoCelular = caminho === "/painel";

  /* Largura do menu, num lugar só: o cabeçalho usa pra alinhar a logo com a
     lateral, e a grade usa pra abrir a coluna. Antes eram dois literais
     soltos, e alinhar um sem o outro era questão de tempo. */
  const larguraMenu = recolhido ? 62 : 190;

  /* no celular, quem manda no destaque é a tela cheia aberta; sem nenhuma, a
     rota é que decide */
  const ativoMobile = (href: string) => tela === null && ativo(href);

  const itemNav = "flex flex-1 cursor-pointer flex-col items-center gap-1 py-2.5 text-[11px] no-underline";

  /* Sem navegação nenhuma, a moldura vira uma casca vazia: devolve a página
     crua, que é o que a revisão do contrato era no estúdio original. */
  if (semNavegacao) {
    return (
      <div className="min-h-dvh bg-soft">
        {/* mesmo respiro do <main> das outras telas: sem ele o título encostava
            no topo da janela */}
        <main className="min-w-0 px-5 pb-10 pt-6 md:px-8">{children}</main>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-soft">

      {/* grid SÓ a partir de md: no celular o aside some (display:none) e, se o
          grid continuasse, o conteúdo cairia na faixa do menu */}
      <div
        className="md:grid transition-[grid-template-columns] duration-200"
        style={{ gridTemplateColumns: larguraMenu + "px 1fr" }}
      >
        {/* Menu escuro (--noir), como no estúdio original: ele não disputa com o
            conteúdo, que é todo claro, e some do caminho sem precisar de borda.
            Os itens ficam CENTRADOS na vertical (justify-center num flex-1):
            com duas entradas só, empilhadas no topo, sobrava um vazio enorme
            embaixo. */}
        <aside className="sticky top-0 hidden h-dvh flex-col gap-3.5 bg-noir px-3 pb-6 text-white md:flex">
          {/* A MARCA VIVE AQUI, não no cabeçalho (decisão de 16/09/2026, e é uma
              divergência consciente do estúdio original, onde o cabeçalho
              atravessava a tela e a lateral começava abaixo dele). Com a marca
              dentro da lateral não existe mais nada pra alinhar entre as duas,
              e o bloco escuro vira uma coluna contínua em vez de ser cortado
              por uma faixa branca em cima.
              A faixa tem a mesma altura do cabeçalho (h-14) pra a marca e a
              busca nascerem na mesma linha. */}
          {/* A FAIXA DA MARCA É O BOTÃO DE RECOLHER: em repouso ela mostra a
              marca, e no hover a marca dá lugar ao ícone. Assim o controle não
              ocupa lugar nenhum enquanto não é procurado, e some aquele botão
              solto no rodapé da lateral.

              Os dois ficam empilhados no mesmo lugar (`absolute`), trocando só
              a opacidade: se um substituísse o outro no fluxo, a faixa mudaria
              de largura no hover e a lateral tremeria.

              Não é mais link pro início: "Home" é o primeiro item do menu, logo
              abaixo, então o atalho não se perde.

              O `group-hover` aqui vai SEM o prefixo `[@media(hover:hover)]:`
              que o resto do arquivo usa, e não é descuido: no Tailwind 4 o
              `hover` JÁ nasce dentro de `@media (hover: hover)`. Conferido
              lendo o CSS servido: as 41 classes de hover do app, com prefixo ou
              sem, caem todas dentro desse bloco. O prefixo virou redundante
              quando o projeto foi pra v4; ele continua no resto do arquivo
              porque trocar é varredura pra outra hora. */}
          <button
            type="button"
            onClick={alternar}
            aria-label={recolhido ? "Expandir menu" : "Recolher menu"}
            title={recolhido ? "Expandir menu" : "Recolher menu"}
            style={{ ["--fundo-marca" as string]: FUNDO_MARCA }}
            className={
              "group relative flex h-14 shrink-0 cursor-pointer items-center justify-center " +
              "overflow-hidden transition-colors " + RAIO_MARCA +
              " hover:bg-[var(--fundo-marca)]"
            }
          >
            <img
              src={recolhido ? "/img/icone-192.png" : "/img/logo-principal-offwhite.png"}
              alt={nome ?? "Estúdio"}
              className={
                "block object-contain transition-opacity duration-150 " +
                (recolhido ? "h-8 w-8 " + RAIO_MARCA : "h-7 w-auto max-w-full") +
                " group-hover:opacity-0"
              }
            />
            <span
              aria-hidden
              className="absolute inset-0 flex items-center justify-center text-white/90 opacity-0 transition-opacity duration-150 group-hover:opacity-100"
            >
              <PanelLeft size={17} className={recolhido ? "rotate-180" : ""} />
            </span>
          </button>

          <nav className="flex flex-1 flex-col justify-center gap-[3px]">
            {ITENS.map(({ href, rotulo, Icone }) => (
              <Link
                key={href}
                href={href}
                title={recolhido ? rotulo : undefined}
                className={
                  "flex items-center gap-[11px] overflow-hidden whitespace-nowrap rounded-[10px] py-[9px] text-[13px] font-medium tracking-[.01em] no-underline transition-colors " +
                  (recolhido ? "justify-center px-0 " : "px-3 ") +
                  (ativo(href)
                    ? "bg-white/12 text-white"
                    : `text-white/60 ${HOVER}hover:bg-white/8 ${HOVER}hover:text-white`)
                }
              >
                <Icone size={15} className="shrink-0" />
                {!recolhido ? <span>{rotulo}</span> : null}
              </Link>
            ))}
          </nav>

        </aside>

        {/* coluna do conteúdo: o cabeçalho mora AQUI dentro, então ele começa
            depois da lateral em vez de passar por cima dela */}
        <div className="flex min-w-0 flex-col">
        {/* O cabeçalho cobre só a COLUNA DO CONTEÚDO: a lateral vai do topo ao
            rodapé e leva a marca junto. Por isso a busca centraliza no conteúdo,
            que é onde ela procura, e não na janela inteira.
            Flex e não grid: no computador a logo some daqui e o flex fecha o
            buraco sozinho, sem coluna fantasma. */}
        <header
          className={
            "sticky top-0 z-30 h-14 items-center gap-4 bg-paper px-4 shadow-card " +
            (semCabecalhoNoCelular ? "hidden md:flex" : "flex")
          }
        >
          {/* no celular não existe lateral, então a marca vive aqui */}
          <Link
            href="/painel"
            aria-label="Ir pro início do estúdio"
            className="flex shrink-0 items-center no-underline md:hidden"
          >
            <img
              src="/img/logo-principal-petroleo.png"
              alt={nome ?? "Estúdio"}
              className="block h-7 w-auto object-contain"
            />
          </Link>

          <BuscaTopo />

          <div className="flex shrink-0 items-center gap-1">
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
                  "transition-[transform,box-shadow,background-color] duration-200 ease-[cubic-bezier(.34,1.4,.5,1)] active:scale-[1.02] " +
                  (notifAberto
                    ? "scale-[1.08] bg-soft text-ink shadow-[0_5px_16px_rgba(29,29,27,.18)]"
                    : `text-ink-soft ${HOVER}hover:scale-[1.08] ${HOVER}hover:bg-soft ${HOVER}hover:text-ink ${HOVER}hover:shadow-[0_5px_16px_rgba(29,29,27,.18)]`)
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
                className="inline-flex cursor-pointer items-center justify-center rounded-full bg-transparent p-0"
              >
                {/* Sem anel (regra da casa). O retorno é um pop com sombra atrás,
                    no hover e com o menu aberto, e o mesmo vale pro sino. */}
                <img
                  src={FOTO_PERFIL}
                  alt={nome ?? "Conta"}
                  className={
                    "block h-[38px] w-[38px] rounded-full object-cover transition-[transform,box-shadow] duration-200 ease-[cubic-bezier(.34,1.4,.5,1)] " +
                    (menuAberto ? "scale-[1.08] shadow-[0_5px_16px_rgba(29,29,27,.24)] " : "") +
                    `${HOVER}hover:scale-[1.08] ${HOVER}hover:shadow-[0_5px_16px_rgba(29,29,27,.24)] active:scale-[1.02]`
                  }
                />
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
        {/* sem cabeçalho no celular, é o <main> que precisa descer abaixo da
            barra de status do iPhone: era o cabeçalho quem segurava esse
            respiro (--sat só devolve valor por causa do viewport-fit=cover) */}
          <main
            className={
              "min-w-0 px-5 pb-24 md:px-8 md:pb-10 md:pt-6 " +
              (semCabecalhoNoCelular ? "pt-[calc(1.5rem+var(--sat))]" : "pt-6")
            }
          >
            {children}
          </main>
        </div>
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
      <nav className={
        "fixed inset-x-0 bottom-0 z-70 items-center justify-around bg-paper pb-[var(--sab)] shadow-[0_-1px_2px_rgba(29,29,27,.06)] md:hidden " +
        (semNavegacao ? "hidden" : "flex")
      }>
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

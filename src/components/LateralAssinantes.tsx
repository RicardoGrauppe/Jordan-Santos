"use client";
/*
  Coluna "Assinantes / Histórico" do contrato. UMA só, usada pelas duas telas
  que mostram o documento: a revisão do painel (quem olha é o Jordan) e
  /assinar (quem olha é o casal).

  Antes eram duas cópias. Mesmo conteúdo, duas formas: aqui uma coluna branca
  colada na esquerda, de altura cheia e canto reto; lá um cartão flutuante.
  Como não havia código em comum, cada ajuste num lado afastava o outro, e as
  duas peças chegaram a ter até o fundo do cartão de assinante diferente
  (#FAF8F6 contra #F7F9FA) sem ninguém ter decidido isso.

  A forma que ficou é a do painel, a pedido do Ricardo: cartão flutuante,
  cantos generosos, sem peso. No celular ele vira gaveta pela direita, que é
  a mesma gaveta que as duas telas já tinham.

  PELE POR VARIÁVEL, que é o que permite uma peça só:
  este arquivo não escreve cor nenhuma na mão. Tudo sai dos utilitários do
  Tailwind, que leem `--color-*`. O painel usa os tokens do brandbook; a
  /assinar redefine esses mesmos tokens no seu escopo `.ass` (papel quente,
  linha quente) e a coluna inteira veste a marca sem saber que existe marca.
  Fonte idem: nada de `font-*` aqui, o texto herda Inter no painel e Jost na
  tela do casal.

  Estado que mora aqui: qual aba está aberta e quais assinantes estão
  expandidos. É estado da peça, não da página. Já a gaveta (`aberta`) vem de
  fora, porque quem abre é um botão do cabeçalho de cada tela.
*/

import { useState, type ReactNode } from "react";
import { Check, ChevronDown, Clock, History, User, Users } from "lucide-react";
import { Selo } from "@/components/ui";

export type DetalheAssinante = { rotulo: string; valor: string };

export type AssinanteLateral = {
  nome: string;
  /** true = já assinou; muda o tom do selo e o ícone */
  assinado: boolean;
  /** texto do selo: "Assinado", "Pendente", "Abriu o link"… */
  situacao: string;
  detalhes: DetalheAssinante[];
};

export type EventoLateral = { titulo: string; quando: string };

export type ItemAuditoria = {
  rotulo: string;
  valor: string;
  /** hash, IP e user agent: caixinha monoespaçada, peso normal */
  tecnico?: boolean;
};

export function LateralAssinantes({
  aberta,
  aoFechar,
  topo,
  assinantes,
  eventos,
  auditoria,
}: {
  aberta: boolean;
  aoFechar: () => void;
  /** o que vai acima das abas: a logo em /assinar, o "Voltar" no painel */
  topo: ReactNode;
  assinantes: AssinanteLateral[];
  eventos: EventoLateral[];
  auditoria?: ItemAuditoria[] | null;
}) {
  const [aba, setAba] = useState<"assinantes" | "historico">("assinantes");
  const [expandidos, setExpandidos] = useState<Record<string, boolean>>({});

  return (
    <>
      {/* Escurecido da gaveta: só existe no celular. Acima de 60, que é onde
          mora o botão flutuante de assinar nas duas telas: gaveta aberta tem
          que cobrir o botão, senão ele fica boiando por cima do conteúdo que
          a pessoa acabou de abrir. */}
      <div
        className={
          "fixed inset-0 z-[65] bg-[rgba(29,29,27,.35)] transition-opacity duration-200 xl:hidden " +
          (aberta ? "opacity-100" : "pointer-events-none opacity-0")
        }
        onClick={aoFechar}
      />

      <aside
        aria-label="Assinantes e histórico"
        className={
          /* celular: gaveta pela direita, arredondada só do lado que aparece */
          "fixed inset-y-0 right-0 z-[70] w-[min(340px,88vw)] overflow-y-auto rounded-l-[22px] bg-paper pt-[var(--sat)] shadow-alta transition-transform duration-200 " +
          (aberta ? "translate-x-0" : "translate-x-full") +
          /* daí pra cima: cartão que acompanha a rolagem e tem a altura do
             próprio conteúdo, nunca a da tela */
          " xl:sticky xl:inset-auto xl:top-6 xl:z-auto xl:max-h-[calc(100dvh-3rem)] xl:w-auto xl:translate-x-0 xl:rounded-[22px] xl:pt-0 xl:shadow-card"
        }
      >
        <div className="sticky top-0 z-[5] bg-paper">
          <div className="flex items-center gap-3.5 px-4 pb-3.5 pt-4">{topo}</div>

          {/* Abas SUBLINHADAS: trilho de um fio sob a faixa inteira (sombra
              interna, não borda) e traço de 2px sob a ativa. A pílula que já
              existiu aqui competia com o cartão branco em volta e parecia
              botão solto: aba é uma faixa onde uma está marcada. */}
          <div role="tablist" className="flex shadow-[inset_0_-1px_0_var(--color-line)]">
            {([["assinantes", "Assinantes", Users], ["historico", "Histórico", History]] as const).map(
              ([chave, rotulo, Icone]) => (
                <button
                  key={chave}
                  type="button"
                  role="tab"
                  aria-selected={aba === chave}
                  onClick={() => setAba(chave)}
                  className={
                    "relative inline-flex flex-1 cursor-pointer items-center justify-center gap-1.5 px-2 py-3.5 text-[13px] tracking-[.03em] transition-colors " +
                    (aba === chave
                      ? "font-medium text-accent after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:rounded-t-sm after:bg-accent"
                      : "text-ink-soft hover:bg-line hover:text-accent")
                  }
                >
                  <Icone size={15} />
                  {rotulo}
                </button>
              ),
            )}
          </div>
        </div>

        {aba === "assinantes" ? (
          <div className="p-4">
            {assinantes.map((a) => (
              <CartaoAssinante
                key={a.nome + a.situacao}
                assinante={a}
                aberto={!!expandidos[a.nome]}
                onToggle={() => setExpandidos((v) => ({ ...v, [a.nome]: !v[a.nome] }))}
              />
            ))}
          </div>
        ) : (
          <div className="p-4">
            <ol className="relative m-0 list-none p-0 pl-5">
              {eventos.length ? (
                eventos.map((e) => (
                  <li
                    key={e.titulo}
                    className="relative pb-5 text-[12.5px] before:absolute before:-left-5 before:top-[3px] before:h-[9px] before:w-[9px] before:rounded-full before:bg-accent before:shadow-[0_0_0_2px_var(--color-paper)] before:content-[''] after:absolute after:-bottom-2 after:-left-4 after:top-3 after:w-px after:bg-line after:content-[''] last:after:hidden"
                  >
                    <div className="font-medium text-ink">{e.titulo}</div>
                    <div className="mt-0.5 text-ink-soft">{e.quando}</div>
                  </li>
                ))
              ) : (
                <li className="pl-0.5 text-[12.5px] text-ink-soft">Sem eventos ainda.</li>
              )}
            </ol>

            {auditoria?.length ? (
              <div className="mt-3.5 rounded-2xl bg-soft p-4 text-[12px]">
                <div className="mb-3 text-[11px] uppercase tracking-[.06em] text-ink-soft">
                  Trilha de auditoria da assinatura
                </div>
                <dl className="m-0 flex flex-col">
                  {auditoria.map((item) => (
                    <LinhaAuditoria key={item.rotulo} {...item} />
                  ))}
                </dl>
              </div>
            ) : null}
          </div>
        )}
      </aside>
    </>
  );
}

/* Cartão do assinante: fundo um passo abaixo do papel e SEM sombra. Ele já
   está dentro de um cartão elevado, e empilhar elevação dentro de elevação é
   o que deixava a coluna pesada. */
function CartaoAssinante({
  assinante,
  aberto,
  onToggle,
}: {
  assinante: AssinanteLateral;
  aberto: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="mb-2.5 overflow-hidden rounded-2xl bg-soft last:mb-0">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={aberto}
        className="flex w-full cursor-pointer items-center gap-2.5 px-3.5 py-[13px] text-left"
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-tint text-accent">
          <User size={16} />
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-px">
          <span className="text-[10px] uppercase tracking-[.06em] text-ink-soft">Assinante</span>
          <span className="truncate text-[13.5px] font-medium text-ink">{assinante.nome}</span>
        </span>
        <Selo tom={assinante.assinado ? "ok" : "atencao"}>
          <span className="inline-flex items-center gap-1 uppercase">
            {assinante.assinado ? <Check size={11} strokeWidth={2.5} /> : <Clock size={11} strokeWidth={2} />}
            {assinante.situacao}
          </span>
        </Selo>
        <ChevronDown
          size={14}
          className={"shrink-0 text-ink-soft transition-transform duration-200 " + (aberto ? "rotate-180" : "")}
        />
      </button>

      {/* aberto, o detalhe é uma folha branca dentro do cartão: separa por
          tom, do jeito da casa, sem precisar de linha nem de sombra */}
      {aberto ? (
        <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-2.5 gap-y-[5px] bg-paper px-3.5 pb-3.5 pt-3 text-[12.5px]">
          {assinante.detalhes.map((d) => (
            <div key={d.rotulo} className="contents">
              <dt className="text-ink-soft">{d.rotulo}</dt>
              <dd className="m-0 break-words text-ink">{d.valor}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </div>
  );
}

/* rótulo em cima, valor embaixo: dispositivo e hash são longos demais pra
   coluna estreita. dt é metadado (pequeno, cinza), dd é o dado de verdade. */
function LinhaAuditoria({ rotulo, valor, tecnico }: ItemAuditoria) {
  return (
    <>
      <dt className="mt-4 text-[10px] font-medium uppercase tracking-[.06em] text-ink-soft first:mt-0">{rotulo}</dt>
      <dd
        className={
          "m-0 mt-[5px] " +
          (tecnico
            ? "break-all rounded-xl bg-paper px-2.5 py-[9px] font-mono text-[10.5px] leading-[1.6] text-ink"
            : "break-words text-[13.5px] font-medium leading-[1.5] text-ink")
        }
      >
        {valor}
      </dd>
    </>
  );
}

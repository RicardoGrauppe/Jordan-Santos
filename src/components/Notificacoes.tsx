/*
  Os avisos do sino, nos dois formatos: dropdown no computador e tela cheia no
  celular. Portado de `renderNotificacoes` e da tela `#notif-mobile` do
  estudio.html do Jordan.

  A lógica (o que é aviso, o que é novidade, o que já foi visto) mora em
  `lib/notificacoes.ts`. Aqui é só a cara e o gesto.

  Decisões herdadas do original:
  - Abrir os avisos JÁ é ter visto: o contador zera no clique, sobre a lista que
    está na tela, sem esperar a resposta do servidor. Rede lenta não pode
    deixar o "3" pendurado no sino depois de você ter lido tudo.
  - Cada aviso desliza pra a esquerda e revela duas ações atrás dele, estilo
    WhatsApp: marcar como não lida e apagar. No computador quem abre é o botão
    de três pontos; no celular também dá pra arrastar com o dedo.
  - Aviso aberto se recolhe sozinho depois de um tempo, senão fica um item
    torto na tela esperando um toque que não vem.
  - Os pills de filtro só existem no celular. No computador o dropdown é curto
    e mostra tudo.

  Acrescentado aqui: aviso não lido tem fundo próprio. No original "marcar como
  não lida" só mexia no contador, e quem fazia isso num aviso não via nada
  acontecer no item.
*/
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bell, Calendar, FileCheck2, FileText, Mail, MailCheck, Trash2, UserPlus,
} from "lucide-react";
import { TelaMobile, TopoTelaMobile, CorpoTelaMobile } from "@/components/TelaMobile";
import { Deslizar } from "@/components/Deslizar";
import { abastecerCache } from "@/lib/busca";
import type { ClienteLista } from "@/lib/painel";
import {
  AVISOS_VAZIO, FILTROS_AVISO, buscarClientesDosAvisos, carregarAvisos, gravarAvisos,
  montarNotificacoes, passaFiltro,
  type Aviso, type EstadoAvisos, type FiltroAviso, type TipoAviso,
} from "@/lib/notificacoes";

/** largura das duas ações escondidas atrás do aviso (88 + 88) */
/** tempo até um aviso deslizado se recolher sozinho */

/* ---------- estado compartilhado (sino, dropdown e tela cheia) ---------- */

export type Avisos = {
  lista: Aviso[];
  naoLidos: number;
  ehNaoLido: (a: Aviso) => boolean;
  filtro: FiltroAviso;
  definirFiltro: (f: FiltroAviso) => void;
  /** chamar quando os avisos são abertos: zera o contador e busca o que há de novo */
  aoAbrir: () => void;
  marcarTodasComoLidas: () => void;
  marcarComoNaoLida: (a: Aviso) => void;
  apagar: (a: Aviso) => void;
};

export function useAvisos(): Avisos {
  const [clientes, setClientes] = useState<ClienteLista[]>([]);
  const [estado, setEstado] = useState<EstadoAvisos>(AVISOS_VAZIO);
  const [filtro, setFiltro] = useState<FiltroAviso>("todas");
  const montado = useRef(true);

  useEffect(() => {
    montado.current = true;
    return () => { montado.current = false; };
  }, []);

  /* o estado de vistos/apagados vem do servidor (com o cache local por baixo);
     escrever no estado só acontece no callback, com a guarda de montado */
  useEffect(() => {
    let vivo = true;
    carregarAvisos().then((e) => { if (vivo) setEstado(e); });
    return () => { vivo = false; };
  }, []);

  const recarregarClientes = useCallback(() => {
    buscarClientesDosAvisos().then((l) => {
      if (!l || !montado.current) return;
      setClientes(l);
      /* a busca do topo usa a mesma lista: já que ela veio fresca, aproveita */
      abastecerCache(l);
    });
  }, []);

  useEffect(() => {
    let vivo = true;
    buscarClientesDosAvisos().then((l) => {
      if (!l || !vivo) return;
      setClientes(l);
      abastecerCache(l);
    });
    return () => { vivo = false; };
  }, []);

  /* apagados saem antes de tudo: somem da lista e do contador */
  const lista = useMemo(() => {
    const fora = new Set(estado.apagados);
    return montarNotificacoes(clientes).filter((n) => !fora.has(n.chave));
  }, [clientes, estado.apagados]);

  const vistos = useMemo(() => new Set(estado.vistos), [estado.vistos]);
  const ehNaoLido = useCallback((a: Aviso) => !vistos.has(a.chave), [vistos]);
  const naoLidos = useMemo(() => lista.filter((n) => !vistos.has(n.chave)).length, [lista, vistos]);

  const aplicar = useCallback((novo: EstadoAvisos) => {
    setEstado(novo);
    gravarAvisos(novo);
  }, []);

  /* marcar tudo como visto também poda as chaves de avisos que já nem existem */
  const marcarTodasComoLidas = useCallback(() => {
    aplicar({ vistos: lista.map((n) => n.chave), apagados: estado.apagados });
  }, [aplicar, lista, estado.apagados]);

  const aoAbrir = useCallback(() => {
    marcarTodasComoLidas();
    recarregarClientes();
  }, [marcarTodasComoLidas, recarregarClientes]);

  const marcarComoNaoLida = useCallback((a: Aviso) => {
    aplicar({ vistos: estado.vistos.filter((k) => k !== a.chave), apagados: estado.apagados });
  }, [aplicar, estado]);

  const apagar = useCallback((a: Aviso) => {
    if (estado.apagados.includes(a.chave)) return;
    aplicar({ vistos: estado.vistos, apagados: [...estado.apagados, a.chave] });
  }, [aplicar, estado]);

  return { lista, naoLidos, ehNaoLido, filtro, definirFiltro: setFiltro, aoAbrir, marcarTodasComoLidas, marcarComoNaoLida, apagar };
}

/* ---------- um aviso da lista ---------- */

const ICONE: Record<TipoAviso, typeof Bell> = {
  proposta: UserPlus, prazo: Calendar, contrato: FileText, assinado: FileCheck2,
};

const TOM_ICONE: Record<TipoAviso, string> = {
  proposta: "bg-accent-tint text-accent",
  prazo: "bg-[#FBEBD0] text-[#C08A2D]",
  contrato: "bg-ok-tint text-ok",
  assinado: "bg-ok-tint text-ok",
};

/* Cada aviso é uma linha que desliza (o mesmo componente da Home e das
   pendências). O `Deslizar` já cuida de: um aberto por vez em toda a tela,
   recolher sozinho em 3,5s, engolir o clique depois do arraste, e o primeiro
   toque na linha aberta só recolher. Antes isto vivia duplicado aqui dentro,
   com o "quem está aberto" subindo pra lista; duas cópias do mesmo gesto iam
   divergir na primeira correção que alguém fizesse só num lado. */
function ItemAviso({
  aviso, naoLido, grande, aoEscolher, aoMarcarNaoLida, aoApagar,
}: {
  aviso: Aviso;
  naoLido: boolean;
  /** na tela cheia do celular o item respira mais que no dropdown */
  grande?: boolean;
  aoEscolher: (a: Aviso) => void;
  aoMarcarNaoLida: (a: Aviso) => void;
  aoApagar: (a: Aviso) => void;
}) {
  const Icone = ICONE[aviso.tipo];

  return (
    <Deslizar
      className={grande ? "" : "rounded-xl"}
      rotuloOpcoes="Opções do aviso"
      classeFrente={
        (grande ? "px-1.5 " : "px-1.5 ") +
        (naoLido ? `bg-accent-tint hover:bg-[#dfe9ec]` : `bg-paper hover:bg-soft`)
      }
      acoes={[
        {
          chave: "nao-lida",
          rotulo: "Não lida",
          icone: <Mail size={17} />,
          classe: `bg-accent hover:bg-accent-hover`,
          aoAcionar: () => aoMarcarNaoLida(aviso),
        },
        {
          chave: "apagar",
          rotulo: "Apagar",
          icone: <Trash2 size={17} />,
          classe: `bg-erro hover:brightness-90`,
          aoAcionar: () => aoApagar(aviso),
        },
      ]}
    >
      <button
        type="button"
        onClick={() => aoEscolher(aviso)}
        className={"flex min-w-0 flex-1 cursor-pointer items-start gap-3 bg-transparent text-left " + (grande ? "py-3.5" : "py-2.5")}
      >
        <span className={"mt-px flex h-8 w-8 shrink-0 items-center justify-center rounded-[11px] " + TOM_ICONE[aviso.tipo]}>
          <Icone size={16} />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-[13.5px] font-semibold leading-[1.35] text-ink">{aviso.titulo}</span>
          <span className="mt-0.5 block truncate text-[12.5px] leading-[1.4] text-ink-soft">{aviso.sub}</span>
        </span>
      </button>
    </Deslizar>
  );
}

/* ---------- a lista, usada pelos dois formatos ---------- */

function ListaAvisos({
  avisos, itens, grande, aoEscolher,
}: { avisos: Avisos; itens: Aviso[]; grande?: boolean; aoEscolher: () => void }) {
  const router = useRouter();

  if (!itens.length) {
    const temAlgo = avisos.lista.length > 0;
    return (
      <div className="px-4 py-9 text-center text-[13.5px] text-ink-soft">
        {temAlgo ? "Nada nesse filtro." : "Tudo em dia. Nenhuma novidade por aqui."}
      </div>
    );
  }

  return (
    <div className={grande ? "" : "p-1.5"}>
      {itens.map((n) => (
        <ItemAviso
          key={n.chave}
          aviso={n}
          grande={grande}
          naoLido={avisos.ehNaoLido(n)}
          aoEscolher={(a) => { aoEscolher(); router.push("/painel/clientes/" + a.cid); }}
          aoMarcarNaoLida={avisos.marcarComoNaoLida}
          aoApagar={avisos.apagar}
        />
      ))}
    </div>
  );
}

/* ---------- computador: dropdown sob o sino ---------- */

export function DropdownAvisos({ avisos, aoFechar }: { avisos: Avisos; aoFechar: () => void }) {
  return (
    <div
      onPointerDown={(e) => e.stopPropagation()}
      className="absolute right-0 top-11 z-40 w-[340px] max-w-[88vw] overflow-hidden rounded-2xl bg-paper "
    >
      <div className="flex items-center justify-between gap-3 px-4 pb-1 pt-3">
        <span className="text-[19px] font-bold text-ink">Notificações</span>
        <button
          type="button"
          title="Marcar todas como lidas"
          aria-label="Marcar todas como lidas"
          onClick={avisos.marcarTodasComoLidas}
          className={`flex h-[30px] w-[30px] cursor-pointer items-center justify-center rounded-full text-accent hover:bg-soft`}
        >
          <MailCheck size={17} />
        </button>
      </div>
      <div className="max-h-[min(56vh,400px)] overflow-y-auto">
        <ListaAvisos avisos={avisos} itens={avisos.lista} aoEscolher={aoFechar} />
      </div>
    </div>
  );
}

/* ---------- celular: tela cheia com filtros e sheet de ações ---------- */

export function TelaAvisosMobile({ avisos, aberta, daEsquerda, aoFechar }: { avisos: Avisos; aberta: boolean; daEsquerda?: boolean; aoFechar: () => void }) {
  const [sheet, setSheet] = useState(false);
  const visiveis = useMemo(
    () => avisos.lista.filter((n) => passaFiltro(n, avisos.filtro)),
    [avisos.lista, avisos.filtro],
  );
  /* a tela fechou por baixo (gesto na barra de navegação): o sheet vai junto,
     sem precisar de um efeito só pra sincronizar dois estados */
  const sheetAberto = sheet && aberta;

  return (
    <>
      <TelaMobile aberta={aberta} daEsquerda={daEsquerda} rotulo="Notificações">
        <TopoTelaMobile>
          <h2 className="flex-1 text-[26px] font-bold text-ink">Notificações</h2>
          <button
            type="button"
            aria-label="Ações dos avisos"
            aria-haspopup="true"
            onClick={() => setSheet(true)}
            className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full bg-soft text-accent active:bg-line active:text-ink"
          >
            <MailCheck size={20} />
          </button>
        </TopoTelaMobile>

        <div className="flex shrink-0 gap-2 px-3.5 pb-3">
          {FILTROS_AVISO.map((f) => (
            <button
              key={f.valor}
              type="button"
              onClick={() => avisos.definirFiltro(f.valor)}
              className={
                "cursor-pointer rounded-full px-4 py-1.5 text-[13px] font-semibold " +
                (avisos.filtro === f.valor ? "bg-accent text-white" : "bg-soft text-ink-soft")
              }
            >
              {f.rotulo}
            </button>
          ))}
        </div>

        <CorpoTelaMobile className="pt-0">
          <ListaAvisos avisos={avisos} itens={visiveis} grande aoEscolher={aoFechar} />
        </CorpoTelaMobile>
      </TelaMobile>

      {/* mini sheet de ações, sobe de baixo pra cima por cima de tudo */}
      <div className={"fixed inset-0 z-80 flex items-end md:hidden " + (sheetAberto ? "visible" : "invisible")}>
        <button
          type="button"
          aria-label="Fechar ações"
          onClick={() => setSheet(false)}
          className={"absolute inset-0 cursor-default bg-black/35 transition-opacity duration-[260ms] " + (sheetAberto ? "opacity-100" : "opacity-0")}
        />
        <div
          className={
            "relative w-full rounded-t-[22px] bg-paper px-2.5 pb-[calc(14px+var(--sab))] pt-2  " +
            "transition-transform duration-[260ms] ease-[cubic-bezier(.22,.61,.36,1)] " + (sheetAberto ? "translate-y-0" : "translate-y-full")
          }
        >
          <div aria-hidden className="mx-auto mb-2 mt-1.5 h-1 w-9 rounded-full bg-line" />
          <button
            type="button"
            tabIndex={sheetAberto ? 0 : -1}
            onClick={() => { avisos.marcarTodasComoLidas(); setSheet(false); }}
            className="flex w-full cursor-pointer items-center gap-3.5 rounded-2xl px-3.5 py-4 text-[15.5px] text-ink active:bg-soft"
          >
            <MailCheck size={20} className="shrink-0 text-ink-soft" />
            Marcar todas como lidas
          </button>
        </div>
      </div>
    </>
  );
}

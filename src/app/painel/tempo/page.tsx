/*
  Previsão do tempo. Portada da <div id="pagina-tempo"> do estudio.html
  (carregarTempo / renderTempo / iniciarRolagemHoras).

  Quatro blocos, na ordem em que o fotógrafo pergunta: como está agora, como
  vai estar a luz hoje, as próximas horas e os próximos dias. Todo o cálculo
  mora em lib/tempo.ts; aqui só se desenha.

  A regra de carregamento é a mesma do resto do painel: nada aparece até a
  previsão inteira voltar, e o estado é escrito no callback do loader (nunca no
  corpo do efeito).
*/
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import {
  ArrowDownUp, CalendarDays, Camera, Check, Clock, Droplets, MapPin, MoonStar,
  RotateCw, Sun, Sunrise, Sunset, Thermometer, Wind,
} from "lucide-react";
import { BotaoVoltar } from "@/components/ui";
import { Sk } from "@/components/Skeleton";
import { api, ERRO_SESSAO, esperaMin, type Config } from "@/lib/painel";
import {
  carregarPrevisao, resumoDias, resumoHoras, COR_MAX, COR_MIN,
  type Dia, type EstadoTempo, type Faixa, type Hora, type Janela, type Luz, type Previsao,
} from "@/lib/tempo";


/* cores das fases de luz, iguais às da barra: o tile do ícone repete a cor da
   faixa que ele explica, então a lista se lê junto com a timeline */
const COR_MANHA = "#F2B84B";
const COR_TARDE = "#C97B4A";
const COR_GOLDEN = "#EDB456";
const COR_BLUE = "#50698C";
const COR_UV = "#E3B23C";
const COR_CHUVA = "#4F86C6";
const COR_FAIXA_MELHOR = "#B87A2E";

const SECOES = [
  { id: "tempo-agora", rotulo: "Agora", icone: <Sun size={14} /> },
  { id: "tempo-luz", rotulo: "Luz do dia", icone: <Camera size={14} /> },
  { id: "tempo-horas", rotulo: "Horas", icone: <Clock size={14} /> },
  { id: "tempo-dias", rotulo: "Dias", icone: <CalendarDays size={14} /> },
];

export default function Tempo() {
  const router = useRouter();
  const [estado, setEstado] = useState<EstadoTempo | null>(null);
  const montado = useRef(true);

  useEffect(() => {
    montado.current = true;
    return () => { montado.current = false; };
  }, []);

  /* Busca a config (pra saber a cidade) e a previsão, e DEVOLVE o resultado.
     null quando a sessão expirou: a página volta pra entrada. */
  const carregar = useCallback(async (minMs?: number): Promise<EstadoTempo | null> => {
    let sessaoExpirou = false;
    const cfg = await api<Config>("/api/config").catch((e: Error) => {
      if (e.message === ERRO_SESSAO) sessaoExpirou = true;
      return null;
    });
    if (sessaoExpirou) { router.replace("/entrar"); return null; }
    const [r] = await Promise.all([carregarPrevisao(cfg?.localizacao), esperaMin(minMs)]);
    return r;
  }, [router]);

  const buscar = useCallback((minMs?: number) => {
    carregar(minMs)
      .then((r) => { if (r && montado.current) setEstado(r); })
      .catch(() => { if (montado.current) setEstado({ tipo: "erro" }); });
  }, [carregar]);

  useEffect(() => { buscar(); }, [buscar]);

  /* mesmo mínimo do pull-to-refresh do resto do painel: a busca costuma voltar
     num instante e sem esse piso o skeleton só piscaria */
  function tentarDeNovo() {
    setEstado(null);
    buscar(900);
  }

  const previsao = estado?.tipo === "ok" ? estado.previsao : null;

  return (
    <div className="mx-auto max-w-[960px]">
      {/* no celular isto vive no cabeçalho (ver cabecalho-mobile.tsx) */}
        <div className="hidden md:block">
          <BotaoVoltar href="/painel" rotulo="Início" />
        </div>

      <div className="mb-[22px] mt-2 flex flex-col gap-3">
        <h1 className="m-0 hidden text-[22px] font-semibold tracking-tight text-ink sm:text-[26px] md:block">Previsão do tempo</h1>
        {/* atalhos pras seções: só no celular, onde a página é longa. No
            desktop ela cabe quase toda na tela e o título já basta */}
        {previsao ? <Pills previsao={previsao} /> : estado ? null : <PillsSkeleton />}
      </div>

      {!estado ? (
        <TempoSkeleton />
      ) : estado.tipo === "vazio" ? (
        <Vazio />
      ) : estado.tipo === "erro" ? (
        <Erro aoTentar={tentarDeNovo} />
      ) : (
        <Corpo previsao={estado.previsao} />
      )}
    </div>
  );
}

/* ---------- atalhos ---------- */

function Pills({ previsao }: { previsao: Previsao }) {
  const [ativo, setAtivo] = useState(SECOES[0].id);
  const disponiveis = SECOES.filter((s) =>
    s.id === "tempo-agora" ||
    (s.id === "tempo-luz" && !!previsao.luz) ||
    (s.id === "tempo-horas" && previsao.horas.length > 0) ||
    (s.id === "tempo-dias" && previsao.dias.length > 0),
  );

  function ir(id: string) {
    setAtivo(id);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className="flex flex-wrap gap-2 md:hidden">
      {disponiveis.map((s) => (
        <button
          key={s.id}
          type="button"
          onClick={() => ir(s.id)}
          className={
            "inline-flex cursor-pointer items-center gap-1.5 rounded-full px-3.5 py-[7px] text-[12.5px] font-semibold " +
            "transition-[background,color] duration-150 [-webkit-tap-highlight-color:transparent] " +
            (ativo === s.id ? "bg-accent text-white" : `bg-soft text-ink-soft hover:bg-line hover:text-ink`)
          }
        >
          {s.icone}
          {s.rotulo}
        </button>
      ))}
    </div>
  );
}

/* ---------- corpo ---------- */

function Corpo({ previsao }: { previsao: Previsao }) {
  const { local, agora, luz, horas, dias } = previsao;
  let ordem = 0;

  return (
    <>
      <Bloco ordem={ordem++} id="tempo-agora" className="mb-6">
        <div className="flex flex-col items-center rounded-[20px] bg-paper px-6 py-[26px] text-center">
          {local ? (
            <h2 className="m-0 mb-4 flex items-center gap-2 self-stretch text-[17px] tracking-[-.01em] text-ink">
              <MapPin size={18} strokeWidth={2} className="shrink-0 text-ink-soft" />
              <span className="min-w-0 truncate">
                <b className="font-extrabold">{local.forte}</b>
                <span className="font-medium">{local.leve}</span>
              </span>
            </h2>
          ) : null}

          <div className="flex items-center gap-5">
            <span className="flex h-24 w-24 shrink-0 items-center justify-center text-[68px] leading-none" aria-hidden>
              {agora.emoji}
            </span>
            <div className="min-w-0">
              <div className="text-[38px] font-extrabold leading-none tracking-[-.02em] text-ink">{agora.temp}°</div>
              <div className="mt-[5px] text-[15px] font-medium text-ink">{agora.desc}</div>
            </div>
          </div>

          {/* grade 2×2: as "linhas" são o fundo line vazando pelo gap de 1px,
              o mesmo truque dos KPIs da home. Nenhuma borda. */}
          <div className="mt-[18px] grid w-full grid-cols-2 gap-px overflow-hidden rounded-[14px] bg-line">
            <Stat icone={<Thermometer size={16} strokeWidth={1.8} />} rotulo="Sensação" valor={agora.sensacao + "°"} />
            <Stat
              icone={<ArrowDownUp size={16} strokeWidth={1.8} />}
              rotulo="Mín · Máx"
              valor={
                agora.min != null && agora.max != null ? (
                  <>
                    <b style={{ color: COR_MIN }}>{agora.min}°</b>
                    <span className="text-ink-soft"> · </span>
                    <b style={{ color: COR_MAX }}>{agora.max}°</b>
                  </>
                ) : "sem dado"
              }
            />
            <Stat icone={<Droplets size={16} strokeWidth={1.8} />} rotulo="Umidade" valor={agora.umidade + "%"} />
            <Stat icone={<Wind size={16} strokeWidth={1.8} />} rotulo="Vento" valor={agora.vento + " km/h"} />
          </div>
        </div>
      </Bloco>

      {luz ? (
        <Bloco ordem={ordem++} id="tempo-luz" className="mb-[26px]">
          <LuzDoDia luz={luz} />
        </Bloco>
      ) : null}

      {horas.length ? (
        <Bloco ordem={ordem++} id="tempo-horas">
          <CabecalhoSecao emoji="🕒" titulo="Próximas horas" apoio={resumoHoras(horas)} />
          <Horas horas={horas} />
        </Bloco>
      ) : null}

      {dias.length ? (
        <Bloco ordem={ordem++} id="tempo-dias">
          <CabecalhoSecao emoji="📅" titulo="Próximos dias" apoio={resumoDias(dias)} />
          <Dias dias={dias} />
        </Bloco>
      ) : null}
    </>
  );
}

/** Entrada escalonada dos blocos depois do skeleton, igual à home. */
function Bloco({ ordem, id, className = "", children }: { ordem: number; id?: string; className?: string; children: ReactNode }) {
  return (
    <div id={id} className={"animate-entra motion-reduce:animate-none scroll-mt-20 " + className} style={{ animationDelay: (ordem * 90) + "ms" }}>
      {children}
    </div>
  );
}

function Stat({ icone, rotulo, valor }: { icone: ReactNode; rotulo: string; valor: ReactNode }) {
  return (
    <div className="flex min-w-0 items-center gap-3 bg-soft px-3.5 py-[15px] text-left">
      <span className="inline-flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[10px] bg-paper text-ink-soft">
        {icone}
      </span>
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="truncate text-[11.5px] text-ink-soft">{rotulo}</span>
        <span className="truncate text-[14.5px] font-semibold tabular-nums text-ink">{valor}</span>
      </div>
    </div>
  );
}

function CabecalhoSecao({ emoji, titulo, apoio }: { emoji: string; titulo: string; apoio: string }) {
  return (
    <div className="mx-0.5 mb-3.5 flex min-w-0 items-center gap-3">
      <span className="flex h-11 w-11 shrink-0 -translate-y-0.5 items-center justify-center text-4xl leading-none" aria-hidden>
        {emoji}
      </span>
      <div className="min-w-0">
        <h2 className="m-0 truncate text-[19px] font-extrabold leading-[1.2] tracking-[-.01em] text-ink">{titulo}</h2>
        <div className="mt-1 truncate text-sm font-semibold tabular-nums text-ink-soft">{apoio}</div>
      </div>
    </div>
  );
}

/* ---------- luz do dia ---------- */

const FUNDO_FASE: Record<string, string> = {
  blue: "linear-gradient(90deg,#3E5C86,#5E7CA8)",
  golden: "linear-gradient(90deg,#E7A94C,#F0C063)",
  dia: "linear-gradient(90deg,#CFE3EC,#DDEAF0)",
};

function LuzDoDia({ luz }: { luz: Luz }) {
  return (
    <div className="flex flex-col items-center rounded-[18px] bg-paper px-5 pb-5 pt-6 text-center">
      {/* câmera grande à esquerda, título e faixa à direita dela */}
      <div className="flex items-center gap-4 self-center">
        <span className="flex shrink-0 -translate-y-1.5 items-center justify-center text-[72px] leading-none" aria-hidden>📷</span>
        <div className="text-left">
          <h2 className="m-0 text-[19px] font-extrabold leading-[1.2] tracking-[-.01em] text-ink">Melhor luz do dia</h2>
          <div className="mt-1.5 text-sm font-semibold tabular-nums" style={{ color: COR_FAIXA_MELHOR }}>
            {luz.melhorRotulo} · {luz.melhorFaixa.ini} às {luz.melhorFaixa.fim}
          </div>
        </div>
      </div>

      {/* manhã × tarde vem antes da barra: é o comparativo que justifica a escolha */}
      <Lista>
        <ItemLuz cor={COR_MANHA} icone={<Sunrise size={14} strokeWidth={2} />} janela={luz.manha} />
        <ItemLuz cor={COR_TARDE} icone={<Sunset size={14} strokeWidth={2} />} janela={luz.tarde} />
      </Lista>

      <Barra luz={luz} />

      <Lista>
        <ItemFaixas cor={COR_GOLDEN} icone={<Sunrise size={14} strokeWidth={2} />} rotulo="Golden hour" faixas={luz.golden} />
        <ItemFaixas cor={COR_BLUE} icone={<MoonStar size={14} strokeWidth={2} />} rotulo="Blue hour" faixas={luz.blue} />
        {luz.uv != null ? (
          <Item cor={COR_UV} icone={<Sun size={14} strokeWidth={2} />} rotulo="Índice UV">
            {luz.uv} · {luz.uvTexto}
          </Item>
        ) : null}
      </Lista>
    </div>
  );
}

/** A timeline em si. O trilho tem cantos redondos e recorte próprio; marcadores
 *  e o traço do "agora" ficam FORA dele, senão o recorte os comeria.
 *  A folga no topo é o espaço do marcador (emoji + horário) mais a respiração
 *  até a linha de cima. O marcador sobe 42px: com os 30 de antes, o horário
 *  terminava DEPOIS do topo do trilho e encostava nele. O traço acompanha, pra
 *  continuar nascendo exatamente na barra. */
function Barra({ luz }: { luz: Luz }) {
  return (
    <div className="relative mb-2 mt-[70px] h-3 w-full self-stretch">
      <div className="flex h-full w-full overflow-hidden rounded-full">
        {luz.segmentos.map((s) => (
          <div key={s.chave} className="h-full" style={{ width: s.largura + "%", background: FUNDO_FASE[s.fase] }} />
        ))}
      </div>
      {luz.marcas.map((m) => (
        <div
          key={m.emoji}
          className="absolute -top-[42px] -translate-x-1/2 whitespace-nowrap text-center"
          style={{ left: m.pct + "%" }}
        >
          <div className="text-[15px] leading-none" aria-hidden>{m.emoji}</div>
          <div className="mt-px text-[11.5px] font-semibold tabular-nums text-ink">{m.hora}</div>
          <span className="absolute left-1/2 top-[42px] h-3 w-0.5 -translate-x-1/2 bg-noir/25" aria-hidden />
        </div>
      ))}
      {/* O `box-shadow` do traço abaixo NÃO é sombra: é um anel de 2px cor de
          papel que RECORTA o traço do fundo colorido da barra. Sem ele, o
          traço escuro some dentro do segmento azul da madrugada. Por isso ele
          fica, mesmo com a página sem sombras. */}
      {luz.agoraPct != null ? (
        <span
          aria-label="Agora"
          className="absolute -top-1 h-5 w-[3px] -translate-x-1/2 rounded-sm bg-ink shadow-[0_0_0_2px_var(--color-paper)]"
          style={{ left: luz.agoraPct + "%" }}
        />
      ) : null}
    </div>
  );
}

function Lista({ children }: { children: ReactNode }) {
  return <div className="mt-5 flex w-full flex-col gap-3.5 self-stretch">{children}</div>;
}

function Item({ cor, icone, rotulo, escolhida, children }: {
  cor: string; icone: ReactNode; rotulo: string; escolhida?: boolean; children: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3.5 p-0.5 text-[13px] text-ink-soft">
      <span className="flex shrink-0 items-center gap-[9px] whitespace-nowrap">
        <span
          className="inline-flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-lg text-white"
          style={{ background: cor }}
          aria-hidden
        >
          {icone}
        </span>
        {rotulo}
        {escolhida ? (
          <span
            className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-ok text-white"
            title="Melhor janela de hoje"
          >
            <Check size={10} strokeWidth={3} />
          </span>
        ) : null}
      </span>
      <span className="flex flex-wrap items-center justify-end gap-x-2 gap-y-1 text-right font-semibold tabular-nums text-ink">
        {children}
      </span>
    </div>
  );
}

function ItemLuz({ cor, icone, janela }: { cor: string; icone: ReactNode; janela: Janela }) {
  return (
    <Item cor={cor} icone={icone} rotulo={janela.rotulo} escolhida={janela.escolhida}>
      {janela.desc} · {janela.chuva}% chuva
    </Item>
  );
}

/** Duas janelas (manhã e tarde) na mesma linha, separadas por "e". */
function ItemFaixas({ cor, icone, rotulo, faixas }: { cor: string; icone: ReactNode; rotulo: string; faixas: [Faixa, Faixa] }) {
  return (
    <Item cor={cor} icone={icone} rotulo={rotulo}>
      <Horario faixa={faixas[0]} />
      <span className="text-[11px] font-normal uppercase tracking-[.04em] text-ink-soft">e</span>
      <Horario faixa={faixas[1]} />
    </Item>
  );
}

/** Início → fim como uma unidade só: nunca quebra no meio. */
function Horario({ faixa }: { faixa: Faixa }) {
  return (
    <span className="inline-flex items-center gap-[5px] whitespace-nowrap">
      {faixa.ini}
      <span className="font-normal text-ink-soft" aria-hidden>→</span>
      {faixa.fim}
    </span>
  );
}

/* ---------- próximas horas ---------- */

const ESTILO_ROLAGEM: CSSProperties = {
  scrollbarWidth: "thin",
  scrollbarColor: "rgba(0,54,70,.24) transparent",
};

/** Cards quadrados que rolam na horizontal. Dois detalhes vieram do original:
 *  degradê nas pontas pra avisar que tem mais coisa, e um empurrãozinho de
 *  ~34px (ida e volta) na primeira vez que a lista entra na tela. */
function Horas({ horas }: { horas: Hora[] }) {
  const listaRef = useRef<HTMLDivElement>(null);
  const [pontas, setPontas] = useState({ esq: false, dir: false });

  useEffect(() => {
    const lista = listaRef.current;
    if (!lista) return;

    const medir = () => {
      const max = lista.scrollWidth - lista.clientWidth;
      setPontas({ esq: lista.scrollLeft > 4, dir: max > 4 && lista.scrollLeft < max - 4 });
    };
    const quadro = requestAnimationFrame(medir);
    lista.addEventListener("scroll", medir, { passive: true });
    window.addEventListener("resize", medir);

    /* o empurrãozinho só faz sentido com movimento permitido e com algo pra
       rolar; se a pessoa encostar antes, cancela e não insiste */
    const reduz = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    let obs: IntersectionObserver | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let cancelado = false;
    const cancela = () => { cancelado = true; };

    if (!reduz && typeof IntersectionObserver !== "undefined") {
      obs = new IntersectionObserver((ents) => {
        if (!ents[0].isIntersecting) return;
        obs?.disconnect();
        if (lista.scrollWidth - lista.clientWidth < 40 || lista.scrollLeft > 0) return;
        lista.addEventListener("pointerdown", cancela, { once: true });
        lista.addEventListener("wheel", cancela, { once: true, passive: true });
        let t0: number | null = null;
        const dur = 1100, amp = 34;
        const passo = (ts: number) => {
          if (cancelado) return;
          if (t0 === null) t0 = ts;
          const p = Math.min(1, (ts - t0) / dur);
          /* vai e volta: seno de 0 a π, com ease natural nas pontas */
          lista.scrollLeft = Math.round(Math.sin(p * Math.PI) * amp);
          if (p < 1) requestAnimationFrame(passo); else lista.scrollLeft = 0;
        };
        timer = setTimeout(() => requestAnimationFrame(passo), 500);
      }, { threshold: 0.6 });
      obs.observe(lista);
    }

    return () => {
      cancelado = true;
      cancelAnimationFrame(quadro);
      lista.removeEventListener("scroll", medir);
      window.removeEventListener("resize", medir);
      lista.removeEventListener("pointerdown", cancela);
      lista.removeEventListener("wheel", cancela);
      if (timer) clearTimeout(timer);
      obs?.disconnect();
    };
  }, [horas]);

  return (
    <div className="relative mb-[26px]">
      <div
        ref={listaRef}
        style={ESTILO_ROLAGEM}
        className={
          "flex gap-2 overflow-x-auto px-0.5 pb-3 pt-0.5 " +
          "[&::-webkit-scrollbar]:h-[5px] [&::-webkit-scrollbar-track]:mx-1 [&::-webkit-scrollbar-track]:bg-transparent " +
          "[&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[rgba(0,54,70,.22)]"
        }
      >
        {horas.map((h) => (
          <div
            key={h.chave}
            className="flex aspect-square w-[86px] shrink-0 flex-col items-center justify-center gap-1 rounded-[14px] bg-paper p-1.5 text-center"
          >
            <div className="text-xs text-ink-soft">{h.rotulo}</div>
            <div className="text-[22px] leading-none" aria-hidden>{h.emoji}</div>
            <div className="text-sm font-semibold tabular-nums text-ink">{h.temp}°</div>
          </div>
        ))}
      </div>
      {/* degradês das pontas: avisam que há mais pra rolar, sem seta nem bolinha */}
      <span
        aria-hidden
        className={
          "pointer-events-none absolute bottom-3 left-0 top-0 w-14 transition-opacity duration-[250ms] " +
          "bg-[linear-gradient(90deg,var(--color-soft),rgba(246,247,249,0))] " + (pontas.esq ? "opacity-100" : "opacity-0")
        }
      />
      <span
        aria-hidden
        className={
          "pointer-events-none absolute bottom-3 right-0 top-0 w-14 transition-opacity duration-[250ms] " +
          "bg-[linear-gradient(90deg,rgba(246,247,249,0),var(--color-soft))] " + (pontas.dir ? "opacity-100" : "opacity-0")
        }
      />
    </div>
  );
}

/* ---------- próximos dias ---------- */

function Dias({ dias }: { dias: Dia[] }) {
  return (
    /* as linhas entre os dias são o fundo line vazando pelo gap de 1px, nunca
       uma borda */
    <div className="flex flex-col gap-px overflow-hidden rounded-[18px] bg-line">
      {dias.map((d) => (
        <div key={d.chave} className="flex items-center gap-3.5 bg-paper px-[18px] py-3.5">
          <span className="w-[54px] text-sm font-medium capitalize text-ink">{d.nome}</span>
          <span className="w-7 text-center text-[22px] leading-none" aria-hidden>{d.emoji}</span>
          <span className="flex-1 text-[12.5px] tabular-nums" style={{ color: COR_CHUVA }}>
            {d.chuva != null && d.chuva >= 10 ? "💧 " + d.chuva + "%" : ""}
          </span>
          <span className="flex gap-3 text-sm tabular-nums">
            <b style={{ color: COR_MIN }}>{d.min}°</b>
            <b style={{ color: COR_MAX }}>{d.max}°</b>
          </span>
        </div>
      ))}
    </div>
  );
}

/* ---------- sem cidade e falha ---------- */

function Caixa({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-[18px] bg-paper px-6 py-[30px] text-center text-[14.5px] leading-[1.6] text-ink-soft">
      {children}
    </div>
  );
}

function Vazio() {
  return (
    <Caixa>
      Você ainda não definiu sua cidade.
      <br />
      Defina em{" "}
      <Link href="/painel/configuracoes" className={`font-semibold text-accent no-underline hover:underline`}>
        Configurações, em Localização
      </Link>
      {" "}pra ver a previsão aqui.
    </Caixa>
  );
}

function Erro({ aoTentar }: { aoTentar: () => void }) {
  return (
    <Caixa>
      Não consegui buscar a previsão agora. Tente de novo daqui a pouco.
      <br />
      <button
        type="button"
        onClick={aoTentar}
        className={`mt-3.5 inline-flex cursor-pointer items-center gap-2 rounded-[10px] bg-soft px-4 py-2.5 text-[13px] font-semibold text-ink hover:bg-line`}
      >
        <RotateCw size={15} /> Tentar de novo
      </button>
    </Caixa>
  );
}

/* ---------- skeleton: tudo entra e sai junto ---------- */

function PillsSkeleton() {
  return (
    <div className="flex flex-wrap gap-2 md:hidden" aria-hidden>
      {[82, 96, 88].map((w) => (
        <Sk key={w} className="h-7 rounded-full" style={{ width: w }} />
      ))}
    </div>
  );
}

function TempoSkeleton() {
  return (
    <div aria-busy="true" aria-label="Carregando">
      <div className="mb-6 flex flex-col items-center rounded-[20px] bg-paper px-6 py-[26px]">
        <Sk className="mb-4 h-5 w-[170px] self-stretch rounded-lg" />
        <div className="flex items-center gap-5">
          <Sk className="h-24 w-24 shrink-0 rounded-[20px]" />
          <div>
            <Sk className="h-[34px] w-[110px] rounded-[10px]" />
            <Sk className="mt-3 h-[13px] w-[200px] rounded-[7px]" />
          </div>
        </div>
        <div className="mt-[18px] grid w-full grid-cols-2 gap-px overflow-hidden rounded-[14px] bg-line">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3 bg-soft px-3.5 py-[15px]">
              <Sk className="h-[34px] w-[34px] shrink-0 rounded-[10px]" />
              <div className="min-w-0 flex-1">
                <Sk className="h-[11px] w-[58px] rounded-md" />
                <Sk className="mt-1.5 h-[13px] w-[46px] rounded-md" />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mb-[26px] flex overflow-hidden">
        <div className="flex gap-2 overflow-hidden">
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
            <Sk key={i} className="h-[86px] w-[86px] shrink-0 rounded-[14px]" />
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-[18px] bg-paper py-2.5">
        {[0, 1, 2, 3, 4].map((i) => (
          <Sk key={i} className="mx-[18px] my-3.5 h-5 rounded-[7px]" />
        ))}
      </div>
    </div>
  );
}

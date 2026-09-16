/*
  Home do painel. Portada da <div id="pagina-home"> do estudio.html
  (carregarHome / recarregarHome / climaParaHome).

  A regra que organiza esta tela: lista e clima disparam JUNTOS e NADA é
  desenhado até os dois voltarem, então todo bloco sai do skeleton no mesmo
  instante. Antes o clima só começava depois da lista e nem era esperado:
  KPIs apareciam primeiro e a saudação ficava piscando sozinha.

  O clima tem teto de 5s: depende de API externa e fetch não tem timeout
  próprio. Estourou, a home renderiza com a saudação da hora e o clima real
  entra sozinho quando (e se) chegar.

  Camada de celular (portada junto com o resto do app):
  - Puxar pra atualizar recarrega a home no lugar, com o skeleton de volta.
  - Cada evento desliza pro lado revelando "Abrir" e "Copiar" do contrato
    (no computador, o mesmo par sai pelo botão de opções da linha).
  - Com clima na mão, o emoji e o resumo viram link pra previsão completa.
*/
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import {
  CalendarHeart, Check, ChevronRight, CircleCheck, Copy, FileCheck2, FilePlus2, FileText,
  Heart, Link2, Sparkles, TriangleAlert, Users,
} from "lucide-react";
import { Secao } from "@/components/ui";
import { Deslizar, type AcaoDeslizar } from "@/components/Deslizar";
import { PuxarPraAtualizar } from "@/components/PuxarPraAtualizar";
import { ModalLink, type DadosLink } from "@/components/ModalLink";
import { useConfirmar } from "@/components/ModalConfirmar";
import { useToast } from "@/components/Toast";
import { Sk, SkCirculo, SkLinha } from "@/components/Skeleton";
import { copiarTexto } from "@/lib/ficha";
import {
  api, buscarClima, dataCurta, esperaMin, nomeCasal, pendenciasDe, proximosEventos, saudacaoDaHora, totalPendencias,
  ERRO_SESSAO, type ClienteLista, type ClimaAgora, type Config, type RespostaLista, type Saudacao,
} from "@/lib/painel";

const HOVER = "[@media(hover:hover)]:";
const TETO_CLIMA_MS = 5000;
/* mínimo pra o skeleton do puxar aparecer de verdade em vez de piscar */
const MIN_ATUALIZAR_MS = 900;
/* cor fixa por ponta: mín sempre um azul sutil, máx sempre um vermelho sutil.
   O contraste entre as duas já entrega "mais frio / mais quente". */
const COR_MIN = "#5B87B3";
const COR_MAX = "#C15C39";

type Dados = {
  clientes: ClienteLista[];
  nome: string;
  saudacao: Saudacao;
  frase: string;
  clima: ClimaAgora | null;
};

/** o contrato já existe em alguma forma (rascunho pra cima) */
function temContrato(status?: string | null): boolean {
  return status === "rascunho" || status === "enviado" || status === "visualizado" || status === "assinado";
}

function iconeContrato(status?: string | null): ReactNode {
  if (status === "assinado") return <FileCheck2 size={17} strokeWidth={1.8} />;
  if (temContrato(status)) return <FileText size={17} strokeWidth={1.8} />;
  return <FilePlus2 size={17} strokeWidth={1.8} />;
}

type RespostaLiberar = { link: string; mensagem?: string; assinado?: boolean };

export default function Home() {
  const router = useRouter();
  const confirmar = useConfirmar();
  const { mostrar, elemento: aviso } = useToast();
  const [dados, setDados] = useState<Dados | null>(null);
  const [modalLink, setModalLink] = useState<DadosLink | null>(null);
  const montado = useRef(true);

  useEffect(() => {
    montado.current = true;
    return () => { montado.current = false; };
  }, []);

  /* Busca tudo e DEVOLVE os dados; quem escreve no estado é o efeito. Assim o
     estado só muda em callback, nunca sincronamente dentro do efeito.
     `climaTarde` só vem quando o clima estourou o teto: entra sozinho depois. */
  const carregar = useCallback(async (minMs?: number): Promise<{ dados: Dados; climaTarde?: Promise<ClimaAgora | null> } | null> => {
    let sessaoExpirou = false;
    const lista = api<RespostaLista>("/api/estudio?lista=1").catch((e: Error) => {
      if (e.message === ERRO_SESSAO) sessaoExpirou = true;
      return {} as RespostaLista;
    });
    const cfg = api<Config>("/api/config").catch(() => null);
    const clima = cfg.then((c) => buscarClima(c?.localizacao));
    /* undefined = estourou o teto; null = não tem localização ou falhou */
    const climaComTeto = Promise.race([clima, esperaMin(TETO_CLIMA_MS).then(() => undefined)]);

    const [l, c, cl] = await Promise.all([lista, cfg, climaComTeto, esperaMin(minMs)]);
    if (sessaoExpirou) { router.replace("/entrar"); return null; }

    const s = saudacaoDaHora();
    return {
      dados: {
        clientes: l.clientes ?? [],
        nome: c?.perfil?.nome?.trim() ?? "",
        saudacao: s,
        frase: s.subs[Math.floor(Math.random() * s.subs.length)],
        clima: cl ?? null,
      },
      climaTarde: cl === undefined ? clima : undefined,
    };
  }, [router]);

  const aplicar = useCallback((r: Awaited<ReturnType<typeof carregar>>) => {
    if (!r || !montado.current) return;
    setDados(r.dados);
    r.climaTarde?.then((tarde) => {
      if (tarde && montado.current) setDados((d) => (d ? { ...d, clima: tarde } : d));
    });
  }, []);

  useEffect(() => {
    carregar()
      .then(aplicar)
      .catch(() => { /* falha de rede: fica no skeleton */ });
  }, [carregar, aplicar]);

  /* puxar pra atualizar: volta pro skeleton e refaz a busca no lugar, sem
     recarregar a página (é o que o recarregarHome fazia no original) */
  const atualizar = useCallback(async () => {
    setDados(null);
    await carregar(MIN_ATUALIZAR_MS).then(aplicar).catch(() => { /* fica no skeleton */ });
  }, [carregar, aplicar]);

  return (
    <>
      <PuxarPraAtualizar aoAtualizar={atualizar}>
        <div className="mx-auto max-w-[960px]">
          {dados ? (
            <Conteudo
              dados={dados}
              confirmar={confirmar}
              mostrar={mostrar}
              router={router}
              aoAbrirModalLink={setModalLink}
            />
          ) : (
            <HomeSkeleton />
          )}
        </div>
      </PuxarPraAtualizar>
      {/* fora do bloco que anda no puxão: modal e aviso são `fixed` */}
      {modalLink ? <ModalLink dados={modalLink} onFechar={() => setModalLink(null)} /> : null}
      {aviso}
    </>
  );
}

function Conteudo({
  dados, confirmar, mostrar, router, aoAbrirModalLink,
}: {
  dados: Dados;
  confirmar: ReturnType<typeof useConfirmar>;
  mostrar: ReturnType<typeof useToast>["mostrar"];
  router: ReturnType<typeof useRouter>;
  aoAbrirModalLink: (d: DadosLink) => void;
}) {
  const { clientes, nome, saudacao, frase, clima } = dados;
  const pendentes = totalPendencias(pendenciasDe(clientes));
  const proximos = proximosEventos(clientes);
  const kpis: { num: string; rotulo: string; icone: ReactNode; data?: boolean }[] = [
    { num: String(clientes.filter((c) => c.status === "novo").length), rotulo: "Clientes novos", icone: <Sparkles size={16} /> },
    { num: String(clientes.filter((c) => c.status === "confirmado").length), rotulo: "Clientes confirmados", icone: <CircleCheck size={16} /> },
    { num: String(clientes.filter((c) => c.status === "realizado").length), rotulo: "Casamentos realizados", icone: <Heart size={16} /> },
    { num: proximos.length ? dataCurta(proximos[0].data_evento) : "sem data", rotulo: "Próximo casamento", icone: <CalendarHeart size={16} />, data: true },
  ];

  function falhou(e: unknown, msg: string) {
    if ((e as Error).message === ERRO_SESSAO) router.replace("/entrar");
    else mostrar(msg);
  }

  /* "Abrir": com contrato na mão vai direto pra revisão; sem contrato, confirma
     e gera o rascunho antes (mesmo fluxo de abrirContratoDoEvento no original) */
  async function abrirContratoDoEvento(c: ClienteLista) {
    const destino = "/painel/clientes/" + encodeURIComponent(c.id) + "/contrato";
    if (temContrato(c.contrato_status)) { router.push(destino); return; }
    const ok = await confirmar({
      titulo: "Abrir contrato pra revisar?",
      texto: "Cria o contrato de " + nomeCasal(c) + " como rascunho e abre pra você revisar. O casal só vê depois que você copiar o link.",
      rotuloOk: "Abrir",
    });
    if (!ok) return;
    try {
      await api("/api/estudio", { acao: "gerar-contrato", id: c.id });
      router.push(destino);
    } catch (e) { falhou(e, "Não deu pra abrir o contrato. Tente de novo."); }
  }

  /* "Copiar": libera o link do casal e reaproveita o pop-up da ficha. O
     ClipboardItem com Promise é o pulo do gato do Safari do iOS: a escrita
     precisa COMEÇAR dentro do gesto, e o texto só existe depois do fetch. */
  async function copiarContratoDoEvento(c: ClienteLista) {
    const eraRascunho = c.contrato_status === "rascunho";
    const pedido = api<RespostaLiberar>("/api/estudio", { acao: "liberar-contrato-cliente", id: c.id });

    let copiando: Promise<boolean> = Promise.resolve(false);
    if (navigator.clipboard?.write && typeof ClipboardItem !== "undefined") {
      const blob = pedido.then((r) => new Blob([r.mensagem || r.link], { type: "text/plain" }));
      copiando = navigator.clipboard.write([new ClipboardItem({ "text/plain": blob })]).then(() => true, () => false);
    }

    try {
      const [r, copiouNoGesto] = await Promise.all([pedido, copiando]);
      const copiou = copiouNoGesto || await copiarTexto(r.mensagem || r.link);
      aoAbrirModalLink({
        link: r.link,
        mensagem: r.mensagem || r.link,
        assinado: !!r.assinado,
        primeiraLiberacao: eraRascunho,
        jaCopiou: copiou,
      });
    } catch (e) { falhou(e, "Não deu pra liberar o link do contrato."); }
  }

  function acoesDoEvento(c: ClienteLista): AcaoDeslizar[] {
    return [
      {
        chave: "abrir",
        rotulo: "Abrir",
        icone: iconeContrato(c.contrato_status),
        classe: `bg-accent ${HOVER}hover:bg-accent-hover`,
        aoAcionar: () => { void abrirContratoDoEvento(c); },
      },
      {
        chave: "copiar",
        rotulo: "Copiar",
        icone: <Copy size={17} strokeWidth={1.8} />,
        classe: `bg-accent-deep ${HOVER}hover:bg-[#3f5064]`,
        desativada: !temContrato(c.contrato_status),
        aoAcionar: () => { void copiarContratoDoEvento(c); },
      },
    ];
  }

  return (
    <>
      {/* saudação: nome forte, clima (ou frase da hora) como subtítulo */}
      {/* Ritmo da página: 24px depois da saudação (ela é o título, pede ar) e
          16px entre os cartões, sempre. O original vinha com 18, 22, 28 e 16,
          quatro vãos diferentes descendo a mesma tela, e isso se via. */}
      <Bloco ordem={0} className="mb-6 flex items-center gap-4">
        {clima ? (
          /* com previsão na mão, o emoji abre a página do tempo */
          <Link
            href="/painel/tempo"
            aria-label="Ver a previsão do tempo"
            className={`shrink-0 text-[40px] leading-none no-underline sm:text-[46px] ${HOVER}hover:opacity-75`}
          >
            <span aria-hidden>{clima.emoji}</span>
          </Link>
        ) : (
          <span className="shrink-0 text-[40px] leading-none sm:text-[46px]" aria-hidden>
            {saudacao.emoji}
          </span>
        )}
        <div className="flex min-w-0 flex-col gap-[3px]">
          <h1 className="m-0 text-[22px] font-semibold leading-tight tracking-tight text-ink sm:text-[26px]">
            <span className="font-normal text-ink-soft">{saudacao.texto}{nome ? ", " : "."}</span>
            {nome ? <span>{nome}.</span> : null}
          </h1>
          {clima ? (
            <Link
              href="/painel/tempo"
              className={`m-0 block text-[14.5px] leading-[1.4] text-ink-soft no-underline ${HOVER}hover:text-ink`}
            >
              {clima.desc}, {clima.temp}°
              {clima.min != null && clima.max != null ? (
                <span className="ml-2.5 inline-flex gap-2.5 tabular-nums">
                  <span style={{ color: COR_MIN }}>↓ {clima.min}°</span>
                  <span style={{ color: COR_MAX }}>↑ {clima.max}°</span>
                </span>
              ) : null}
            </Link>
          ) : (
            <p className="m-0 text-[14.5px] italic leading-[1.4] text-ink-soft">{frase}</p>
          )}
        </div>
      </Bloco>

      {/* card "precisa de atenção": some quando está tudo em dia. Card neutro
          (bg + sombra), com a cor de alerta só no ícone e na contagem */}
      {pendentes > 0 ? (
        <Bloco ordem={1} className="mb-4">
        <Link
          href="/painel/pendencias"
          className={
            "flex w-full items-center gap-[13px] rounded-2xl bg-[#F8F4EE] px-[15px] py-[13px] text-left no-underline shadow-card " +
            `transition-[transform,box-shadow] duration-150 ${HOVER}hover:-translate-y-px ${HOVER}hover:shadow-card-hover`
          }
        >
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] bg-[#EBE2D3] text-[#8A6A3C]">
            <TriangleAlert size={18} />
          </span>
          <span className="flex min-w-0 flex-1 flex-col gap-px">
            <span className="text-sm font-semibold leading-[1.3] text-ink">Precisa de atenção</span>
            <span className="text-[12.5px] leading-[1.35] text-ink-soft">
              {pendentes === 1 ? "1 pendência pra resolver" : pendentes + " pendências pra resolver"}
            </span>
          </span>
          <span className="inline-flex h-[23px] min-w-[23px] shrink-0 items-center justify-center rounded-full bg-[#EBE2D3] px-2 text-[12.5px] font-semibold tabular-nums text-[#6F5228]">
            {pendentes}
          </span>
          <ChevronRight size={17} className="shrink-0 text-[#B4A489]" />
        </Link>
        </Bloco>
      ) : null}

      {/* KPIs: as "linhas" entre células são o fundo line vazando pelo gap de
          1px, nada de borda por célula */}
      <Bloco ordem={2} className="mb-4 grid grid-cols-2 gap-px overflow-hidden rounded-[22px] bg-line shadow-card md:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.rotulo} className="relative bg-paper px-[22px] py-5">
            <span className="absolute right-3.5 top-3.5 inline-flex h-[34px] w-[34px] items-center justify-center rounded-xl bg-accent-tint text-accent">
              {k.icone}
            </span>
            <div className={"pr-11 font-semibold leading-[1.1] tracking-[-.01em] tabular-nums text-accent " + (k.data ? "pt-[5px] text-[19px]" : "text-[28px]")}>
              {k.num}
            </div>
            <div className="mt-2 text-[12.5px] leading-[1.4] text-ink-soft">{k.rotulo}</div>
          </div>
        ))}
      </Bloco>

      <Bloco ordem={3}>
        <Secao icone={<CalendarHeart size={17} />} titulo="Próximos eventos">
          {proximos.length ? (
            <ul className="m-0 flex list-none flex-col gap-2 p-0">
              {proximos.slice(0, 5).map((c) => (
                <li key={c.id}>
                  <Deslizar
                    acoes={acoesDoEvento(c)}
                    rotuloOpcoes={"Opções do contrato de " + nomeCasal(c)}
                    className="rounded-[14px] bg-[#F7F9FA] shadow-[0_1px_2px_rgba(29,41,61,.03)]"
                    classeFrente={`gap-3.5 bg-[#F7F9FA] py-3 pl-3.5 pr-2 ${HOVER}hover:bg-[#F0F4F6]`}
                  >
                    <Link
                      href={"/painel/clientes/" + c.id}
                      className="flex min-w-0 flex-1 items-center gap-3.5 no-underline"
                    >
                      <span className="inline-flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full bg-accent-tint text-accent">
                        <Users size={15} />
                      </span>
                      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="truncate text-[14.5px] font-medium leading-[1.3] text-ink">{nomeCasal(c)}</span>
                        <span className="text-[12.5px] font-medium tabular-nums tracking-[.01em] text-ink-soft">{dataCurta(c.data_evento)}</span>
                      </span>
                    </Link>
                  </Deslizar>
                </li>
              ))}
            </ul>
          ) : (
            <p className="m-0 text-[14.5px] text-ink-soft">Nenhum evento confirmado à frente.</p>
          )}
        </Secao>
      </Bloco>

      <Bloco ordem={4}>
        <Secao icone={<Link2 size={17} />} titulo="Links pro cliente">
          <LinksCliente mostrar={mostrar} />
        </Secao>
      </Bloco>
    </>
  );
}

/** Entrada escalonada dos blocos depois do skeleton: fade + slide-up, cada
 *  bloco 90ms depois do anterior. */
function Bloco({ ordem, className = "", children }: { ordem: number; className?: string; children: ReactNode }) {
  return (
    <div className={"animate-entra motion-reduce:animate-none " + className} style={{ animationDelay: (ordem * 90) + "ms" }}>
      {children}
    </div>
  );
}

/* ---------- links pro cliente ----------
   O card inteiro é o botão: clicar já copia o link, sem campo pra selecionar.
   Link fixo, então dispensa o truque do ClipboardItem-com-Promise do contrato. */
function LinksCliente({ mostrar }: { mostrar: ReturnType<typeof useToast>["mostrar"] }) {
  const [copiado, setCopiado] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const cards = [
    { id: "portfolio", titulo: "Portfólio", caminho: "/", imagem: "/img/estudio-preview-portfolio.jpg" },
    { id: "cadastro", titulo: "Cadastro", caminho: "/cadastro", imagem: "/img/estudio-preview-cadastro.jpg" },
  ];

  async function copiar(id: string, caminho: string) {
    const ok = await copiarTexto(window.location.origin + caminho);
    if (!ok) { mostrar("Não consegui copiar, tente de novo."); return; }
    mostrar("Link copiado ✓", { ok: true });
    setCopiado(id);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopiado(null), 2500);
  }

  return (
    <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
      {cards.map((c) => {
        const ativo = copiado === c.id;
        return (
          <button
            key={c.id}
            type="button"
            onClick={() => copiar(c.id, c.caminho)}
            className={
              "block w-full cursor-pointer overflow-hidden rounded-2xl bg-[#F7F9FA] p-0 text-left shadow-[0_0_22px_rgba(29,41,61,.13)] " +
              `transition-[transform,background,box-shadow] duration-150 ${HOVER}hover:-translate-y-px ${HOVER}hover:bg-[#F0F4F6] ${HOVER}hover:shadow-[0_0_28px_rgba(29,41,61,.17)] group`
            }
          >
            <span className="relative block aspect-[12/5] bg-soft">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={c.imagem} alt="" loading="lazy" className="block h-full w-full object-cover object-top" />
              <span
                aria-hidden
                className={
                  "absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-ok text-white transition-[opacity,transform] duration-200 " +
                  (ativo ? "scale-100 opacity-100" : "scale-[.7] opacity-0")
                }
              >
                <Check size={13} />
              </span>
            </span>
            <span className="flex items-center justify-between gap-2 px-[13px] py-3">
              <span className="min-w-0">
                <span className="block text-[12.5px] font-semibold text-ink">{c.titulo}</span>
                <span className={"mt-0.5 block text-[11px] " + (ativo ? "font-semibold text-ok" : "text-ink-soft")}>
                  {ativo ? "Link copiado ✓" : "Toque para copiar o link"}
                </span>
              </span>
              <Copy size={15} className={"shrink-0 transition-colors " + (ativo ? "text-ok" : `text-ink-soft ${HOVER}group-hover:text-accent`)} />
            </span>
          </button>
        );
      })}
    </div>
  );
}

/* ---------- skeleton: todos os blocos, terminando juntos ---------- */

function CabecalhoSk() {
  return (
    <div className="mb-4 flex items-center gap-2.5">
      <Sk className="h-9 w-9 rounded-[13px]" />
      <SkLinha className="w-[140px]" />
    </div>
  );
}

function HomeSkeleton() {
  return (
    <div aria-busy="true" aria-label="Carregando">
      <div className="mb-6 flex items-center gap-4">
        <Sk className="h-11 w-11 rounded-[14px]" />
        <div className="flex min-w-0 flex-1 flex-col gap-2.5">
          <Sk className="h-[22px] w-[min(62%,340px)] rounded-[9px]" />
          <Sk className="h-[13px] w-[min(48%,220px)] rounded-[7px]" />
        </div>
      </div>

      <div className="mb-4 flex w-full items-center gap-[13px] rounded-2xl bg-[#F8F4EE] px-[15px] py-[13px] shadow-card">
        <Sk className="h-9 w-9 rounded-[11px]" />
        <div className="flex flex-1 flex-col gap-[5px]">
          <Sk className="h-3.5 w-[150px] rounded-md" />
          <Sk className="h-3 w-[195px] rounded-md" />
        </div>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-px overflow-hidden rounded-[22px] bg-line shadow-card md:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="bg-paper px-[22px] py-5">
            <Sk className="h-[30px] w-[54px] rounded-[9px]" />
            <SkLinha className="mt-3 w-[72%]" />
          </div>
        ))}
      </div>

      <section className="mb-4">
        <CabecalhoSk />
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {[0, 1].map((i) => (
            <li key={i} className="flex items-center gap-3.5 rounded-[14px] bg-[#F7F9FA] px-3.5 py-3">
              <SkCirculo />
              <SkLinha className="w-[55%]" />
            </li>
          ))}
        </ul>
      </section>

      <section className="mb-4">
        <CabecalhoSk />
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
          {[0, 1].map((i) => (
            <div key={i} className="overflow-hidden rounded-2xl bg-[#F7F9FA]">
              <Sk className="aspect-[12/5] w-full rounded-none" />
              <div className="px-[13px] py-3">
                <Sk className="h-3 w-[60px] rounded-md" />
                <Sk className="mt-[5px] h-[11px] w-[118px] rounded-md" />
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

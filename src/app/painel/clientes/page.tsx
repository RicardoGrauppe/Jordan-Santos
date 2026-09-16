/*
  Lista de clientes. Portada da <div id="tela-lista"> do estudio.html
  (carregarLista / desenharLista).

  Herdado de lá:
  - Sem filtro de status, arquivado não aparece: quem quer ver escolhe
    "Arquivado" no select.
  - No desktop é tabela; abaixo de 720px cada linha vira cartão, sem esconder
    coluna. O original fazia isso com CSS em cima da mesma <table>; aqui cada
    linha é um grid que muda de forma no breakpoint.
  - Nenhuma linha entre as linhas: só o respiro e o hover separam.

  Camada de celular: puxar a lista pra baixo recarrega no lugar, com o
  skeleton de volta. O excluir continua sendo o botão da própria linha, e não
  um deslize: aqui a linha é a MESMA no computador (tabela de cinco colunas) e
  no celular (cartão), e embrulhar isso numa camada que anda pro lado
  desmontaria o alinhamento das colunas sem ganhar nada em cima do botão que
  já existe. No original esta tela também não deslizava.
*/
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Plus, Search, Trash2 } from "lucide-react";
import { Botao, BotaoLimparBusca, Selo } from "@/components/ui";
import { useConfirmar } from "@/components/ModalConfirmar";
import { PuxarPraAtualizar } from "@/components/PuxarPraAtualizar";
import { SkLinha } from "@/components/Skeleton";
import { moeda } from "@/lib/util";
import {
  api, dataCurta, esperaMin, iniciais, nomeCasal, ERRO_SESSAO, ROTULO_STATUS,
  type ClienteLista, type RespostaLista,
} from "@/lib/painel";

/* mínimo pra o skeleton do puxar aparecer de verdade em vez de piscar */
const MIN_ATUALIZAR_MS = 900;

const FILTROS: { valor: string; rotulo: string }[] = [
  { valor: "", rotulo: "Todos os status" },
  { valor: "novo", rotulo: "Novo" },
  { valor: "confirmado", rotulo: "Confirmado" },
  { valor: "realizado", rotulo: "Realizado" },
  { valor: "arquivado", rotulo: "Arquivado" },
];

const TOM_STATUS: Record<string, "neutro" | "ok" | "accent"> = {
  novo: "neutro", confirmado: "accent", realizado: "ok", arquivado: "neutro",
};

/* mesma grade pra cabeçalho e linhas, senão as colunas não alinham */
const COLUNAS = "md:grid-cols-[minmax(0,1fr)_150px_140px_150px_44px]";

export default function ListaClientes() {
  const router = useRouter();
  const confirmar = useConfirmar();
  const [clientes, setClientes] = useState<ClienteLista[] | null>(null);
  const [busca, setBusca] = useState("");
  const [status, setStatus] = useState("");
  const montado = useRef(true);

  useEffect(() => {
    montado.current = true;
    return () => { montado.current = false; };
  }, []);

  /* Busca e DEVOLVE a lista (null = sessão expirou); quem escreve no estado é
     quem chamou, em callback. O estado inicial já é o skeleton. */
  const carregar = useCallback(async (minMs?: number): Promise<ClienteLista[] | null> => {
    let sessaoExpirou = false;
    const lista = api<RespostaLista>("/api/estudio?lista=1").catch((e: Error) => {
      if (e.message === ERRO_SESSAO) sessaoExpirou = true;
      return {} as RespostaLista;
    });
    const [l] = await Promise.all([lista, esperaMin(minMs)]);
    if (sessaoExpirou) { router.replace("/entrar"); return null; }
    return l.clientes ?? [];
  }, [router]);

  useEffect(() => {
    carregar()
      .then((l) => { if (l && montado.current) setClientes(l); })
      .catch(() => { /* falha de rede: fica no skeleton */ });
  }, [carregar]);

  /* puxar pra atualizar: volta pro skeleton e refaz a busca no lugar */
  const atualizar = useCallback(async () => {
    setClientes(null);
    await carregar(MIN_ATUALIZAR_MS)
      .then((l) => { if (l && montado.current) setClientes(l); })
      .catch(() => { /* fica no skeleton */ });
  }, [carregar]);

  const visiveis = useMemo(() => {
    if (!clientes) return [];
    const termo = busca.trim().toLowerCase();
    return clientes.filter((c) => {
      if (status && c.status !== status) return false;
      if (!status && c.status === "arquivado") return false;
      const nome = ((c.noivo ?? "") + " " + (c.noiva ?? "")).toLowerCase();
      return !termo || nome.includes(termo);
    });
  }, [clientes, busca, status]);

  async function excluir(c: ClienteLista) {
    const nome = nomeCasal(c);
    const ok = await confirmar({
      titulo: "Excluir de vez?",
      texto: "“" + nome + "” será apagado permanentemente. Não dá pra desfazer.",
      rotuloOk: "Excluir",
      perigo: true,
    });
    if (!ok) return;
    try {
      await api("/api/estudio", { acao: "excluir", id: c.id });
      setClientes(null);
      const l = await carregar();
      if (l && montado.current) setClientes(l);
    } catch (e) {
      if ((e as Error).message === ERRO_SESSAO) router.replace("/entrar");
      else alert("Não deu pra excluir o cliente. Tente de novo.");
    }
  }

  return (
    <PuxarPraAtualizar aoAtualizar={atualizar}>
    <div className="mx-auto max-w-[1100px]">
      {/* justify-end no celular: sem o título, o "Novo cliente" sozinho
          escorregaria pra esquerda com o justify-between */}
      <div className="mb-[18px] flex items-center justify-end gap-4 md:justify-between">
        {/* no celular isto vive no cabeçalho (ver cabecalho-mobile.tsx) */}
        <h1 className="m-0 hidden items-center gap-2.5 text-[22px] font-semibold tracking-tight text-ink sm:text-[26px] md:flex">
          Clientes
          {clientes && visiveis.length ? (
            <span className="inline-flex h-[22px] min-w-6 items-center justify-center rounded-full bg-soft px-2 text-[12.5px] font-semibold text-ink-soft">
              {visiveis.length}
            </span>
          ) : null}
        </h1>
        <Botao className="h-10 whitespace-nowrap px-4 text-[13.5px]" onClick={() => router.push("/painel/clientes/novo")}>
          <Plus size={16} /> Novo cliente
        </Botao>
      </div>

      {/* barra: busca e filtro, sem borda (o fundo soft diferencia) */}
      <div className="mb-[18px] flex flex-wrap items-center gap-3">
        <label className="flex min-w-[200px] flex-1 items-center gap-[9px] rounded-xl bg-soft px-3 transition-colors focus-within:bg-[#EEF0F3]">
          <Search size={16} className="shrink-0 text-ink-soft" />
          <input
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar casal"
            aria-label="Buscar casal"
            className="w-full bg-transparent py-2.5 text-sm text-ink outline-none placeholder:text-ink-soft/70"
          />
          {busca ? <BotaoLimparBusca aoLimpar={() => setBusca("")} /> : null}
        </label>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          aria-label="Filtrar por status"
          className="h-10 cursor-pointer appearance-none rounded-xl bg-soft py-2.5 pl-[13px] pr-9 text-sm text-ink outline-none transition-colors focus:bg-[#EEF0F3]"
          style={{
            backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
            backgroundRepeat: "no-repeat",
            backgroundPosition: "right 12px center",
          }}
        >
          {FILTROS.map((f) => <option key={f.valor} value={f.valor}>{f.rotulo}</option>)}
        </select>
      </div>

      {/* desktop: card branco com cabeçalho; celular: cada linha é o próprio cartão */}
      <div className="md:overflow-hidden md:rounded-[20px] md:bg-paper md:shadow-[0_1px_2px_rgba(29,29,27,.04),0_14px_32px_rgba(29,29,27,.08)]">
        <div className={"hidden bg-soft px-[18px] py-3.5 text-[11px] font-semibold uppercase tracking-[.06em] text-ink-soft md:grid " + COLUNAS}>
          <span>Casal</span><span>Data</span><span>Status</span><span className="text-right">Total</span><span aria-label="Ações" />
        </div>

        {!clientes ? (
          <ListaSkeleton />
        ) : !visiveis.length ? (
          <p className="m-0 rounded-2xl bg-soft px-[18px] py-16 text-center text-[14.5px] text-ink-soft md:rounded-none md:bg-transparent">
            {clientes.length
              ? "Nenhum cliente com esse filtro."
              : "Nenhum cliente ainda. O primeiro chega pelo questionário do contrato, ou crie manualmente."}
          </p>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-2.5 p-0 md:block">
            {visiveis.map((c) => {
              const nome = nomeCasal(c);
              const st = c.status ?? "";
              return (
                <li key={c.id} className="group relative">
                  <Link
                    href={"/painel/clientes/" + c.id}
                    className={
                      "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5 rounded-[18px] bg-paper py-3.5 pl-3.5 pr-[46px] no-underline shadow-card " +
                      "md:items-center md:rounded-none md:px-[18px] md:py-[17px] md:shadow-none " +
                      `transition-colors hover:bg-soft ` + COLUNAS
                    }
                  >
                    <span className="col-span-2 flex items-center gap-3 md:col-span-1">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-soft text-xs font-semibold tracking-[.02em] text-accent">
                        {iniciais(c.noivo, c.noiva)}
                      </span>
                      <span className="truncate text-base font-medium text-ink md:text-[14.5px]">{nome}</span>
                    </span>
                    <span className="text-[13.5px] text-ink-soft md:text-[14.5px] md:text-ink">{dataCurta(c.data_evento)}</span>
                    <span className="row-span-2 justify-self-end md:row-span-1 md:justify-self-start">
                      <Selo tom={TOM_STATUS[st] ?? "neutro"}>{ROTULO_STATUS[st] ?? st}</Selo>
                    </span>
                    <span className="text-left text-[14.5px] font-semibold tabular-nums text-ink md:text-right">
                      {c.total != null && c.total !== "" ? moeda(Number(c.total)) : ""}
                    </span>
                    <span className="hidden md:block" />
                  </Link>
                  {/* fora do link pra não navegar; sutil até passar o mouse */}
                  <button
                    type="button"
                    title="Excluir cliente"
                    aria-label={"Excluir " + nome}
                    onClick={() => excluir(c)}
                    className={
                      "absolute right-1.5 top-1.5 inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg text-ink-soft opacity-30 transition-[opacity,color,background] " +
                      "md:right-3 md:top-1/2 md:h-7 md:w-7 md:-translate-y-1/2 " +
                      `group-hover:opacity-65 hover:!opacity-100 hover:bg-[rgba(163,59,59,.08)] hover:text-erro`
                    }
                  >
                    <Trash2 size={15} />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
    </PuxarPraAtualizar>
  );
}

function ListaSkeleton() {
  return (
    <ul className="m-0 flex list-none flex-col gap-2.5 p-0 md:block" aria-busy="true" aria-label="Carregando">
      {[0, 1, 2, 3, 4].map((i) => (
        <li key={i} className="rounded-[18px] bg-paper px-3.5 py-[18px] shadow-card md:rounded-none md:px-6 md:shadow-none">
          <SkLinha className="h-4 w-full" />
        </li>
      ))}
    </ul>
  );
}

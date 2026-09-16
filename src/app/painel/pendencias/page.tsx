/*
  "Precisa de atenção": pontas soltas do contrato. Portada da
  <div id="pagina-pendencias"> do estudio.html (carregarPendencias /
  desenharPendencias).

  Três frentes, calculadas a partir do contrato_status que a lista já traz:
  rascunho não enviado, casal ainda não assinou, confirmado sem contrato.
  "Limpar" tira o item da lista até algo mudar nesse contrato (a chave inclui
  o status, então mudar de estado traz a pendência de volta).

  Como no original, "Limpar" vive ATRÁS da linha: no celular ela é revelada
  deslizando pro lado, e no computador pelo botão de opções da própria linha.
  Puxar a lista pra baixo recarrega tudo no lugar.
*/
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowLeft, Check, Clock, FileText, UserPlus, Users } from "lucide-react";
import { useConfirmar } from "@/components/ModalConfirmar";
import { Deslizar } from "@/components/Deslizar";
import { PuxarPraAtualizar } from "@/components/PuxarPraAtualizar";
import { Sk, SkCirculo, SkLinha } from "@/components/Skeleton";
import {
  api, chavePend, dataCurta, esperaMin, gravarLimpas, lerLimpas, nomeCasal, pendenciasDe, ERRO_SESSAO,
  type ClienteLista, type GrupoPendencia, type RespostaLista,
} from "@/lib/painel";

/* mínimo pra o skeleton do puxar aparecer de verdade em vez de piscar */
const MIN_ATUALIZAR_MS = 900;
/* largura da ação revelada: a mesma do original nesta tela */
const LARGURA_LIMPAR = 104;

const SECOES: { grupo: GrupoPendencia; titulo: string; icone: ReactNode }[] = [
  { grupo: "rascunho", titulo: "Contrato não enviado", icone: <FileText size={16} /> },
  { grupo: "aguardando", titulo: "Aguardando o casal assinar", icone: <Clock size={16} /> },
  { grupo: "semContrato", titulo: "Confirmado sem contrato", icone: <UserPlus size={16} /> },
];

export default function Pendencias() {
  const router = useRouter();
  const confirmar = useConfirmar();
  const [clientes, setClientes] = useState<ClienteLista[] | null>(null);
  /* as chaves já limpas vivem em estado (e não só no localStorage) pra a
     lista reagir na hora que o fotógrafo limpa uma */
  const [limpas, setLimpas] = useState<string[]>([]);
  const montado = useRef(true);

  useEffect(() => {
    montado.current = true;
    return () => { montado.current = false; };
  }, []);

  /* Busca e DEVOLVE (null = sessão expirou); o estado é escrito no callback
     do efeito. O "já limpei" é lido junto: só existe no browser. */
  const carregar = useCallback(async (minMs?: number): Promise<{ clientes: ClienteLista[]; limpas: string[] } | null> => {
    let sessaoExpirou = false;
    const lista = api<RespostaLista>("/api/estudio?lista=1").catch((e: Error) => {
      if (e.message === ERRO_SESSAO) sessaoExpirou = true;
      return {} as RespostaLista;
    });
    const [l] = await Promise.all([lista, esperaMin(minMs)]);
    if (sessaoExpirou) { router.replace("/entrar"); return null; }
    return { clientes: l.clientes ?? [], limpas: lerLimpas() };
  }, [router]);

  const aplicar = useCallback((r: { clientes: ClienteLista[]; limpas: string[] } | null) => {
    if (!r || !montado.current) return;
    setLimpas(r.limpas);
    setClientes(r.clientes);
  }, []);

  useEffect(() => {
    carregar()
      .then(aplicar)
      .catch(() => { /* falha de rede: fica no skeleton */ });
  }, [carregar, aplicar]);

  const atualizar = useCallback(async () => {
    setClientes(null);
    await carregar(MIN_ATUALIZAR_MS).then(aplicar).catch(() => { /* fica no skeleton */ });
  }, [carregar, aplicar]);

  async function limpar(grupo: GrupoPendencia, c: ClienteLista) {
    const ok = await confirmar({
      titulo: "Limpar pendência",
      texto: "Tirar " + nomeCasal(c) + " da lista? Se algo mudar nesse contrato, ele volta a aparecer aqui.",
      rotuloOk: "Limpar",
    });
    if (!ok) return;
    const chave = chavePend(grupo, c);
    const atuais = lerLimpas();
    const novas = atuais.includes(chave) ? atuais : [...atuais, chave];
    gravarLimpas(novas);
    setLimpas(novas);
  }

  const grupos = clientes ? pendenciasDe(clientes, limpas) : null;
  const secoes = grupos ? SECOES.filter((s) => grupos[s.grupo].length) : [];

  return (
    <PuxarPraAtualizar aoAtualizar={atualizar}>
      <div className="mx-auto max-w-[960px]">
        {/* no celular isto vive no cabeçalho (ver cabecalho-mobile.tsx) */}
        <Link
          href="/painel"
          className={`-ml-2.5 mb-0.5 inline-flex items-center gap-1.5 rounded-[10px] px-2.5 py-2 text-[13px] text-ink-soft no-underline hover:bg-soft hover:text-ink max-md:hidden`}
        >
          <ArrowLeft size={16} /> Início
        </Link>
        <div className="mb-[22px] mt-2 flex flex-col gap-[5px]">
          <h1 className="m-0 text-[22px] font-semibold tracking-tight text-ink sm:text-[26px] max-md:hidden">Precisa de atenção</h1>
          <p className="m-0 text-[14.5px] leading-[1.5] text-ink-soft">
            Pontas soltas e passos esquecidos: rascunhos pra enviar, contratos esperando assinatura e clientes confirmados sem contrato.
          </p>
        </div>

        {!grupos ? (
          <PendenciasSkeleton />
        ) : !secoes.length ? (
          <p className="m-0 py-5 text-sm text-ink-soft">Tudo em dia por aqui, nada pendente. 🎉</p>
        ) : (
          secoes.map((s, i) => (
            <div key={s.grupo} className="mb-[22px] animate-entra motion-reduce:animate-none" style={{ animationDelay: (i * 90) + "ms" }}>
              <div className="mb-3 flex items-center gap-2.5">
                <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] bg-accent-tint text-accent">{s.icone}</span>
                <span className="text-sm font-semibold text-ink">{s.titulo}</span>
                <span className="ml-auto text-[12.5px] font-medium text-ink-soft">{grupos[s.grupo].length}</span>
              </div>
              <ul className="m-0 flex list-none flex-col gap-2 p-0">
                {grupos[s.grupo].map((c) => (
                  <li key={c.id}>
                    <Deslizar
                      larguraAcao={LARGURA_LIMPAR}
                      rotuloOpcoes={"Opções da pendência de " + nomeCasal(c)}
                      className="rounded-[14px] bg-soft"
                      classeFrente={`gap-3 bg-soft py-2.5 pl-3.5 pr-2 hover:bg-line`}
                      acoes={[{
                        chave: "limpar",
                        rotulo: "Limpar",
                        icone: <Check size={18} strokeWidth={2} />,
                        classe: `bg-[#3E9E6C] hover:bg-[#369061]`,
                        aoAcionar: () => { void limpar(s.grupo, c); },
                      }]}
                    >
                      <Link href={"/painel/clientes/" + c.id} className="flex min-w-0 flex-1 items-center gap-3 no-underline">
                        <span className="inline-flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full bg-accent-tint text-accent">
                          <Users size={15} />
                        </span>
                        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                          <span className="truncate text-[14.5px] font-medium text-ink">{nomeCasal(c)}</span>
                          <span className="text-[12.5px] tabular-nums text-ink-soft">{dataCurta(c.data_evento)}</span>
                        </span>
                      </Link>
                    </Deslizar>
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
      </div>
    </PuxarPraAtualizar>
  );
}

function PendenciasSkeleton() {
  return (
    <div className="mb-[22px]" aria-busy="true" aria-label="Carregando">
      <div className="mb-3 flex items-center gap-2.5">
        <Sk className="h-8 w-8 rounded-[9px]" />
        <SkLinha className="w-[150px]" />
      </div>
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {[0, 1].map((i) => (
          <li key={i} className="flex items-center gap-3.5 rounded-[14px] bg-soft px-3.5 py-2.5">
            <SkCirculo />
            <SkLinha className="flex-1" />
          </li>
        ))}
      </ul>
    </div>
  );
}

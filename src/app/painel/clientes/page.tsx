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
import { Check, Minus, Plus, Trash2, User } from "lucide-react";
import { TituloMobile } from "@/components/cabecalho-mobile";
import { Botao, Selo } from "@/components/ui";
import { useConfirmar } from "@/components/ModalConfirmar";
import { PuxarPraAtualizar } from "@/components/PuxarPraAtualizar";
import { SkLinha } from "@/components/Skeleton";
import { moeda } from "@/lib/util";
import {
  api, dataCurta, esperaMin, nomeCasal, ERRO_SESSAO, ROTULO_STATUS,
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
    return clientes.filter((c) => {
      if (status && c.status !== status) return false;
      /* "Todos os status" esconde arquivado: arquivar existe justamente pra
         tirar da frente, e só o filtro de Arquivado traz de volta */
      if (!status && c.status === "arquivado") return false;
      return true;
    });
  }, [clientes, status]);

  /* ---------- seleção múltipla ----------
     Pedido do Ricardo em 22/10/2026, ajustado por ele no mesmo dia: não há
     "modo seleção". Marcar é clicar no AVATAR da linha, sempre, e a caixa ao
     lado do "Casal" marca a lista toda. O resto da linha continua abrindo a
     ficha, que é o que ela sempre fez.

     Virou isto depois da primeira versão (um botão "Selecionar" que ligava um
     modo): o alvo já existia na linha e estava sem função nenhuma. */
  const [marcados, setMarcados] = useState<string[]>([]);

  /* "todos" é sobre o que está NA TELA: com filtro ligado, marcar todos marca
     os visíveis, que é o que a pessoa está vendo. */
  const todosMarcados = visiveis.length > 0 && marcados.length === visiveis.length;

  function alternarMarcado(id: string) {
    setMarcados((m) => (m.includes(id) ? m.filter((x) => x !== id) : [...m, id]));
  }

  function sairDaSelecao() {
    setMarcados([]);
  }

  async function excluirMarcados() {
    const quantos = marcados.length;
    if (!quantos) return;
    const ok = await confirmar({
      titulo: quantos === 1 ? "Excluir de vez?" : "Excluir " + quantos + " clientes?",
      texto: (quantos === 1
        ? "O cliente será apagado permanentemente"
        : "Os " + quantos + " clientes selecionados serão apagados permanentemente") +
        ", com contrato e histórico. Não dá pra desfazer.",
      rotuloOk: "Excluir",
      perigo: true,
    });
    if (!ok) return;
    try {
      await api("/api/estudio", { acao: "excluir", ids: marcados });
      sairDaSelecao();
      setClientes(null);
      const l = await carregar();
      if (l && montado.current) setClientes(l);
    } catch (e) {
      if ((e as Error).message === ERRO_SESSAO) router.replace("/entrar");
      else alert("Não deu pra excluir. Tente de novo.");
    }
  }

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

  const acaoNovoCliente = useMemo(
    () => ({ rotulo: "Novo cliente", Icone: Plus, aoAcionar: () => router.push("/painel/clientes/novo") }),
    [router],
  );

  return (
    <PuxarPraAtualizar aoAtualizar={atualizar}>
    <div className="mx-auto max-w-[1100px]">
      {/* No celular esta linha inteira sai: o título vive no cabeçalho e o
          "Novo cliente" vira o botão redondo do canto dele, no formato do
          "marcar todas como lidas" das Notificações. */}
      <TituloMobile titulo="Clientes" acao={acaoNovoCliente} />
      <div className="mb-[18px] hidden items-center justify-between gap-4 md:flex">
        <h1 className="m-0 text-[22px] font-semibold tracking-tight text-ink sm:text-[26px]">Clientes</h1>
        <Botao className="h-10 whitespace-nowrap px-4 text-[13.5px]" onClick={() => router.push("/painel/clientes/novo")}>
          <Plus size={16} /> Novo cliente
        </Botao>
      </div>

      {/* Sem campo de busca aqui: quem procura casal já tem a barra do topo no
          computador e a lupa da barra de baixo no celular, e as duas levam
          direto pra ficha. Um segundo campo na mesma tela faria a pessoa
          escolher entre dois jeitos de fazer a mesma coisa.

          O status virou PILL (o padrão do estúdio original, o mesmo dos
          atalhos da previsão): num menu fechado o filtro ativo fica escondido
          atrás de um clique, e aqui ele é a explicação de por que a lista tem
          o tamanho que tem. */}
      <div className="mb-[18px] flex flex-wrap items-center gap-2">
        {FILTROS.map((f) => (
          <button
            key={f.valor}
            type="button"
            aria-pressed={status === f.valor}
            onClick={() => setStatus(f.valor)}
            className={
              "inline-flex cursor-pointer items-center rounded-full px-3.5 py-[7px] text-[12.5px] font-semibold " +
              "transition-[background,color] duration-150 [-webkit-tap-highlight-color:transparent] " +
              /* inativa em papel: em soft ela tinha a MESMA cor da página e
                 virava texto solto, sem cara de botão */
              (status === f.valor ? "bg-accent text-white" : `bg-paper text-ink-soft hover:bg-line hover:text-ink`)
            }
          >
            {f.rotulo}
          </button>
        ))}

      </div>

      {/* no computador a lista é uma tabela num cartão só; no celular, cards
          soltos (as duas formas convivem nas mesmas linhas) */}
      {/* Sem sombra, a pedido do Ricardo (22/10/2026): o cartão branco
          sobre a página soft já se separa pela cor, e o cabeçalho tingido
          marca onde a tabela começa. */}
      <div className="md:overflow-hidden md:rounded-[22px] md:bg-paper">
        {/* CABEÇALHO QUE VIRA BARRA DE AÇÃO.
            Com alguém marcado, a mesma faixa deixa de listar colunas e passa a
            dizer o que dá pra fazer com a seleção (pedido do Ricardo em
            22/10/2026, no lugar da barra flutuante que existia antes).

            São duas camadas no MESMO lugar, trocando por opacidade e um passo
            de 4px: a de colunas sobe e some, a de ações entra de baixo. A
            caixa de marcar fica FORA das duas, no mesmo ponto, porque é o que
            amarra uma coisa na outra: o olho vê a faixa mudar de função, não
            uma barra nova aparecer.

            A altura não muda (a camada de ações é absoluta), então a lista não
            pula quando a seleção começa ou acaba.

            `translate` e não `transform`: no Tailwind 4 as classes translate-*
            escrevem a propriedade `translate`, e uma transição em `transform`
            simplesmente não anima. */}
        <div
          className={
            "relative py-3.5 pl-[18px] pr-[18px] transition-colors duration-200 md:block " +
            /* no celular a lista é longa e a faixa fica no TOPO dela: sem
               grudar, você marca um cliente lá embaixo e o botão de excluir
               some da tela. Gruda logo abaixo do cabeçalho do app (56px), que
               também é sticky. No computador a lista cabe e a faixa é o
               cabeçalho da tabela, que não precisa seguir ninguém.

               `md:relative` e NUNCA `md:static`: as duas camadas aqui dentro
               são absolutas e precisam desta faixa como âncora. Com `static`
               elas se penduram no container da página e vão parar fora da
               tabela, uma em cada ponta da tela (foi o que aconteceu). */
            "sticky top-14 z-20 md:relative md:top-auto md:z-auto " +
            /* Em repouso, accent-tint: diferente da página (soft) e das
               linhas (paper), que era o que faltava, já que antes o cabeçalho
               tinha a cor exata do fundo. Com seleção, petróleo CHEIO: a faixa
               muda de função e a cor diz isso antes de qualquer texto. */
            (marcados.length
              ? "block rounded-t-2xl bg-accent md:rounded-none"
              : "hidden bg-accent-tint")
          }
        >
          {/* marca a lista inteira (o que está VISÍVEL, então respeita o
              filtro). Alinhada na coluna dos avatares: é o mesmo alvo da
              linha, repetido no cabeçalho. */}
          <button
            type="button"
            role="checkbox"
            aria-checked={todosMarcados ? true : marcados.length ? "mixed" : false}
            aria-label={todosMarcados ? "Desmarcar todos" : "Marcar todos"}
            onClick={() => setMarcados(todosMarcados ? [] : visiveis.map((x) => x.id))}
            className={
              "absolute left-[21px] top-1/2 z-[1] flex h-[18px] w-[18px] -translate-y-1/2 cursor-pointer items-center " +
              "justify-center rounded-[6px] transition-colors md:left-[25px] " +
              (marcados.length ? "bg-paper text-accent" : `bg-paper text-transparent hover:text-accent-deep`)
            }
          >
            {todosMarcados
              ? <Check size={12} strokeWidth={3} />
              : marcados.length ? <Minus size={12} strokeWidth={3} /> : null}
          </button>

          {/* camada 1: os nomes das colunas */}
          <div
            aria-hidden={marcados.length ? true : undefined}
            className={
              /* gap-x-3 igual ao das linhas: sem ele cada coluna do
                 cabeçalho começava 12px por coluna à direita do conteúdo,
                 porque nas linhas os gaps saem do espaço da 1ª coluna (1fr) e
                 empurram as outras pra esquerda */
              "hidden gap-x-3 pl-[44px] text-[11px] font-semibold uppercase tracking-[.06em] text-accent-deep " +
              "transition-[opacity,translate] duration-200 ease-[var(--ease-desliza)] md:grid " +
              (marcados.length ? "pointer-events-none -translate-y-1 opacity-0 " : "") + COLUNAS
            }
          >
            <span>Casal</span><span>Data</span><span>Status</span>
            <span>Total</span><span aria-label="Ações" />
          </div>

          {/* camada 2: o que fazer com os marcados */}
          <div
            aria-hidden={marcados.length ? undefined : true}
            className={
              "absolute inset-y-0 left-[58px] right-3 flex items-center gap-2 md:left-[62px] md:right-[18px] " +
              "transition-[opacity,translate] duration-200 ease-[var(--ease-desliza)] " +
              (marcados.length ? "" : "pointer-events-none translate-y-1 opacity-0")
            }
          >
            <span className="text-[13px] font-semibold text-white">
              {marcados.length === 1 ? "1 selecionado" : marcados.length + " selecionados"}
            </span>
            <button
              type="button"
              onClick={() => setMarcados(todosMarcados ? [] : visiveis.map((x) => x.id))}
              className={"ml-auto cursor-pointer rounded-full px-3 py-1.5 text-[12.5px] font-semibold text-white/85 transition-colors hover:bg-white/10 hover:text-white"}
            >
              {todosMarcados ? "Limpar" : "Todos"}
            </button>
            <button
              type="button"
              onClick={() => void excluirMarcados()}
              /* branco com texto vermelho: vermelho cheio sobre o petróleo
                 escuro somaria dois tons escuros e o botão perderia a borda */
              className={"inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full bg-paper px-3.5 text-[12.5px] font-semibold text-erro " +
                `transition-[background,transform] duration-150 hover:bg-erro-tint active:scale-[.96]`}
            >
              <Trash2 size={14} />
              Excluir
            </button>
          </div>
        </div>

        {!clientes ? (
          <ListaSkeleton />
        ) : !visiveis.length ? (
          <p className="m-0 rounded-2xl bg-paper px-[18px] py-16 text-center text-[14.5px] text-ink-soft md:rounded-none md:bg-transparent">
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
                      "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5 rounded-[18px] bg-paper py-3.5 pl-[58px] pr-[46px] no-underline " +
                      "md:items-center md:rounded-none md:py-[17px] md:pl-[62px] md:pr-[18px] " +
                      `transition-colors hover:bg-soft ` +
                      (marcados.includes(c.id) ? "!bg-accent-tint " : "") + COLUNAS
                    }
                  >
                    <span className="col-span-2 flex items-center md:col-span-1">
                      <span className={"truncate text-base font-medium md:text-[14.5px] " + (c.noivo || c.noiva ? "text-ink" : "text-ink-soft")}>{nome}</span>
                    </span>
                    {/* "a definir" é ausência de dado, então sai no tom
                        apagado mesmo na tabela, onde a data real é escura */}
                    <span className={"text-[13.5px] text-ink-soft md:text-[14.5px] " + (c.data_evento ? "md:text-ink" : "")}>{dataCurta(c.data_evento)}</span>
                    <span className="row-span-2 justify-self-end md:row-span-1 md:justify-self-start">
                      <Selo tom={TOM_STATUS[st] ?? "neutro"}>{ROTULO_STATUS[st] ?? st}</Selo>
                    </span>
                    {/* alinhado à ESQUERDA, como o título em cima (pedido do
                        Ricardo: começo com começo em todas as colunas).
                        tabular-nums segura a leitura dos valores: os dígitos
                        têm a mesma largura e a vírgula dos centavos cai no
                        mesmo ponto quando o número de casas é igual. */}
                    <span className="text-left text-[14.5px] font-semibold tabular-nums text-ink">
                      {c.total != null && c.total !== "" ? moeda(Number(c.total)) : ""}
                    </span>
                    <span className="hidden md:block" />
                  </Link>
                  {/* AVATAR = caixa de marcar (pedido do Ricardo). Fica FORA do
                      link porque botão dentro de link não é HTML válido e o
                      clique teria que ser desfeito na mão; aqui ele é um botão
                      de verdade, com foco e teclado próprios.
                      Marcado vira pastilha cheia com o visto; parado mostra o
                      ícone de pessoa (pedido do Ricardo: nada de iniciais) e,
                      no hover, o visto, avisando que dá pra clicar. */}
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={marcados.includes(c.id)}
                    aria-label={"Selecionar " + nome}
                    onClick={() => alternarMarcado(c.id)}
                    className={
                      "absolute left-3.5 top-2.5 z-[1] flex h-8 w-8 cursor-pointer items-center justify-center rounded-full " +
                      "text-xs font-semibold tracking-[.02em] transition-colors md:left-[18px] md:top-1/2 md:-translate-y-1/2 " +
                      (marcados.includes(c.id)
                        ? "bg-accent text-white"
                        : `bg-soft text-accent hover:bg-accent hover:text-white`)
                    }
                  >
                    {marcados.includes(c.id)
                      ? <Check size={16} strokeWidth={2.5} />
                      : (
                        <>
                          <span className="group-hover:hidden"><User size={16} strokeWidth={2} /></span>
                          <span className="hidden group-hover:inline"><Check size={16} strokeWidth={2.5} /></span>
                        </>
                      )}
                  </button>

                  {/* fora do link pra não navegar; sutil até passar o mouse.
                      Some no modo seleção: ali quem apaga é a barra, e dois
                      caminhos de apagar na mesma tela é pedir engano. */}
                  <button
                    type="button"
                    hidden={marcados.length > 0}
                    title="Excluir cliente"
                    aria-label={"Excluir " + nome}
                    onClick={() => excluir(c)}
                    className={
                      "absolute right-1.5 top-1.5 inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg text-ink-soft opacity-30 transition-[opacity,color,background] " +
                      /* no computador some até passar o mouse: nove lixeiras
                         cinzas paradas numa coluna era o ruído mais forte da
                         tabela. No celular fica, porque lá não existe hover. */
                      "md:right-3 md:top-1/2 md:h-7 md:w-7 md:-translate-y-1/2 md:opacity-0 " +
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
        <li key={i} className="rounded-[18px] bg-paper px-3.5 py-[18px] md:rounded-none md:px-6">
          <SkLinha className="h-4 w-full" />
        </li>
      ))}
    </ul>
  );
}

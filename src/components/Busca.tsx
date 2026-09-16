/*
  Busca de casal: campo do cabeçalho no computador e tela cheia no celular.
  Portada de `pintarResultados` / `linhaResultado` / `renderBuscaMobile` do
  estudio.html do Jordan, onde até 2026-07-28 o campo do topo era decoração.

  Decisões herdadas de lá:
  - A busca não troca a tela que está aberta nem mexe no filtro da lista de
    clientes. Ela mostra os achados e espera você escolher um.
  - Filtra o cache em memória a cada tecla, sem uma ida ao servidor por letra.
  - Cada resultado mostra nome, data e status à esquerda e o valor à direita,
    que é o suficiente pra reconhecer o casal certo sem abrir a ficha.

  Diferença daqui: no original as linhas eram separadas por um fio. Aqui a
  separação é o respiro, porque nada neste produto usa borda pra separar.
*/
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { TelaMobile, TopoTelaMobile, CorpoTelaMobile } from "@/components/TelaMobile";
import { BotaoLimparBusca } from "@/components/ui";
import { filtrarClientes, garantirClientes } from "@/lib/busca";
import { dataCurta, iniciais, nomeCasal, ROTULO_STATUS, type ClienteLista } from "@/lib/painel";
import { moeda } from "@/lib/util";


/* ---------- uma linha de resultado, igual nos dois lugares ---------- */

function LinhaResultado({ cliente, grande, aoEscolher }: { cliente: ClienteLista; grande?: boolean; aoEscolher: () => void }) {
  const sub = [dataCurta(cliente.data_evento), ROTULO_STATUS[cliente.status ?? ""] ?? ""]
    .filter(Boolean).join(" · ");
  return (
    <button
      type="button"
      onClick={aoEscolher}
      className={
        "grid w-full cursor-pointer grid-cols-[auto_1fr_auto] items-center gap-3 rounded-xl text-left " +
        `hover:bg-soft ` + (grande ? "px-2 py-3" : "px-2.5 py-2.5")
      }
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-soft text-[12px] font-semibold text-accent">
        {iniciais(cliente.noivo, cliente.noiva)}
      </span>
      <span className="min-w-0">
        <span className={"block truncate font-medium text-ink " + (grande ? "text-[15.5px]" : "text-sm")}>
          {nomeCasal(cliente)}
        </span>
        <span className="mt-0.5 block truncate text-[13px] text-ink-soft">{sub}</span>
      </span>
      <span className="text-[13.5px] font-semibold whitespace-nowrap tabular-nums text-accent-deep">
        {cliente.total != null ? moeda(Number(cliente.total)) : ""}
      </span>
    </button>
  );
}

function Aviso({ texto, grande }: { texto: string; grande?: boolean }) {
  return <div className={"text-center text-ink-soft " + (grande ? "px-2.5 py-10 text-sm" : "px-2.5 py-8 text-[13.5px]")}>{texto}</div>;
}

/** Resultados prontos, ou a mensagem certa pra quando não há nenhum. */
function Resultados({
  clientes, termo, grande, avisoVazio, aoEscolher,
}: {
  clientes: ClienteLista[];
  termo: string;
  grande?: boolean;
  /** o que dizer com o campo ainda vazio; sem isso, nada aparece */
  avisoVazio?: string;
  aoEscolher: (c: ClienteLista) => void;
}) {
  const achados = useMemo(() => filtrarClientes(clientes, termo), [clientes, termo]);
  if (!termo.trim()) return avisoVazio ? <Aviso texto={avisoVazio} grande={grande} /> : null;
  if (!achados.length) return <Aviso texto="Nenhum casal encontrado." grande={grande} />;
  return (
    <>
      {achados.map((c) => (
        <LinhaResultado key={c.id} cliente={c} grande={grande} aoEscolher={() => aoEscolher(c)} />
      ))}
    </>
  );
}

/* ---------- lista de clientes, carregada uma vez por sessão de busca ---------- */

function useClientesDaBusca(ativo: boolean) {
  const [clientes, setClientes] = useState<ClienteLista[]>([]);

  useEffect(() => {
    if (!ativo) return;
    let vivo = true;
    garantirClientes().then((l) => { if (vivo) setClientes(l); });
    return () => { vivo = false; };
  }, [ativo]);

  return clientes;
}

/* ---------- computador: campo no cabeçalho com os achados embaixo ---------- */

export function BuscaTopo() {
  const router = useRouter();
  const [termo, setTermo] = useState("");
  const [aberto, setAberto] = useState(false);
  const caixa = useRef<HTMLDivElement>(null);
  /* só vai ao servidor depois da primeira letra: quem nunca busca não paga nada */
  const clientes = useClientesDaBusca(termo.length > 0);

  useEffect(() => {
    if (!aberto) return;
    function foraDaCaixa(ev: Event) {
      const alvo = ev.target as Node | null;
      if (alvo && caixa.current?.contains(alvo)) return;
      setAberto(false);
    }
    function tecla(ev: KeyboardEvent) {
      if (ev.key === "Escape") setAberto(false);
    }
    document.addEventListener("pointerdown", foraDaCaixa);
    document.addEventListener("keydown", tecla);
    return () => {
      document.removeEventListener("pointerdown", foraDaCaixa);
      document.removeEventListener("keydown", tecla);
    };
  }, [aberto]);

  function escolher(c: ClienteLista) {
    setTermo("");
    setAberto(false);
    router.push("/painel/clientes/" + c.id);
  }

  return (
    <div ref={caixa} className="relative mx-auto hidden w-full max-w-[420px] md:block">
      <label className="flex w-full items-center gap-2 rounded-[10px] bg-soft px-3 py-2">
        <Search size={15} className="shrink-0 text-ink-soft" />
        <input
          type="search"
          value={termo}
          placeholder="Buscar"
          aria-label="Buscar casal"
          autoComplete="off"
          onChange={(e) => { setTermo(e.target.value); setAberto(!!e.target.value.trim()); }}
          onFocus={() => { if (termo.trim()) setAberto(true); }}
          className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-ink-soft"
        />
        {termo ? <BotaoLimparBusca aoLimpar={() => { setTermo(""); setAberto(false); }} /> : null}
      </label>

      {aberto && termo.trim() ? (
        <div className="absolute inset-x-0 top-[calc(100%+8px)] z-40 max-h-[min(60vh,420px)] overflow-y-auto rounded-2xl bg-paper p-1.5 shadow-alta">
          <Resultados clientes={clientes} termo={termo} aoEscolher={escolher} />
        </div>
      ) : null}
    </div>
  );
}

/* ---------- celular: tela cheia, resultado a cada tecla ---------- */

/* Quanto o foco espera depois de abrir a busca. A folha leva 340ms pra subir
   (--ease-desliza, no TelaMobile); os 40ms a mais deixam ela assentar antes do
   teclado entrar em cena. */
const ESPERA_TECLADO = 380;

/* Sem `daEsquerda`: a busca não entra pelo lado, entra de baixo, então a
   posição do ícone na barra não diz nada sobre ela. */
export function TelaBuscaMobile({ aberta, aoFechar }: { aberta: boolean; aoFechar: () => void }) {
  const router = useRouter();
  const [termo, setTermo] = useState("");
  const campo = useRef<HTMLInputElement>(null);
  const clientes = useClientesDaBusca(aberta);

  /* O foco espera a folha terminar de subir: com os dois ao mesmo tempo, o
     teclado sobe por cima de uma tela que ainda está andando e as duas
     animações brigam. `preventScroll` porque, sem ele, o navegador rola pra
     trazer o campo à vista.

     ATENÇÃO, e isto vale pro iPhone: o Safari do iOS só abre o teclado quando
     o `focus()` acontece DENTRO do gesto que o usuário fez. Chamado de um
     temporizador, como aqui, ele foca o campo mas NÃO levanta o teclado — quem
     abre é o primeiro toque no campo. No Android e no computador o teclado
     sobe sozinho depois da espera. Baixar ESPERA_TECLADO pra 0 devolve o
     comportamento antigo (teclado imediato em toda plataforma). */
  useEffect(() => {
    if (!aberta) return;
    const t = setTimeout(() => campo.current?.focus({ preventScroll: true }), ESPERA_TECLADO);
    return () => clearTimeout(t);
  }, [aberta]);

  function fechar() {
    setTermo("");
    campo.current?.blur();
    aoFechar();
  }

  return (
    <TelaMobile aberta={aberta} de="baixo" rotulo="Buscar casal">
      <TopoTelaMobile>
        <label className="flex min-w-0 flex-1 items-center gap-2.5 rounded-full bg-soft px-4 py-2.5">
          <Search size={17} className="shrink-0 text-ink-soft" />
          <input
            ref={campo}
            type="search"
            value={termo}
            placeholder="Buscar casal"
            aria-label="Buscar casal"
            autoComplete="off"
            enterKeyHint="search"
            tabIndex={aberta ? 0 : -1}
            onChange={(e) => setTermo(e.target.value)}
            className="w-full min-w-0 bg-transparent text-base text-ink outline-none placeholder:text-ink-soft"
          />
        </label>
        <button
          type="button"
          tabIndex={aberta ? 0 : -1}
          onClick={fechar}
          className="shrink-0 cursor-pointer px-1 py-2 text-sm text-accent"
        >
          Cancelar
        </button>
      </TopoTelaMobile>

      <CorpoTelaMobile>
        <Resultados
          clientes={clientes}
          termo={termo}
          grande
          avisoVazio="Digite o nome do casal."
          aoEscolher={(c) => { setTermo(""); aoFechar(); router.push("/painel/clientes/" + c.id); }}
        />
      </CorpoTelaMobile>
    </TelaMobile>
  );
}

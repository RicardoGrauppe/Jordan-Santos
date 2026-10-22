/*
  Produtos e serviços (22/10/2026). O fotógrafo decide aqui o que vende e o
  preço de tabela; é daqui que saem as opções do cartão "Pacote e adicionais"
  do editor do contrato. Antes isto era fixo no código (lib/catalogo.ts).

  Pacote é escolha única no contrato; adicional soma. Pacote pode "já incluir"
  adicionais (o Eternal traz o pré-wedding): com ele escolhido, esses somem da
  lista do contrato.

  Mudar preço aqui não mexe em cliente nenhum: o cliente guarda o valor do
  momento em que o item foi escolhido.
*/
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Check, ChevronRight, Package, Plus, Sparkles, Trash2, X } from "lucide-react";
import { Botao, Campo } from "@/components/ui";
import { TituloMobile } from "@/components/cabecalho-mobile";
import { useConfirmar } from "@/components/ModalConfirmar";
import { ERRO_SESSAO, api } from "@/lib/painel";
import { formatarMoeda, parseMoeda } from "@/lib/ficha";
import type { Produto, TipoProduto } from "@/lib/produtos";

export default function PaginaProdutos() {
  const router = useRouter();
  const [produtos, setProdutos] = useState<Produto[] | null>(null);
  const [erro, setErro] = useState("");
  /* null = fechado; "novo" = criando; Produto = editando */
  const [editando, setEditando] = useState<Produto | "novo" | null>(null);

  const carregar = useCallback(() =>
    api<{ produtos: Produto[] }>("/api/produtos")
      .then((r) => setProdutos(r.produtos))
      .catch((e: Error) => {
        if (e.message === ERRO_SESSAO) router.replace("/entrar");
        else setErro("Não consegui carregar os produtos.");
      }), [router]);

  useEffect(() => {
    let vivo = true;
    api<{ produtos: Produto[] }>("/api/produtos")
      .then((r) => { if (vivo) setProdutos(r.produtos); })
      .catch((e: Error) => {
        if (!vivo) return;
        if (e.message === ERRO_SESSAO) router.replace("/entrar");
        else setErro("Não consegui carregar os produtos.");
      });
    return () => { vivo = false; };
  }, [router]);

  const acaoNovo = useMemo(() => ({ rotulo: "Novo produto", Icone: Plus, aoAcionar: () => setEditando("novo") }), []);

  const pacotes = (produtos || []).filter((p) => p.tipo === "pacote");
  const adicionais = (produtos || []).filter((p) => p.tipo === "adicional");

  return (
    <div className="mx-auto max-w-[860px]">
      <TituloMobile titulo="Produtos e serviços" acao={acaoNovo} />
      <div className="mb-2 hidden items-center justify-between gap-4 md:flex">
        <h1 className="m-0 text-[22px] font-semibold tracking-tight text-ink sm:text-[26px]">Produtos e serviços</h1>
        <Botao className="h-10 whitespace-nowrap px-4 text-[13.5px]" onClick={() => setEditando("novo")}>
          <Plus size={16} /> Novo produto
        </Botao>
      </div>
      <p className="m-0 mb-6 text-[14px] leading-[1.6] text-ink-soft">
        O que você vende e o preço de tabela. É daqui que saem as opções do contrato; o valor de cada casal
        ainda pode ser ajustado no contrato dele.
      </p>

      {erro ? <p className="m-0 text-[13px] text-erro">{erro}</p> : null}

      {produtos === null && !erro ? (
        <div className="grid gap-5">
          {[0, 1].map((i) => <div key={i} className="h-[220px] animate-pulse rounded-[22px] bg-paper shadow-card" />)}
        </div>
      ) : produtos ? (
        <div className="grid gap-5">
          <Grupo icone={<Package size={16} />} titulo="Pacotes" texto="O casal escolhe um."
            itens={pacotes} catalogo={produtos} aoAbrir={setEditando} />
          <Grupo icone={<Sparkles size={16} />} titulo="Adicionais" texto="Somam ao pacote, quantos o casal quiser."
            itens={adicionais} catalogo={produtos} aoAbrir={setEditando} />
        </div>
      ) : null}

      {editando ? (
        <ModalProduto
          produto={editando === "novo" ? null : editando}
          catalogo={produtos || []}
          aoFechar={() => setEditando(null)}
          aoSalvar={async () => { await carregar(); setEditando(null); }}
        />
      ) : null}
    </div>
  );
}

function Grupo({ icone, titulo, texto, itens, catalogo, aoAbrir }: {
  icone: React.ReactNode; titulo: string; texto: string;
  itens: Produto[]; catalogo: Produto[]; aoAbrir: (p: Produto) => void;
}) {
  return (
    <section className="rounded-[22px] bg-paper px-4 pb-4 pt-5 shadow-card sm:px-6 sm:pb-5">
      <div className="mb-3 flex items-center gap-2.5 px-2 sm:px-0">
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[13px] bg-accent-tint text-accent">{icone}</span>
        <div>
          <h2 className="m-0 text-[15px] font-semibold text-ink">{titulo}</h2>
          <p className="m-0 text-[12.5px] text-ink-soft">{texto}</p>
        </div>
      </div>
      {itens.length ? (
        <div className="flex flex-col gap-0.5">
          {itens.map((p) => {
            const inclusos = p.inclui.map((id) => catalogo.find((x) => x.id === id)?.curto).filter(Boolean);
            return (
              <button key={p.id} type="button" onClick={() => aoAbrir(p)}
                className={"group flex w-full cursor-pointer items-center gap-3 rounded-[12px] px-2.5 py-3 text-left transition-colors hover:bg-soft " +
                  (p.ativo ? "" : "opacity-55")}>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-semibold text-ink">{p.curto}</span>
                  <span className="block truncate text-[12.5px] text-ink-soft">
                    {p.nome !== p.curto ? p.nome : ""}
                    {inclusos.length ? (p.nome !== p.curto ? " · " : "") + "Inclui " + inclusos.join(", ") : ""}
                  </span>
                </span>
                {!p.ativo ? (
                  <span className="shrink-0 rounded-[6px] bg-soft px-2 py-[3px] text-[10.5px] font-semibold tracking-[.03em] text-ink-soft">Desativado</span>
                ) : null}
                <span className="shrink-0 whitespace-nowrap text-[14px] font-semibold tabular-nums text-ink">R$ {formatarMoeda(p.preco)}</span>
                <ChevronRight size={16} className="shrink-0 text-ink-soft transition-[translate] duration-150 group-hover:translate-x-0.5" />
              </button>
            );
          })}
        </div>
      ) : (
        <p className="m-0 px-2.5 py-3 text-[13px] text-ink-soft">Nenhum ainda. Crie pelo &quot;Novo produto&quot;.</p>
      )}
    </section>
  );
}

/* ---------- pop-up de criar / editar ---------- */

function ModalProduto({ produto, catalogo, aoFechar, aoSalvar }: {
  produto: Produto | null;
  catalogo: Produto[];
  aoFechar: () => void;
  aoSalvar: () => Promise<void>;
}) {
  const router = useRouter();
  const confirmar = useConfirmar();
  const [tipo, setTipo] = useState<TipoProduto>(produto?.tipo ?? "adicional");
  const [nome, setNome] = useState(produto?.nome ?? "");
  const [curto, setCurto] = useState(produto && produto.curto !== produto.nome ? produto.curto : "");
  const [preco, setPreco] = useState(produto ? formatarMoeda(produto.preco) : "");
  const [inclui, setInclui] = useState<string[]>(produto?.inclui ?? []);
  const [ativo, setAtivo] = useState(produto?.ativo ?? true);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");

  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape" && !ocupado) aoFechar(); };
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [ocupado, aoFechar]);

  const adicionais = catalogo.filter((p) => p.tipo === "adicional" && p.id !== produto?.id);
  const valor = parseMoeda(preco);
  const valido = !!nome.trim() && valor !== null && valor >= 0;

  function falhou(e: unknown) {
    if ((e as Error).message === ERRO_SESSAO) { router.replace("/entrar"); return; }
    setErro((e as Error).message || "Não consegui salvar.");
  }

  async function salvar() {
    if (!valido || ocupado) return;
    setOcupado(true);
    setErro("");
    try {
      const campos = { tipo, nome: nome.trim(), curto: curto.trim(), preco: valor, inclui: tipo === "pacote" ? inclui : [], ativo };
      if (produto) await api("/api/produtos", { acao: "salvar", id: produto.id, ...campos });
      else {
        const r = await api<{ produto: Produto }>("/api/produtos", { acao: "criar", ...campos });
        /* criar só leva o básico; "inclui" e "ativo" vão num segundo passo */
        if ((tipo === "pacote" && inclui.length) || !ativo) {
          await api("/api/produtos", { acao: "salvar", id: r.produto.id, inclui: tipo === "pacote" ? inclui : [], ativo });
        }
      }
      await aoSalvar();
    } catch (e) {
      falhou(e);
    } finally {
      setOcupado(false);
    }
  }

  async function excluir() {
    if (!produto) return;
    const ok = await confirmar({
      titulo: "Excluir " + produto.curto + "?",
      texto: "Some da lista de produtos. Contratos já feitos não mudam.",
      rotuloOk: "Excluir",
      perigo: true,
    });
    if (!ok) return;
    setOcupado(true);
    setErro("");
    try {
      await api("/api/produtos", { acao: "excluir", id: produto.id });
      await aoSalvar();
    } catch (e) {
      if (/desative/.test((e as Error).message)) {
        setAtivo(false);
        setErro("Algum casal já escolheu este produto, então ele não pode ser excluído. Deixei como desativado: salve pra tirar das opções do contrato.");
      } else falhou(e);
    } finally {
      setOcupado(false);
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-5" role="dialog" aria-modal="true"
      aria-label={produto ? "Editar produto" : "Novo produto"}>
      <div className="absolute inset-0 bg-[rgba(29,29,27,.5)] backdrop-blur-[2px]" onClick={() => { if (!ocupado) aoFechar(); }} />
      <form className="relative z-[1] max-h-[calc(100dvh-40px)] w-full max-w-[480px] overflow-y-auto rounded-[18px] bg-paper p-7 pb-6 shadow-alta [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:p-8"
        onSubmit={(e) => { e.preventDefault(); void salvar(); }}>
        <button type="button" onClick={aoFechar} aria-label="Fechar"
          className="absolute right-4 top-4 inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-[10px] text-ink-soft hover:bg-soft hover:text-ink">
          <X size={16} />
        </button>
        <h3 className="m-0 mb-5 flex items-center gap-3 pr-8 text-[22px] font-semibold leading-[1.25] text-ink">
          <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-accent-tint text-accent">
            {tipo === "pacote" ? <Package size={16} /> : <Sparkles size={16} />}
          </span>
          {produto ? "Editar produto" : "Novo produto"}
        </h3>

        <div className="mb-1.5 text-[12.5px] font-medium text-ink-soft">Tipo</div>
        <div role="radiogroup" aria-label="Tipo" className="mb-4 grid grid-cols-2 gap-2">
          {([["pacote", "Pacote", "O casal escolhe um"], ["adicional", "Adicional", "Soma ao pacote"]] as const).map(([v, t, d]) => {
            const marcado = tipo === v;
            return (
              <button key={v} type="button" role="radio" aria-checked={marcado} onClick={() => setTipo(v)}
                className={"flex cursor-pointer items-start gap-2.5 rounded-[14px] p-3 text-left transition-colors " +
                  (marcado ? "bg-accent-tint" : "bg-soft hover:bg-line")}>
                <span className={"mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full transition-colors " + (marcado ? "bg-accent" : "bg-line")}>
                  {marcado ? <span className="h-1.5 w-1.5 rounded-full bg-white" /> : null}
                </span>
                <span>
                  <span className={"block text-[13px] font-semibold " + (marcado ? "text-accent" : "text-ink")}>{t}</span>
                  <span className="block text-[12px] text-ink-soft">{d}</span>
                </span>
              </button>
            );
          })}
        </div>

        <Campo id="produto-nome" rotulo="Nome no contrato" placeholder="Álbum 30x60 (50 páginas, 100 imagens)" autoFocus={!produto}
          value={nome} onChange={(e) => setNome(e.target.value)} autoComplete="off" />
        <Campo id="produto-curto" rotulo="Nome curto" placeholder={nome.trim() ? nome.trim().slice(0, 60) : "Álbum 30x60"}
          dica="Aparece nas listas. Em branco, usa o nome do contrato." value={curto} onChange={(e) => setCurto(e.target.value)} autoComplete="off" />
        <Campo id="produto-preco" rotulo="Preço de tabela (R$)" placeholder="0,00" inputMode="decimal"
          value={preco} onChange={(e) => setPreco(e.target.value)} onBlur={() => { if (valor !== null) setPreco(formatarMoeda(valor)); }} autoComplete="off" />

        {tipo === "pacote" && adicionais.length ? (
          <div className="mb-4">
            <div className="mb-1.5 text-[12.5px] font-medium text-ink-soft">Já inclui</div>
            <div className="flex flex-wrap gap-1.5">
              {adicionais.map((a) => {
                const marcado = inclui.includes(a.id);
                return (
                  <button key={a.id} type="button" aria-pressed={marcado}
                    onClick={() => setInclui((l) => (marcado ? l.filter((x) => x !== a.id) : [...l, a.id]))}
                    className={"inline-flex cursor-pointer items-center gap-1 rounded-[8px] px-2.5 py-1.5 text-[12.5px] font-medium transition-colors " +
                      (marcado ? "bg-accent-tint text-accent" : "bg-soft text-ink-soft hover:bg-line hover:text-ink")}>
                    {marcado ? <Check size={13} strokeWidth={2.5} /> : null}{a.curto}
                  </button>
                );
              })}
            </div>
            <span className="mt-1.5 block text-[11.5px] text-ink-soft/85">Com este pacote escolhido, esses somem das opções do contrato.</span>
          </div>
        ) : null}

        <button type="button" role="switch" aria-checked={ativo} onClick={() => setAtivo((v) => !v)}
          className="mb-1 flex w-full cursor-pointer items-center gap-3 rounded-[12px] bg-soft px-3.5 py-3 text-left transition-colors hover:bg-line">
          <span className="min-w-0 flex-1">
            <span className="block text-[13px] font-semibold text-ink">Ativo</span>
            <span className="block text-[12px] text-ink-soft">{ativo ? "Aparece nas opções do contrato." : "Fora das opções do contrato. Quem já tem continua com ele."}</span>
          </span>
          <span className={"relative inline-flex h-6 w-10 shrink-0 rounded-full transition-colors " + (ativo ? "bg-accent" : "bg-line")}>
            <span className={"absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-card transition-[left] duration-200 " + (ativo ? "left-[18px]" : "left-0.5")} />
          </span>
        </button>

        {erro ? <p className="m-0 mt-3 text-[12.5px] leading-[1.5] text-erro">{erro}</p> : null}

        <div className="mt-6 flex flex-col-reverse gap-2.5 sm:flex-row sm:items-center">
          {produto ? (
            <button type="button" onClick={() => void excluir()} disabled={ocupado}
              className="inline-flex h-11 cursor-pointer items-center justify-center gap-1.5 rounded-xl px-3 text-[13.5px] font-semibold text-erro transition-colors hover:bg-erro-tint disabled:cursor-default disabled:opacity-45 sm:mr-auto">
              <Trash2 size={15} /> Excluir
            </button>
          ) : null}
          <Botao type="button" variante="secundario" onClick={aoFechar} disabled={ocupado} className="sm:min-w-[110px]">Cancelar</Botao>
          <Botao type="submit" disabled={!valido || ocupado} className="sm:min-w-[110px]">{ocupado ? "Salvando…" : "Salvar"}</Botao>
        </div>
      </form>
    </div>,
    document.body,
  );
}

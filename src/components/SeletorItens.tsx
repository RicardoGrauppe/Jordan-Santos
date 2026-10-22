/*
  Pacote e adicionais do casal, dentro da lateral do editor do contrato
  (22/10/2026). Antes isto ficava na ficha do cliente (PillsPacote) e lia o
  catálogo fixo; agora as opções vêm de Produtos e serviços (tabela
  `produtos`) e a escolha acontece onde ela é usada: no contrato.

  Regras que vieram da ficha:
  - pacote é escolha única; adicional soma;
  - o que o pacote escolhido já inclui sai da lista (era o "Eternal já traz o
    pré-wedding", agora configurável no produto);
  - item escolhido tem o valor editável: é o fotógrafo quem negocia o preço
    de cada casal, e o valor fica gravado no cliente, nunca relido do catálogo;
  - total = soma dos itens e entrada = 30%; total editado à mão recalcula a
    entrada, e editar a entrada não mexe no total.

  Item escolhido que saiu do catálogo (desativado ou apagado) continua na
  lista com o valor gravado: sumir com ele apagaria o que já foi vendido.
*/
"use client";

import { useState } from "react";
import { Check, Package, Sparkles } from "lucide-react";
import { formatarMoeda, parseMoeda } from "@/lib/ficha";
import { incluidosPelaEscolha, type ItemEscolhido, type Produto } from "@/lib/produtos";

export function SeletorItens({
  produtos, itens, total, entrada, travado, aoAlternar, aoValorItem, aoTotal, aoEntrada,
}: {
  produtos: Produto[] | null;
  itens: ItemEscolhido[];
  total: number | null;
  entrada: number | null;
  travado: boolean;
  aoAlternar: (p: Produto) => void;
  aoValorItem: (id: string, valor: number) => void;
  aoTotal: (valor: number | null) => void;
  aoEntrada: (valor: number | null) => void;
}) {
  if (produtos === null) return <p className="m-0 mt-3 text-[13px] text-ink-soft">Carregando produtos…</p>;

  const fora = incluidosPelaEscolha(itens, produtos);
  const escolhido = (id: string) => itens.find((i) => i.id === id);
  /* ativos do catálogo + o que o casal já tem e saiu do catálogo */
  const visiveis = (tipo: Produto["tipo"]) => {
    const doCatalogo = produtos.filter((p) => p.tipo === tipo && (p.ativo || escolhido(p.id)) && !fora.has(p.id));
    const orfaos: Produto[] = itens
      .filter((i) => !produtos.some((p) => p.id === i.id) && (i.tipo ?? "adicional") === tipo)
      .map((i) => ({ id: i.id, tipo, nome: i.nome, curto: i.nome, preco: i.valor, inclui: [], ativo: false, ordem: 9999 }));
    return [...doCatalogo, ...orfaos];
  };

  const grupos = [
    { tipo: "pacote" as const, titulo: "Pacote", Icone: Package },
    { tipo: "adicional" as const, titulo: "Adicionais", Icone: Sparkles },
  ];

  if (!produtos.length && !itens.length) {
    return (
      <p className="m-0 mt-3 text-[13px] leading-[1.5] text-ink-soft">
        Nenhum produto cadastrado. Crie os seus em{" "}
        <a href="/painel/produtos" target="_blank" rel="noreferrer" className="font-semibold text-accent">Produtos e serviços</a>.
      </p>
    );
  }

  return (
    <div className="mt-3">
      {grupos.map(({ tipo, titulo, Icone }) => {
        const lista = visiveis(tipo);
        if (!lista.length) return null;
        return (
          <div key={tipo} className="mb-3 last:mb-0">
            <div className="mb-1 flex items-center gap-1.5 px-1 text-[11.5px] font-semibold text-ink-soft">
              <Icone size={13} /> {titulo}
            </div>
            <div className="grid gap-0.5">
              {lista.map((p) => (
                <Linha key={p.id} produto={p} item={escolhido(p.id)} travado={travado}
                  aoAlternar={() => aoAlternar(p)} aoValor={(v) => aoValorItem(p.id, v)} />
              ))}
            </div>
          </div>
        );
      })}

      <div className="mt-3 grid grid-cols-2 gap-2 rounded-[12px] bg-soft p-2.5">
        <CampoValor rotulo="Total" valor={total} travado={travado} aoMudar={aoTotal} forte />
        <CampoValor rotulo="Entrada" valor={entrada} travado={travado} aoMudar={aoEntrada} />
      </div>
    </div>
  );
}

function Linha({ produto, item, travado, aoAlternar, aoValor }: {
  produto: Produto; item: ItemEscolhido | undefined; travado: boolean;
  aoAlternar: () => void; aoValor: (v: number) => void;
}) {
  const ativo = !!item;
  return (
    <div role="button" tabIndex={travado ? -1 : 0} aria-pressed={ativo} aria-disabled={travado}
      onClick={() => { if (!travado) aoAlternar(); }}
      onKeyDown={(e) => {
        if (travado || e.target !== e.currentTarget) return;
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); aoAlternar(); }
      }}
      className={"flex min-h-10 w-full items-center gap-2.5 rounded-xl px-2.5 py-1.5 text-left text-[13px] transition-colors " +
        (ativo ? "bg-accent-tint font-semibold text-accent " : "text-ink ") +
        (travado ? "opacity-70" : "cursor-pointer " + (ativo ? "" : "hover:bg-soft"))}>
      <span className={"inline-flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full transition-colors " +
        (ativo ? "bg-accent text-white" : "bg-line")}>
        {ativo ? <Check size={12} strokeWidth={3} /> : null}
      </span>
      <span className="min-w-0 flex-1 truncate" title={produto.nome}>{produto.curto}</span>
      {ativo ? (
        <ValorDoItem valor={item!.valor} travado={travado} aoMudar={aoValor} rotulo={"Valor de " + produto.curto} />
      ) : (
        <span className="shrink-0 whitespace-nowrap text-[12.5px] tabular-nums text-ink-soft">R$ {formatarMoeda(produto.preco)}</span>
      )}
    </div>
  );
}

/* Valor do item escolhido: texto que vira campo no clique (o fotógrafo
   negocia o preço por casal). O clique não marca/desmarca a linha. */
function ValorDoItem({ valor, travado, aoMudar, rotulo }: {
  valor: number; travado: boolean; aoMudar: (v: number) => void; rotulo: string;
}) {
  const [texto, setTexto] = useState<string | null>(null);
  if (texto === null) {
    return (
      <button type="button" disabled={travado} aria-label={rotulo} title="Editar valor"
        onClick={(e) => { e.stopPropagation(); setTexto(formatarMoeda(valor)); }}
        className="shrink-0 cursor-pointer whitespace-nowrap rounded-[7px] px-1.5 py-0.5 text-[12.5px] tabular-nums transition-colors hover:bg-paper disabled:cursor-default">
        R$ {formatarMoeda(valor)}
      </button>
    );
  }
  const fechar = () => {
    const n = parseMoeda(texto);
    if (n !== null && n >= 0) aoMudar(n);
    setTexto(null);
  };
  return (
    <input autoFocus value={texto} inputMode="decimal" aria-label={rotulo}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => setTexto(e.target.value)}
      onBlur={fechar}
      onKeyDown={(e) => { e.stopPropagation(); if (e.key === "Enter") fechar(); if (e.key === "Escape") setTexto(null); }}
      className="h-7 w-[96px] shrink-0 rounded-[7px] bg-paper px-2 text-right text-[12.5px] font-semibold tabular-nums text-ink outline-none" />
  );
}

function CampoValor({ rotulo, valor, travado, aoMudar, forte }: {
  rotulo: string; valor: number | null; travado: boolean; aoMudar: (v: number | null) => void; forte?: boolean;
}) {
  const [texto, setTexto] = useState<string | null>(null);
  const exibido = texto ?? (valor != null ? formatarMoeda(valor) : "");
  return (
    <label className="block min-w-0 rounded-[9px] bg-paper px-2.5 py-1.5">
      <span className="block text-[11px] font-medium text-ink-soft">{rotulo}</span>
      <span className="flex items-center gap-1 text-[13px] tabular-nums text-ink">
        R$
        <input value={exibido} readOnly={travado} inputMode="decimal" placeholder="0,00" aria-label={rotulo + " (R$)"}
          onChange={(e) => setTexto(e.target.value)}
          onBlur={() => { if (texto !== null) { aoMudar(parseMoeda(texto)); setTexto(null); } }}
          onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
          className={"min-w-0 flex-1 bg-transparent outline-none " + (forte ? "font-semibold" : "")} />
      </span>
    </label>
  );
}

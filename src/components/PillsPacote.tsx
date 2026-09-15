/*
  Seletor de pacote e adicionais do contrato, mais o resumo (quantidade + soma).
  Portado de desenharSeletorItens() / pillItem() / desenharResumoContrato()
  do estudio.html.

  Regras herdadas de lá:
  - Pacote é seleção única; adicional é múltipla.
  - O Eternal já inclui o pré-wedding: com ele marcado, o pré-wedding some da
    lista e sai dos itens.
  - Item NÃO escolhido mostra o preço de tabela, sem edição. Item escolhido tem
    o preço editável, porque é o fotógrafo quem negocia o valor final por casal.
    O valor vem do que está GRAVADO no cliente, nunca do catálogo: reabrir a
    ficha não pode apagar um desconto negociado.
  - Travado (casal já assinou): nada aceita clique nem foco por Tab. Só CSS não
    bastaria, porque pointer-events não impede foco por teclado.

  O original separava as linhas com border-bottom; aqui a separação é o
  espaçamento e o fundo da linha ativa (regra da casa: nenhuma borda).
*/
"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { ADICIONAIS, CATALOGO, PACOTES } from "@/lib/catalogo";
import { formatarMoeda, parseMoeda, type ItemContrato } from "@/lib/ficha";
import { moeda } from "@/lib/util";

const HOVER = "[@media(hover:hover)]:";

export function PillsPacote({
  itens, travado, onAlternar, onEditarValor,
}: {
  itens: ItemContrato[];
  travado: boolean;
  onAlternar: (id: string) => void;
  /** valor já como número (o componente cuida do parse) */
  onEditarValor: (id: string, valor: number) => void;
}) {
  const selecionado = (id: string) => itens.some((i) => i.id === id);
  const eternalOn = selecionado("eternal");

  return (
    <div className="mb-3.5">
      <Grupo titulo="Pacote">
        {PACOTES.map((id) => (
          <Linha key={id} id={id} item={itens.find((i) => i.id === id)} travado={travado} onAlternar={onAlternar} onEditarValor={onEditarValor} />
        ))}
      </Grupo>
      <Grupo titulo="Adicionais">
        {ADICIONAIS.filter((id) => !(id === "prewedding" && eternalOn)).map((id) => (
          <Linha key={id} id={id} item={itens.find((i) => i.id === id)} travado={travado} onAlternar={onAlternar} onEditarValor={onEditarValor} />
        ))}
      </Grupo>
    </div>
  );
}

function Grupo({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="mb-[18px] last:mb-0">
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-[.12em] text-ink-soft">{titulo}</div>
      <div className="flex flex-col gap-0.5">{children}</div>
    </div>
  );
}

function Linha({
  id, item, travado, onAlternar, onEditarValor,
}: {
  id: string;
  item: ItemContrato | undefined;
  travado: boolean;
  onAlternar: (id: string) => void;
  onEditarValor: (id: string, valor: number) => void;
}) {
  const cat = CATALOGO[id];
  const ativo = !!item;
  const classe =
    "flex w-full min-w-0 items-center gap-2.5 rounded-[10px] py-[11px] pl-2 pr-2 text-left text-sm text-ink transition-colors " +
    (ativo ? "bg-soft font-semibold " : "") +
    (travado ? "opacity-70 " : `cursor-pointer ${HOVER}hover:bg-soft `);

  const marcador = (
    <span
      aria-hidden
      className={
        "flex h-[17px] w-[17px] shrink-0 items-center justify-center rounded-full transition-colors " +
        (ativo ? "bg-accent text-white" : "bg-line")
      }
    >
      {ativo ? <Check size={10} strokeWidth={3} /> : null}
    </span>
  );

  if (!ativo) {
    return (
      <button type="button" className={classe} disabled={travado} onClick={() => onAlternar(id)}>
        {marcador}
        <span className="flex-1">{cat.curto}</span>
        <span className="ml-auto shrink-0 whitespace-nowrap pl-3.5 text-[13px] tabular-nums opacity-65">
          R$&nbsp;{formatarMoeda(cat.preco)}
        </span>
      </button>
    );
  }

  /* selecionado: o preço é campo, e <input> dentro de <button> é inválido,
     então a linha vira div role="button" e o preço fica à parte */
  return (
    <div
      role="button"
      tabIndex={travado ? -1 : 0}
      aria-disabled={travado}
      className={classe}
      onClick={() => { if (!travado) onAlternar(id); }}
      onKeyDown={(e) => {
        if (travado) return;
        if ((e.key === "Enter" || e.key === " ") && e.target === e.currentTarget) {
          e.preventDefault();
          onAlternar(id);
        }
      }}
    >
      {marcador}
      <span className="flex-1">{cat.curto}</span>
      <span className="ml-auto flex shrink-0 items-center whitespace-nowrap pl-3.5 text-[13px] tabular-nums">
        R$&nbsp;
        <ValorEditavel
          rotulo={"Valor de " + cat.curto}
          valor={item.valor}
          travado={travado}
          onMudar={(n) => onEditarValor(id, n)}
        />
      </span>
    </div>
  );
}

/* O valor começa como texto puro e vira <input> só na hora de editar (mesmo
   clique-pra-editar do contrato). Enquanto digita, só o estado do texto local
   muda; o número sobe pro pai a cada tecla, sem re-renderizar a lista. */
function ValorEditavel({
  rotulo, valor, travado, onMudar,
}: { rotulo: string; valor: number; travado: boolean; onMudar: (n: number) => void }) {
  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState("");

  function abrir() {
    if (travado) return;
    setTexto(formatarMoeda(valor));
    setEditando(true);
  }

  if (!editando) {
    return (
      <span
        role="button"
        tabIndex={travado ? -1 : 0}
        aria-label={rotulo}
        className={travado ? "" : "cursor-text"}
        onClick={(e) => { e.stopPropagation(); abrir(); }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); abrir(); }
        }}
      >
        {formatarMoeda(valor)}
      </span>
    );
  }

  return (
    <input
      type="text"
      inputMode="decimal"
      autoComplete="off"
      autoFocus
      aria-label={rotulo}
      value={texto}
      size={Math.max(texto.length, 4)}
      className="m-0 w-auto bg-transparent p-0 text-right tabular-nums text-inherit outline-none focus:underline focus:decoration-dashed"
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Enter" || e.key === "Escape") e.currentTarget.blur();
      }}
      onChange={(e) => {
        setTexto(e.target.value);
        const n = parseMoeda(e.target.value);
        onMudar(n != null ? n : 0);
      }}
      onFocus={(e) => e.target.select()}
      onBlur={() => {
        const n = parseMoeda(texto);
        onMudar(n != null ? n : 0);
        setEditando(false);
      }}
    />
  );
}

/** Resumo compacto acima de Total/Entrada: contagem + soma, sem repetir a lista. */
export function ResumoItens({ itens }: { itens: ItemContrato[] }) {
  if (!itens.length) {
    return (
      <p className="m-0 my-[18px] rounded-xl bg-soft px-4 py-3 text-[13.5px] italic text-ink-soft">
        Nenhum item selecionado. Escolha acima ou preencha o total à mão.
      </p>
    );
  }
  const total = itens.reduce((s, i) => s + (Number(i.valor) || 0), 0);
  return (
    <div className="my-[18px] flex items-baseline justify-between gap-3 rounded-xl bg-soft px-4 py-3 text-[13.5px] text-ink-soft">
      <span className="font-medium text-ink">
        {itens.length} {itens.length === 1 ? "item selecionado" : "itens selecionados"}
      </span>
      <span className="whitespace-nowrap text-base font-bold tabular-nums text-accent-deep">{moeda(total)}</span>
    </div>
  );
}

/*
  Cabeçalho da ficha: nomes do casal, data do evento com contagem, local e
  valor, e as ações de arquivar/excluir. Portado de renderHeroCliente() do
  estudio.html.

  Hierarquia herdada de lá: a data/contagem é a única pílula branca. Local e
  valor são meta leve. O status do contrato NÃO repete aqui (vive na coluna da
  direita), só entra quando é marco forte: assinado.

  O original tinha borda translúcida nos botões e no avatar; aqui saiu, e a
  separação fica por conta do fundo translúcido mais sombra (regra da casa).
*/
"use client";

import { Archive, Calendar, DollarSign, FileText, MapPin, Trash2, UserPlus, Users } from "lucide-react";
import { diasAte, type Cliente } from "@/lib/ficha";
import { fmtData, moeda } from "@/lib/util";

const HOVER = "[@media(hover:hover)]:";

export function HeroCliente({
  cliente, contratoAssinado, onArquivar, onExcluir,
}: {
  cliente: Cliente | null;
  contratoAssinado: boolean;
  onArquivar: () => void;
  onExcluir: () => void;
}) {
  const fundo =
    "relative isolate mb-10 mt-3 overflow-hidden rounded-3xl px-8 pb-7 pt-[30px] text-white " +
    "shadow-[0_14px_34px_rgba(0,54,70,.22),inset_0_1px_0_rgba(255,255,255,.07)] " +
    "bg-[radial-gradient(130%_150%_at_12%_-10%,rgba(255,255,255,.12),transparent_46%),linear-gradient(135deg,#013243_0%,#003646_46%,#0b4d61_100%)] " +
    "max-md:rounded-[18px] max-md:px-[22px] max-md:py-6";

  if (!cliente) {
    return (
      <div className={fundo}>
        <Esferas />
        <div className="relative z-[1] flex items-center gap-[22px] max-md:gap-4">
          <Avatar><UserPlus size={30} strokeWidth={1.6} /></Avatar>
          <div className="min-w-0">
            <h1 className="m-0 text-[32px] font-semibold leading-[1.08] max-md:text-[25px]">Novo cliente</h1>
            <div className="mt-3.5 flex flex-wrap gap-2">
              <Chip>Preencha os dados e salve para criar</Chip>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const noivo = String(cliente.noivo ?? "").trim();
  const noiva = String(cliente.noiva ?? "").trim();
  const nomes = [noivo, noiva].filter(Boolean).join(" & ") || "Cliente";

  const dataEvento = cliente.data_evento ? String(cliente.data_evento) : "";
  let textoData = "";
  let dataFutura = false;
  if (dataEvento) {
    const d = diasAte(dataEvento);
    textoData = fmtData(dataEvento);
    if (d != null) {
      if (d > 1) textoData += " · faltam " + d + " dias";
      else if (d === 1) textoData += " · é amanhã";
      else if (d === 0) textoData += " · é hoje!";
      else if (d === -1) textoData += " · foi ontem";
      else textoData += " · há " + Math.abs(d) + " dias";
      dataFutura = d >= 0;
    }
  }

  const local = cliente.local_evento ? String(cliente.local_evento) : "";
  const temTotal = cliente.total != null && cliente.total !== "";

  return (
    <div className={fundo}>
      <Esferas />

      {/* ações flutuam no canto: em fluxo criavam uma faixa vazia no topo */}
      <div className="absolute right-6 top-[22px] z-[5] flex items-center gap-2.5">
        {cliente.status !== "arquivado" ? (
          <button
            type="button"
            onClick={onArquivar}
            title="Arquivar (some da lista de ativos)"
            aria-label="Arquivar"
            className={`inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-white/10 text-white/80 shadow-[0_2px_8px_rgba(0,0,0,.18)] transition-colors ${HOVER}hover:bg-white/25 ${HOVER}hover:text-white`}
          >
            <Archive size={15} />
          </button>
        ) : null}
        <button
          type="button"
          onClick={onExcluir}
          title="Excluir de vez (apaga permanentemente)"
          aria-label="Excluir de vez"
          className={`inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-white/10 text-white/80 shadow-[0_2px_8px_rgba(0,0,0,.18)] transition-colors ${HOVER}hover:bg-erro ${HOVER}hover:text-white`}
        >
          <Trash2 size={15} />
        </button>
      </div>

      <div className="relative z-[1] flex items-center gap-[22px] pr-20 max-md:gap-4">
        <Avatar><Users size={30} strokeWidth={1.6} /></Avatar>
        <div className="min-w-0">
          <h1 className="m-0 text-[32px] font-semibold leading-[1.08] max-md:text-[25px]">{nomes}</h1>

          {textoData || contratoAssinado ? (
            <div className="mt-3.5 flex flex-wrap gap-2">
              {textoData ? (
                <Chip destaque={dataFutura}><Calendar size={14} />{textoData}</Chip>
              ) : null}
              {contratoAssinado ? (
                <Chip destaque><FileText size={14} />Contrato assinado</Chip>
              ) : null}
            </div>
          ) : null}

          {local || temTotal ? (
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5">
              {local ? <Meta><MapPin size={14} className="opacity-70" />{local}</Meta> : null}
              {temTotal ? <Meta><DollarSign size={14} className="opacity-70" />{moeda(Number(cliente.total))}</Meta> : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/* duas esferas de luz sobrepostas dão profundidade sem virar ruído */
function Esferas() {
  return (
    <>
      <span aria-hidden className="pointer-events-none absolute -right-[70px] -top-20 -z-[1] h-[250px] w-[250px] rounded-full bg-[radial-gradient(circle_at_35%_35%,rgba(255,255,255,.14),rgba(255,255,255,.03)_60%,transparent_72%)]" />
      <span aria-hidden className="pointer-events-none absolute -bottom-[140px] right-[14%] -z-[1] h-[230px] w-[230px] rounded-full bg-[radial-gradient(circle,rgba(15,90,113,.55),transparent_70%)]" />
    </>
  );
}

function Avatar({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-[74px] w-[74px] shrink-0 items-center justify-center rounded-full bg-[linear-gradient(150deg,rgba(255,255,255,.22),rgba(255,255,255,.08))] text-white shadow-[0_8px_22px_rgba(0,0,0,.20),inset_0_1px_0_rgba(255,255,255,.25)] max-md:h-[60px] max-md:w-[60px]">
      {children}
    </div>
  );
}

function Chip({ destaque = false, children }: { destaque?: boolean; children: React.ReactNode }) {
  return (
    <span
      className={
        "inline-flex items-center gap-[7px] rounded-full px-[13px] py-1.5 text-[13px] max-md:whitespace-normal " +
        (destaque
          ? "bg-white font-semibold text-accent shadow-[0_4px_14px_rgba(0,0,0,.16)]"
          : "bg-white/[.11] text-white/95 backdrop-blur-[6px]")
      }
    >
      {children}
    </span>
  );
}

function Meta({ children }: { children: React.ReactNode }) {
  return <span className="inline-flex items-center gap-[7px] whitespace-nowrap text-[13px] text-white/70">{children}</span>;
}

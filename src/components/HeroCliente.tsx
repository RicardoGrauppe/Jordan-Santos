/*
  Cabeçalho da ficha: quem é o casal, quando é o evento, onde e por quanto, e
  as ações que mexem no cadastro. Portado de renderHeroCliente() do
  estudio.html.

  Hierarquia herdada de lá: a data/contagem é a única pílula branca. Local e
  valor são meta leve. O status do CONTRATO não repete aqui (vive na coluna da
  direita), só entra quando é marco forte: assinado.

  O original tinha borda translúcida nos botões e no avatar; aqui saiu. E
  NADA dentro do herói projeta sombra (decisão do Ricardo em 17/09/2026): num
  fundo escuro o branco translúcido já separa sozinho, e sombra sobre sombra
  só suja. A única sombra da peça é a do herói inteiro, contra a página.

  Três coisas mudaram em 17/09/2026, depois do Ricardo pedir pra melhorar
  visual e uso:

  1. O avatar é o ÍCONE DA LATERAL (o mesmo de Clientes), num quadrado de
     canto mole no raio dos cards — não um círculo. Chegou a mostrar as
     iniciais do casal, mas o Ricardo preferiu o ícone da seção: ele diz onde
     você está, e quem você abriu já está escrito ao lado em corpo 32.
  2. Arquivar e Excluir saíram de dois ícones soltos no canto pra um menu com
     RÓTULO. Eram dois alvos de 32px a 10px de distância, um some da lista e o
     outro apaga pra sempre, e no celular nem tooltip existe pra distinguir os
     dois. Com texto, a ação perigosa é escolhida, não acertada.
  3. Cliente ARQUIVADO passa a dizer que está arquivado. Antes o único sinal
     era o botão de arquivar sumir do canto, o que é ausência de coisa — e
     ausência não avisa ninguém.
*/
"use client";

import { useEffect, useRef, useState } from "react";
import { Archive, Calendar, DollarSign, EllipsisVertical, FileText, MapPin, Trash2, UserPlus, Users } from "lucide-react";
import { diasAte, type Cliente } from "@/lib/ficha";
import { fmtData, moeda } from "@/lib/util";


export function HeroCliente({
  cliente, contratoAssinado, onArquivar, onExcluir,
}: {
  cliente: Cliente | null;
  contratoAssinado: boolean;
  onArquivar: () => void;
  onExcluir: () => void;
}) {
  const fundo =
    "relative isolate mb-10 mt-3 overflow-hidden text-white " +
    "rounded-[18px] px-[22px] py-6 md:rounded-3xl md:px-8 md:pb-7 md:pt-[30px] " +
    "shadow-[0_14px_34px_rgba(0,54,70,.22),inset_0_1px_0_rgba(255,255,255,.07)] " +
    "bg-[radial-gradient(130%_150%_at_12%_-10%,rgba(255,255,255,.12),transparent_46%),linear-gradient(135deg,#013243_0%,#003646_46%,#0b4d61_100%)] " +
    "";

  if (!cliente) {
    return (
      <div className={fundo}>
        <Esferas />
        <div className="relative z-[1] flex items-stretch gap-4 md:gap-[22px]">
          <Avatar><UserPlus strokeWidth={1.5} className="h-[30px] w-[30px] md:h-[40px] md:w-[40px]" /></Avatar>
          <div className="flex min-w-0 flex-col justify-center">
            <h1 className="m-0 text-[25px] font-semibold leading-[1.08] md:text-[32px]">Novo cliente</h1>
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

  const arquivado = cliente.status === "arquivado";
  const local = cliente.local_evento ? String(cliente.local_evento) : "";
  const temTotal = cliente.total != null && cliente.total !== "";

  return (
    <div className={fundo}>
      <Esferas />

      {/* o menu flutua no canto: em fluxo criava uma faixa vazia no topo */}
      <div className="absolute right-4 top-4 z-[5] md:right-6 md:top-[22px]">
        <MenuDoCadastro
          podeArquivar={cliente.status !== "arquivado"}
          onArquivar={onArquivar}
          onExcluir={onExcluir}
        />
      </div>

      <div className="relative z-[1] flex items-stretch gap-4 pr-12 md:gap-[22px]">
        <Avatar><Users strokeWidth={1.5} className="h-[30px] w-[30px] md:h-[40px] md:w-[40px]" /></Avatar>
        <div className="flex min-w-0 flex-col justify-center">
          <h1 className="m-0 text-[25px] font-semibold leading-[1.08] md:text-[32px]">{nomes}</h1>

          {textoData || contratoAssinado || arquivado ? (
            <div className="mt-3.5 flex flex-wrap gap-2">
              {/* arquivado vem primeiro: é a condição da ficha inteira, e o
                  resto só faz sentido lido depois dela */}
              {arquivado ? <Chip><Archive size={14} />Arquivado</Chip> : null}
              {textoData ? (
                <Chip destaque={dataFutura && !arquivado}><Calendar size={14} />{textoData}</Chip>
              ) : null}
              {contratoAssinado ? (
                <Chip destaque={!arquivado}><FileText size={14} />Contrato assinado</Chip>
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

/* Ações que mexem no CADASTRO (não no contrato). Num menu com rótulo, e não
   em ícones soltos: arquivar tira da lista e excluir apaga pra sempre, e dois
   ícones vizinhos do mesmo tamanho não distinguem uma da outra — muito menos
   no celular, onde `title` não aparece.
   A confirmação de cada uma continua sendo do ModalConfirmar; isto aqui é a
   camada antes dela, pra o dedo não chegar lá por engano. */
function MenuDoCadastro({
  podeArquivar, onArquivar, onExcluir,
}: { podeArquivar: boolean; onArquivar: () => void; onExcluir: () => void }) {
  const [aberto, setAberto] = useState(false);
  const caixa = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!aberto) return;
    function fora(ev: PointerEvent) {
      if (!caixa.current?.contains(ev.target as Node)) setAberto(false);
    }
    document.addEventListener("pointerdown", fora);
    return () => document.removeEventListener("pointerdown", fora);
  }, [aberto]);

  const item =
    "flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-[11px] py-[9px] text-left text-[13.5px]";

  return (
    <div ref={caixa} className="relative">
      <button
        type="button"
        aria-label="Ações do cadastro"
        aria-haspopup="true"
        aria-expanded={aberto}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={() => setAberto((v) => !v)}
        /* Sem sombra (nada dentro do herói tem), então quem o faz existir é o
           CONTRASTE: a pastilha subiu de 10% pra 16% de branco e os pontos
           foram pra branco cheio. Com 10% e texto a 80% ele sumia no degradê
           escuro — o Ricardo perguntou onde tinha ido parar. */
        className={
          "inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-full " +
          "text-white transition-colors hover:bg-white/30 " +
          (aberto ? "bg-white/30" : "bg-white/[.16]")
        }
      >
        <EllipsisVertical size={18} />
      </button>

      {aberto ? (
        <div
          role="menu"
          onPointerDown={(e) => e.stopPropagation()}
          className="absolute right-0 top-11 z-[6] min-w-[208px] rounded-xl bg-paper p-1.5 shadow-alta"
        >
          {podeArquivar ? (
            <button
              type="button"
              role="menuitem"
              onClick={() => { setAberto(false); onArquivar(); }}
              className={item + " text-ink hover:bg-soft"}
            >
              <Archive size={15} className="opacity-85" />
              Arquivar
            </button>
          ) : null}
          <button
            type="button"
            role="menuitem"
            onClick={() => { setAberto(false); onExcluir(); }}
            className={item + " text-erro hover:bg-erro-tint"}
          >
            <Trash2 size={15} className="opacity-85" />
            Excluir de vez
          </button>
        </div>
      ) : null}
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

/* Bloco de canto mole, no raio dos cards da página (22px no grande, 18px no
   celular), e não redondo: aqui não é foto de pessoa, é o ícone da seção.

   QUADRADO de 112px no computador, e é ELE quem define a altura do herói —
   não o contrário. O caminho óbvio (esticar na linha e deixar `aspect-square`
   achar a largura) NÃO funciona: num flex row a largura do item é resolvida
   ANTES da altura esticada, então a proporção usa a altura automática e o
   bloco saía 74x112 — retângulo. Medido.

   Com o quadrado mandando, a margem em cima e embaixo é o padding do herói
   (30/28) e o herói para de mudar de altura entre a ficha nova e a ficha
   cheia: antes ele ia de 138 pra 170 conforme o conteúdo, e agora as duas
   ficam iguais, porque o bloco é o item mais alto da linha nos dois casos.

   No CELULAR ele volta a ser quadrado e centrado. Ali o nome do casal quebra
   em duas linhas e a pílula da data também, então esticar transformava o bloco
   numa tira de 60x151 — medido. Coluna estreita e alta não lê como selo, lê
   como espaço vazio.

   Sem sombra — dentro do herói nada projeta sombra, quem separa do fundo é a
   própria luz translúcida. */
function Avatar({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-[60px] w-[60px] shrink-0 items-center justify-center self-center rounded-[18px] bg-[linear-gradient(150deg,rgba(255,255,255,.22),rgba(255,255,255,.08))] text-white md:h-[112px] md:w-[112px] md:rounded-[22px]">
      {children}
    </div>
  );
}

function Chip({ destaque = false, children }: { destaque?: boolean; children: React.ReactNode }) {
  return (
    <span
      className={
        "inline-flex items-center gap-[7px] rounded-full px-[13px] py-1.5 text-[13px] whitespace-normal md:whitespace-nowrap " +
        (destaque
          ? "bg-white font-semibold text-accent"
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

/*
  Cabeçalho da ficha: quem é o casal, quando é o evento, onde e por quanto, e
  as ações que mexem no cadastro. Portado de renderHeroCliente() do
  estudio.html.

  Hierarquia: ESTADO em pílula (arquivado, contrato assinado), DADO em linha
  (data com a contagem, local, valor). O status do CONTRATO não repete aqui
  (vive na coluna da direita), só entra quando é marco forte: assinado.

  O original tinha borda translúcida nos botões e no avatar; aqui saiu. E
  NADA dentro do herói projeta sombra (decisão do Ricardo em 17/09/2026): num
  fundo escuro o branco translúcido já separa sozinho, e sombra sobre sombra
  só suja. A única sombra da peça é a do herói inteiro, contra a página.

  Em 17/09/2026 o Arquivar/Excluir saiu de dois ícones soltos pra um menu
  com RÓTULO (a ação perigosa é escolhida, não acertada) e o arquivado
  passou a dizer que está arquivado. Em 22/10/2026 o herói ficou compacto:
  sem o bloco do ícone, nome em cima e quatro números embaixo (ver o
  comentário no componente).
*/
"use client";

import { useEffect, useRef, useState } from "react";
import { Archive, Calendar, EllipsisVertical, FileText, MapPin, Tag, Trash2, UserPlus } from "lucide-react";
import { diasAte, type Cliente } from "@/lib/ficha";
import { fmtData, moeda } from "@/lib/util";


/* Quanto falta, em poucas palavras. Era "faltam 240 dias"; virou "em 8 meses",
   porque 240 dias ninguém consegue imaginar e o número comprido ainda empurrava
   a linha no celular.
   A troca pra meses só acontece passando de dois: até lá o dia ainda é a
   unidade com que se planeja ("em 45 dias" diz mais que "em 1 mês"). */
function distancia(dias: number): string {
  if (dias === 0) return "hoje";
  if (dias === 1) return "amanhã";
  if (dias === -1) return "ontem";

  const passado = dias < 0;
  const n = Math.abs(dias);
  const texto = n > 60 ? Math.round(n / 30.44) + " meses" : n + " dias";
  return passado ? "há " + texto : "em " + texto;
}

export function HeroCliente({
  cliente, contratoAssinado, situacaoContrato, onArquivar, onExcluir,
}: {
  cliente: Cliente | null;
  contratoAssinado: boolean;
  /** em que pé está o contrato, em duas ou três palavras ("Esperando assinatura") */
  situacaoContrato?: string;
  onArquivar: () => void;
  onExcluir: () => void;
}) {
  /* COMPACTO desde 22/10/2026 ("perfil + editar por seção"): o bloco de
     112px com o ícone saiu, o nome sobe pra primeira linha e embaixo vêm
     quatro números em quadros translúcidos, as quatro perguntas de quem
     abre a ficha: quando, onde, quanto e como está o contrato. */
  const fundo =
    "relative isolate mb-5 mt-3 overflow-hidden text-white md:mb-6 " +
    "rounded-[18px] px-5 py-5 md:rounded-3xl md:px-7 md:py-6 " +
    "shadow-[0_14px_34px_rgba(0,54,70,.22),inset_0_1px_0_rgba(255,255,255,.07)] " +
    "bg-[radial-gradient(130%_150%_at_12%_-10%,rgba(255,255,255,.12),transparent_46%),linear-gradient(135deg,#013243_0%,#003646_46%,#0b4d61_100%)]";

  if (!cliente) {
    return (
      <div className={fundo}>
        <Esferas />
        <div className="relative z-[1]">
          <h1 className="m-0 text-[22px] font-semibold leading-[1.15] md:text-[28px]">Novo cliente</h1>
          <div className="mt-3 flex flex-wrap gap-2">
            <Chip><UserPlus size={14} />Preencha os dados e salve para criar</Chip>
          </div>
        </div>
      </div>
    );
  }

  const noivo = String(cliente.noivo ?? "").trim();
  const noiva = String(cliente.noiva ?? "").trim();
  const nomes = [noivo, noiva].filter(Boolean).join(" & ") || "Cliente";

  const dataEvento = cliente.data_evento ? String(cliente.data_evento) : "";
  const dias = dataEvento ? diasAte(dataEvento) : null;
  const arquivado = cliente.status === "arquivado";
  const local = cliente.local_evento ? String(cliente.local_evento) : "";
  const temTotal = cliente.total != null && cliente.total !== "";

  const numeros: { Icone: typeof Calendar; rotulo: string; valor: string; detalhe?: string; forte?: boolean }[] = [
    { Icone: Calendar, rotulo: "Casamento", valor: dataEvento ? fmtData(dataEvento) : "A definir", detalhe: dias != null ? distancia(dias) : undefined, forte: dias != null && dias >= 0 && !arquivado },
    { Icone: MapPin, rotulo: "Local", valor: local || "A definir" },
    /* etiqueta, não cifrão: o valor é em R$, e um "$" ao lado diz outra moeda */
    { Icone: Tag, rotulo: "Total", valor: temTotal ? moeda(Number(cliente.total)) : "A definir" },
    { Icone: FileText, rotulo: "Contrato", valor: contratoAssinado ? "Assinado" : situacaoContrato || "Sem contrato" },
  ];

  return (
    <div className={fundo}>
      <Esferas />

      <div className="relative z-[1] flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="m-0 text-[22px] font-semibold leading-[1.15] md:text-[28px]">{nomes}</h1>
          {/* estado da ficha inteira: só aparece quando é exceção */}
          {arquivado ? (
            <div className="mt-2.5 flex flex-wrap gap-2"><Chip><Archive size={14} />Arquivado</Chip></div>
          ) : null}
        </div>
        <MenuDoCadastro
          podeArquivar={cliente.status !== "arquivado"}
          onArquivar={onArquivar}
          onExcluir={onExcluir}
        />
      </div>

      <dl className="relative z-[1] m-0 mt-4 grid grid-cols-2 gap-2 md:mt-5 md:grid-cols-4 md:gap-2.5">
        {numeros.map(({ Icone, rotulo, valor, detalhe, forte }) => (
          <div key={rotulo} className="min-w-0 rounded-[14px] bg-white/[.09] px-3.5 py-2.5 backdrop-blur-[6px]">
            <dt className="flex items-center gap-1.5 text-[11.5px] font-medium text-white/65">
              <Icone size={13} className="opacity-80" />{rotulo}
            </dt>
            <dd className="m-0 mt-0.5 truncate text-[15px] font-semibold leading-[1.3] text-white" title={valor}>{valor}</dd>
            {detalhe ? (
              <dd className={"m-0 truncate text-[12px] " + (forte ? "font-medium text-white/90" : "text-white/60")}>{detalhe}</dd>
            ) : null}
          </div>
        ))}
      </dl>
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
          /* canto mole e não redondo, no mesmo raio que o app usa em todo
             botão de ícone de 36px (sino e avatar do cabeçalho) */
          "inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-[10px] " +
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

/* Selo de ESTADO. Um estilo só, translúcido e de canto mole — o branco cheio
   e redondo que havia aqui era a última coisa arredondada e gritada do herói,
   depois que o bloco do ícone e o botão de ações viraram quadrados de canto
   mole. Quem separa os dois estados é o ícone e a ordem (arquivado primeiro),
   não o volume. */
function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-[7px] whitespace-normal rounded-[10px] bg-white/[.14] px-[11px] py-1.5 text-[13px] font-medium text-white backdrop-blur-[6px] md:whitespace-nowrap">
      {children}
    </span>
  );
}

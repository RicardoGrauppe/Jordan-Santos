/*
  Modelos de contrato: o índice. Grade de cards com kebab e o card tracejado
  de criar. Portado de configuracoes.html (#contrato-indice).

  A grade de ASSINATURAS saiu em 22/10/2026 (pedido do Ricardo): desde a
  Autentique o fotógrafo assina lá, no clique de "Assinar e enviar", e a
  assinatura desenhada no app não vai mais pra contrato nenhum.

  "Definir como padrão" pede confirmação porque é a única ação daqui que muda
  o que o casal recebe: o modelo padrão é o texto de todo contrato novo.
*/
"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CircleCheck, EllipsisVertical, FileText, Pencil, Plus, Trash2 } from "lucide-react";
import { BotaoVoltar, CartaoAviso, Secao, Selo } from "@/components/ui";
import { useConfirmar } from "@/components/ModalConfirmar";
import { fmtData } from "@/lib/util";

/* O que a tela FAZ, em uma frase. Fixo: vale com tudo em ordem e vale enquanto
   falta algo — o que muda nesse caso é a cor da faixa.
   Não diz mais "Seus modelos de contrato e suas assinaturas": o título da
   página e os dois cabeçalhos de seção já dizem isso três vezes. Sobra só o
   que não está escrito em lugar nenhum. */
const TEXTO_DA_TELA =
  "O modelo padrão é o texto de todo contrato novo. Editar um modelo não muda contratos já gerados.";

type Modelo = { id: string; nome: string; ativo: boolean; atualizado_em: string };


async function api<T = unknown>(corpo?: unknown): Promise<T> {
  const r = await fetch("/api/templates", corpo
    ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(corpo) }
    : undefined);
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((j as { erro?: string }).erro ?? "falha");
  return j as T;
}

/* Card genérico das duas grades: botão que ocupa o card inteiro + kebab por
   cima, como irmãos (botão dentro de botão é HTML inválido). */
function Card({ nome, meta, ativo, amostra, icone, aoAbrir, menu }: {
  nome: string; meta: string; ativo: boolean; amostra?: React.ReactNode; icone?: React.ReactNode;
  aoAbrir: () => void; menu: { rotulo: string; icone: React.ReactNode; perigo?: boolean; disabled?: boolean; titulo?: string; acao: () => void }[];
}) {
  const [aberto, setAberto] = useState(false);
  useEffect(() => {
    if (!aberto) return;
    const f = () => setAberto(false);
    document.addEventListener("pointerdown", f);
    return () => document.removeEventListener("pointerdown", f);
  }, [aberto]);

  return (
    <div className={`relative rounded-2xl bg-[#F7F9FA] shadow-[0_1px_2px_rgba(29,41,61,.03)] transition-[transform,background] hover:-translate-y-px hover:bg-[#F0F4F6]`}>
      <button type="button" onClick={aoAbrir}
        className={"flex w-full min-h-[120px] cursor-pointer flex-col items-start gap-2.5 bg-transparent px-[18px] pb-4 text-left " + (amostra ? "pt-[46px]" : "pt-[18px]")}>
        {amostra ?? <span className="inline-flex h-[38px] w-[38px] items-center justify-center rounded-[11px] bg-accent-tint text-accent">{icone}</span>}
        <span className="text-[14.5px] font-semibold leading-[1.3] text-ink">{nome}</span>
        <span className="mt-auto text-[12px] text-ink-soft">{meta}</span>
      </button>

      <div className="absolute right-3 top-3 z-[2] flex items-center gap-1.5">
        {ativo ? <Selo tom="accent">Padrão</Selo> : null}
        <button type="button" aria-label="Opções" aria-haspopup="true" aria-expanded={aberto}
          onPointerDown={(e) => e.stopPropagation()} onClick={() => setAberto((v) => !v)}
          className={`inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg text-ink-soft hover:bg-line hover:text-ink ` + (aberto ? "bg-line text-ink" : "")}>
          <EllipsisVertical size={16} />
        </button>
      </div>

      {aberto ? (
        <div onPointerDown={(e) => e.stopPropagation()} className="absolute right-3 top-11 z-[5] min-w-[196px] rounded-xl bg-paper p-1.5 shadow-alta">
          {menu.map((m) => (
            <button key={m.rotulo} type="button" disabled={m.disabled} title={m.titulo}
              onClick={() => { setAberto(false); m.acao(); }}
              className={`flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-[11px] py-[9px] text-left text-[13.5px] disabled:cursor-not-allowed disabled:opacity-40 ` +
                (m.perigo ? `text-erro hover:bg-erro-tint` : `text-ink hover:bg-soft`)}>
              <span className="opacity-85">{m.icone}</span>{m.rotulo}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function CardNovo({ rotulo, aoClicar }: { rotulo: string; aoClicar: () => void }) {
  return (
    <button type="button" onClick={aoClicar}
      className={`flex min-h-[120px] cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-line bg-transparent text-[13px] font-medium text-ink-soft transition-colors hover:border-accent hover:bg-soft hover:text-accent`}>
      <Plus size={22} />{rotulo}
    </button>
  );
}

export default function ContratoIndice() {
  const router = useRouter();
  const confirmar = useConfirmar();
  const [modelos, setModelos] = useState<Modelo[]>([]);

  const carregar = useCallback(async () => {
    const r = await api<{ modelos: Modelo[] }>();
    setModelos(r.modelos ?? []);
  }, []);
  /* o estado é escrito no callback, nunca no corpo do efeito */
  useEffect(() => {
    let vivo = true;
    api<{ modelos: Modelo[] }>()
      .then((r) => { if (vivo) setModelos(r.modelos ?? []); })
      .catch(() => {});
    return () => { vivo = false; };
  }, []);

  async function acaoModelo(acao: string, m: Modelo) {
    if (acao === "padrao") {
      const ok = await confirmar({
        titulo: "Tornar este o contrato padrão?",
        texto: `O modelo "${m.nome}" passa a ser o texto de todo contrato novo que você gerar daqui pra frente. É o documento que o casal recebe pra ler e assinar, exatamente como está escrito aqui.\n\nContratos já gerados ou já assinados não mudam, e o modelo que é padrão hoje continua salvo na lista.`,
        aviso: "Isto não é um teste. O próximo contrato que você enviar já sai com este texto.",
        rotuloOk: "Definir como padrão",
      });
      if (!ok) return;
      await api({ acao: "definir-padrao", id: m.id }); await carregar();
    }
    if (acao === "renomear") {
      const nome = window.prompt("Novo nome do modelo:", m.nome);
      if (!nome?.trim()) return;
      await api({ acao: "renomear", id: m.id, nome: nome.trim() }); await carregar();
    }
    if (acao === "excluir") {
      const ok = await confirmar({ titulo: `Apagar o modelo "${m.nome}"?`, texto: "Contratos já gerados não mudam.", rotuloOk: "Apagar", perigo: true });
      if (!ok) return;
      try { await api({ acao: "excluir", id: m.id }); await carregar(); }
      catch (e) { alert((e as Error).message); }
    }
  }

  async function novoModelo() {
    const r = await api<{ modelo: { id: string } }>({ acao: "criar", nome: "Documento sem título" });
    router.push("/painel/configuracoes/contrato/" + r.modelo.id);
  }

  /* O cartão diz SEMPRE a mesma frase, que é a explicação da tela. O que muda
     é só a COR, porque cor é sinal: âmbar enquanto não há modelo padrão (o
     contrato novo sairia sem texto), neutro quando está tudo no lugar. */
  const faltaAlgo = modelos.length > 0 && !modelos.some((m) => m.ativo);

  return (
    <div className="mx-auto max-w-[880px]">
      {/* no celular isto vive no cabeçalho (ver cabecalho-mobile.tsx) */}
      <div className="hidden md:block">
        <BotaoVoltar href="/painel/configuracoes" rotulo="Configurações" />
        <h1 className="m-0 mb-2 text-[26px] font-bold text-ink">Modelos de contrato</h1>
      </div>
      <div className="mb-5">
        <CartaoAviso tom={faltaAlgo ? "atencao" : "info"}>{TEXTO_DA_TELA}</CartaoAviso>
      </div>

      <Secao icone={<FileText size={17} />} titulo="Seus modelos">
        <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-3.5">
          {modelos.map((m) => (
            <Card key={m.id} nome={m.nome} meta={"Atualizado " + fmtData(m.atualizado_em)} ativo={m.ativo} icone={<FileText size={18} />}
              aoAbrir={() => router.push("/painel/configuracoes/contrato/" + m.id)}
              menu={[
                { rotulo: "Definir como padrão", icone: <CircleCheck size={15} />, disabled: m.ativo, titulo: m.ativo ? "Este já é o modelo padrão" : undefined, acao: () => acaoModelo("padrao", m) },
                { rotulo: "Renomear", icone: <Pencil size={15} />, acao: () => acaoModelo("renomear", m) },
                { rotulo: "Excluir", icone: <Trash2 size={15} />, perigo: true, acao: () => acaoModelo("excluir", m) },
              ]} />
          ))}
          <CardNovo rotulo="Novo modelo" aoClicar={novoModelo} />
        </div>
      </Secao>


    </div>
  );
}

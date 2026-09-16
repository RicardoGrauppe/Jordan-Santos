/*
  Editor de UM modelo de contrato, no formato do Google Docs: o nome do arquivo
  é editável no cabeçalho, o estado do salvamento fica logo abaixo, e a barra
  de formatação gruda no topo com ele. Sem botão de salvar.

  Autosave: espera parar de digitar; se uma gravação já está no ar, marca pra
  repetir depois em vez de disparar duas em cima da outra (a segunda poderia
  chegar antes da primeira e gravar conteúdo velho por cima do novo). O botão
  voltar grava o pendente ANTES de sair.
*/
"use client";

import { use, useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft } from "lucide-react";
import type { JSONContent } from "@tiptap/core";
import { EditorContrato } from "@/components/EditorContrato";
import { useVoltar } from "@/lib/voltar";

const ESPERA_MS = 700;
const AVISO = "Editar aqui não muda contratos já gerados.";

type Modelo = { id: string; nome: string; conteudo_json: JSONContent; conteudo_html: string };

export default function EditorModelo({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [modelo, setModelo] = useState<Modelo | null>(null);
  const [nome, setNome] = useState("");
  const [estado, setEstado] = useState<{ texto: string; tom?: "ok" | "erro" }>({ texto: AVISO });

  const pendente = useRef<{ json: JSONContent; html: string } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const salvando = useRef(false);
  const repetir = useRef(false);
  /* O que vai pro PATCH é lido daqui, NUNCA do estado via closure: o timer
     dispara 700ms depois de agendado, e a closure daquele momento tem o nome
     de antes da tecla. Na primeira versão isto mandou o nome ANTIGO pro banco
     enquanto a tela dizia "salvas". Ref sempre tem o valor atual. */
  const nomeRef = useRef("");
  const modeloRef = useRef<Modelo | null>(null);

  useEffect(() => {
    fetch("/api/templates?id=" + encodeURIComponent(id))
      .then((r) => r.json())
      .then((j: { modelo: Modelo }) => {
        setModelo(j.modelo); modeloRef.current = j.modelo;
        setNome(j.modelo.nome); nomeRef.current = j.modelo.nome;
      })
      .catch(() => setEstado({ texto: "Não consegui abrir este modelo.", tom: "erro" }));
  }, [id]);

  const salvarAgora = useCallback(async () => {
    if (salvando.current) { repetir.current = true; return; }
    salvando.current = true;
    /* laço, não recursão: se chegou tecla durante o PATCH, grava de novo com o
       que está nos refs agora */
    do {
      repetir.current = false;
      const nomeAtual = nomeRef.current.trim();
      const base = modeloRef.current;
      const corpo = pendente.current;
      if (!corpo && !nomeAtual) break;
      setEstado({ texto: "Salvando…" });
      try {
        const r = await fetch("/api/templates", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            acao: "salvar", id,
            conteudo_json: corpo?.json ?? base?.conteudo_json,
            conteudo_html: corpo?.html ?? base?.conteudo_html,
            nome: nomeAtual || undefined,
          }),
        });
        if (!r.ok) throw new Error(((await r.json()) as { erro?: string }).erro ?? "falha");
        /* o que acabou de ir pro banco vira a nova base, pra um salvamento só
           de nome não regravar conteúdo velho por cima */
        if (corpo && base) modeloRef.current = { ...base, conteudo_json: corpo.json, conteudo_html: corpo.html };
        if (pendente.current === corpo) pendente.current = null;
        setEstado({ texto: "Todas as alterações foram salvas", tom: "ok" });
      } catch (e) {
        setEstado({ texto: (e as Error).message || "Não consegui salvar.", tom: "erro" });
      }
    } while (repetir.current);
    salvando.current = false;
  }, [id]);

  const agendar = useCallback(() => {
    setEstado({ texto: AVISO });
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { void salvarAgora(); }, ESPERA_MS);
  }, [salvarAgora]);

  const aoMudar = useCallback((json: JSONContent, html: string) => {
    pendente.current = { json, html };
    agendar();
  }, [agendar]);

  /* grava o pendente ANTES de sair, senão a última tecla se perde; só depois
     dá o passo atrás (ou cai na lista, se não houver histórico nosso) */
  const voltar = useVoltar("/painel/configuracoes/contrato", useCallback(async () => {
    if (timer.current) clearTimeout(timer.current);
    await salvarAgora();
  }, [salvarAgora]));

  if (!modelo) return <p className="px-5 pt-6 text-[13px] text-ink-soft">Abrindo…</p>;

  return (
    /* Página inteira, não um retângulo dentro do painel: aqui não há moldura
       do app (ver `telaEditor` no AppShell), como no original, onde abrir o
       editor escondia a lateral e tirava o limite de largura da página. */
    <EditorContrato
      conteudoInicial={modelo.conteudo_json}
      aoMudar={aoMudar}
      topo={
        <div className="flex items-start gap-2 pt-2">
          <button type="button" onClick={() => { void voltar(); }} aria-label="Voltar pros modelos"
            className={`mt-1 inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg text-ink-soft transition-colors hover:bg-line hover:text-accent`}>
            <ArrowLeft size={18} />
          </button>
          <div className="min-w-0 flex-1">
            {/* o título É o campo: sem nome duplicado na mesma dobra */}
            <input type="text" value={nome} maxLength={80} aria-label="Nome do modelo"
              onChange={(e) => { setNome(e.target.value); nomeRef.current = e.target.value; agendar(); }}
              className={`-ml-1.5 w-full max-w-[560px] rounded-lg bg-transparent px-1.5 py-0.5 text-[22px] font-bold text-ink outline-none hover:bg-soft focus:bg-soft md:text-[26px]`} />
            <p className={"m-0 pl-1.5 text-[12.5px] " + (estado.tom === "ok" ? "text-ok" : estado.tom === "erro" ? "text-erro" : "text-ink-soft")}>{estado.texto}</p>
          </div>
        </div>
      }
    />
  );
}

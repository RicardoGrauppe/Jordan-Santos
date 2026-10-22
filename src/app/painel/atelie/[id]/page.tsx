/*
  Editor de UM modelo do Ateliê. Tela cheia, sem a moldura do app (ver
  `telaEditor` no AppShell), com a tela original do Puck (EditorAtelie).

  Salvamento sem botão, no mesmo desenho do editor de modelo de contrato:
  espera parar de mexer, e se uma gravação já está no ar marca pra repetir
  depois em vez de disparar duas em cima da outra (a segunda poderia chegar
  antes e gravar conteúdo velho por cima do novo). O que vai pro banco é lido
  de ref, nunca do estado via closure. O Voltar do cabeçalho grava o
  pendente antes de sair; sair por fora (voltar do navegador ou fechar a
  aba) manda o pendente com `keepalive`.

  O Publicar do cabeçalho do Puck é a única ação: no modelo que está no ar
  ele publica as mudanças; nos outros, põe o modelo no ar. Os dois confirmam,
  porque mudam o que o público vê. Nome, prévia, versões e descartar ficam
  no menu do modelo, na galeria.
*/
"use client";

import { use, useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { EditorAtelie } from "@/components/EditorAtelie";
import { Botao } from "@/components/ui";
import { useConfirmar } from "@/components/ModalConfirmar";
import { useToast } from "@/components/Toast";
import { contatoDaPagina, type DadosSite } from "@/lib/atelie/blocos";
import { AVISO_DE_EXEMPLO, temExemplo } from "@/lib/atelie/modelo-guiado";
import { api, ERRO_SESSAO } from "@/lib/painel";
import { useVoltar } from "@/lib/voltar";

const ESPERA_MS = 800;
const URL_API = "/api/atelie";

type Modelo = {
  id: string;
  nome: string;
  rascunho: DadosSite;
  publicado_em: string | null;
  noAr: boolean;
  pendente: boolean;
};

export default function EditorDoModelo({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const confirmar = useConfirmar();
  const { mostrar, elemento: toast } = useToast();

  const [modelo, setModelo] = useState<Modelo | null>(null);
  const [falhaAoAbrir, setFalhaAoAbrir] = useState<string | null>(null);
  const [raiz, setRaiz] = useState<DadosSite["root"]["props"]>(undefined);
  const [noAr, setNoAr] = useState(false);
  const [foraDoAr, setForaDoAr] = useState(false);
  const [publicando, setPublicando] = useState(false);

  const pendente = useRef<DadosSite | null>(null);
  /* o conteúdo de agora, pra conferir bloco e texto de exemplo ao publicar */
  const dadosAtuais = useRef<DadosSite | null>(null);
  const ultimoSalvo = useRef("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const salvando = useRef(false);
  const repetir = useRef(false);

  useEffect(() => {
    let vivo = true;
    api<{ modelo: Modelo }>(URL_API + "?id=" + encodeURIComponent(id))
      .then(({ modelo: m }) => {
        if (!vivo) return;
        setModelo(m);
        setRaiz(m.rascunho.root.props);
        setNoAr(m.noAr); setForaDoAr(m.pendente);
        ultimoSalvo.current = JSON.stringify(m.rascunho);
        dadosAtuais.current = m.rascunho;
      })
      .catch((e) => {
        if (!vivo) return;
        if ((e as Error).message === ERRO_SESSAO) { router.replace("/entrar"); return; }
        setFalhaAoAbrir((e as Error).message || "Não consegui abrir este modelo.");
      });
    return () => { vivo = false; };
  }, [id, router]);

  const salvarAgora = useCallback(async () => {
    if (salvando.current) { repetir.current = true; return; }
    salvando.current = true;
    /* laço, não recursão: se chegou mudança durante a gravação, grava de novo
       com o que está nos refs agora */
    do {
      repetir.current = false;
      const dados = pendente.current;
      if (!dados) break;
      try {
        await api(URL_API, { acao: "salvar", id, rascunho: dados });
        ultimoSalvo.current = JSON.stringify(dados);
        if (pendente.current === dados) pendente.current = null;
      } catch (e) {
        if ((e as Error).message === ERRO_SESSAO) { router.replace("/entrar"); return; }
        mostrar((e as Error).message || "Não consegui salvar.");
        break;
      }
    } while (repetir.current);
    salvando.current = false;
  }, [id, router, mostrar]);

  const descarregar = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current);
    await salvarAgora();
  }, [salvarAgora]);

  /* O Puck chama onChange também quando nada mudou de fato (ao abrir, ao
     selecionar); só agenda quando o conteúdo é outro. */
  const aoMudar = useCallback((dados: DadosSite) => {
    setRaiz(dados.root.props);
    dadosAtuais.current = dados;
    if (JSON.stringify(dados) === ultimoSalvo.current) return;
    pendente.current = dados;
    setForaDoAr(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { void salvarAgora(); }, ESPERA_MS);
  }, [salvarAgora]);

  /* sair no meio da espera (fechar a aba ou o voltar do navegador, que só
     desmonta a tela): o pendente vai com keepalive, que o navegador termina
     mesmo depois de a página sumir */
  useEffect(() => {
    function aoSair() {
      if (!pendente.current) return;
      if (timer.current) clearTimeout(timer.current);
      void fetch(URL_API, {
        method: "POST", keepalive: true, headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acao: "salvar", id, rascunho: pendente.current }),
      });
      pendente.current = null;
    }
    window.addEventListener("pagehide", aoSair);
    return () => { window.removeEventListener("pagehide", aoSair); aoSair(); };
  }, [id]);

  const voltar = useVoltar("/painel/atelie", descarregar);

  async function publicar() {
    if (publicando) return;
    /* página vazia não vai pro ar (a API também barra): o site ficaria em branco */
    if (!dadosAtuais.current?.content.length) { mostrar("Coloque pelo menos um bloco antes de publicar."); return; }
    if (noAr && !foraDoAr) { mostrar("O site já está igual a este modelo."); return; }
    const nome = modelo?.nome ?? "";
    const exemplo = temExemplo(dadosAtuais.current);
    const ok = await confirmar(noAr
      ? {
        titulo: "Publicar as mudanças?",
        texto: `O site passa a mostrar "${nome}" do jeito que está agora, com as mudanças que você fez.`,
        aviso: exemplo ? AVISO_DE_EXEMPLO : "Quem abrir o site depois disso já vê a versão nova.",
        rotuloOk: "Publicar",
      }
      : {
        titulo: "Pôr este modelo no ar?",
        texto: `O site passa a mostrar "${nome}" do jeito que está agora, pra todo mundo que abrir o link do estúdio. O modelo que está no ar hoje sai do ar, mas continua guardado no Ateliê.`,
        aviso: exemplo ? AVISO_DE_EXEMPLO : "Isto não é um teste. Quem abrir o site depois disso já vê este modelo.",
        rotuloOk: "Pôr no ar",
      });
    if (!ok) return;
    setPublicando(true);
    try {
      await descarregar();
      await api(URL_API, { acao: "por-no-ar", id });
      mostrar(noAr ? "Mudanças publicadas ✓" : "No ar ✓", { ok: true });
      setNoAr(true); setForaDoAr(false);
    } catch (e) {
      mostrar((e as Error).message || "Não consegui publicar, tente de novo.");
    } finally { setPublicando(false); }
  }

  if (falhaAoAbrir) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-soft px-5 text-center">
        <p className="m-0 text-[14px] text-ink-soft">{falhaAoAbrir}</p>
        <Botao variante="secundario" onClick={() => router.push("/painel/atelie")}>Voltar pro Ateliê</Botao>
      </div>
    );
  }
  if (!modelo) return <p className="px-5 pt-6 text-[13px] text-ink-soft">Abrindo…</p>;

  return (
    <>
      <EditorAtelie dados={modelo.rascunho} contato={contatoDaPagina(raiz)} aoMudar={aoMudar}
        titulo={modelo.nome} aoPublicar={() => { void publicar(); }} aoVoltar={() => { void voltar(); }} />
      {toast}
    </>
  );
}

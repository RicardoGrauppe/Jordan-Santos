/*
  Editor de UM modelo do Ateliê. Tela cheia, sem a moldura do app (ver
  `telaEditor` no AppShell), como o editor de contrato.

  Salvamento sem botão, no mesmo desenho do editor de modelo de contrato:
  espera parar de mexer, e se uma gravação já está no ar marca pra repetir
  depois em vez de disparar duas em cima da outra (a segunda poderia chegar
  antes e gravar conteúdo velho por cima do novo). O que vai pro banco é lido
  de ref, nunca do estado via closure. Voltar e "Ver como fica" gravam o
  pendente antes; fechar a aba manda o pendente com `keepalive`.

  O nome do modelo é o título do cabeçalho e salva sozinho também.

  Publicar é a única ação primária: no modelo que está no ar ela publica as
  mudanças; nos outros, "Pôr no ar" troca o site. As duas confirmam, porque
  mudam o que o público vê.
*/
"use client";

import { use, useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Eye, Globe } from "lucide-react";
import { EditorAtelie } from "@/components/EditorAtelie";
import { Botao, Selo } from "@/components/ui";
import { useConfirmar } from "@/components/ModalConfirmar";
import { useToast } from "@/components/Toast";
import { contatoDaPagina, type DadosSite } from "@/lib/atelie/blocos";
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

type Estado = { texto: string; tom?: "ok" | "erro" };

export default function EditorDoModelo({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const confirmar = useConfirmar();
  const { mostrar, elemento: toast } = useToast();

  const [modelo, setModelo] = useState<Modelo | null>(null);
  const [falhaAoAbrir, setFalhaAoAbrir] = useState<string | null>(null);
  const [nome, setNome] = useState("");
  const [raiz, setRaiz] = useState<DadosSite["root"]["props"]>(undefined);
  const [estado, setEstado] = useState<Estado>({ texto: "Tudo salvo", tom: "ok" });
  const [noAr, setNoAr] = useState(false);
  const [foraDoAr, setForaDoAr] = useState(false);
  const [publicando, setPublicando] = useState(false);
  const [temBlocos, setTemBlocos] = useState(false);

  const pendente = useRef<DadosSite | null>(null);
  const ultimoSalvo = useRef("");
  const nomeRef = useRef("");
  const nomeSalvo = useRef("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const salvando = useRef(false);
  const repetir = useRef(false);

  useEffect(() => {
    let vivo = true;
    api<{ modelo: Modelo }>(URL_API + "?id=" + encodeURIComponent(id))
      .then(({ modelo: m }) => {
        if (!vivo) return;
        setModelo(m);
        setNome(m.nome); nomeRef.current = m.nome; nomeSalvo.current = m.nome;
        setRaiz(m.rascunho.root.props);
        setNoAr(m.noAr); setForaDoAr(m.pendente); setTemBlocos(m.rascunho.content.length > 0);
        ultimoSalvo.current = JSON.stringify(m.rascunho);
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
      const nomeAtual = nomeRef.current.trim();
      const mudouNome = Boolean(nomeAtual) && nomeAtual !== nomeSalvo.current;
      if (!dados && !mudouNome) break;
      setEstado({ texto: "Salvando…" });
      try {
        if (dados) {
          await api(URL_API, { acao: "salvar", id, rascunho: dados });
          ultimoSalvo.current = JSON.stringify(dados);
          if (pendente.current === dados) pendente.current = null;
        }
        if (mudouNome) {
          await api(URL_API, { acao: "renomear", id, nome: nomeAtual });
          nomeSalvo.current = nomeAtual;
        }
        setEstado({ texto: "Tudo salvo", tom: "ok" });
      } catch (e) {
        if ((e as Error).message === ERRO_SESSAO) { router.replace("/entrar"); return; }
        setEstado({ texto: (e as Error).message || "Não consegui salvar.", tom: "erro" });
        break;
      }
    } while (repetir.current);
    salvando.current = false;
  }, [id, router]);

  const agendar = useCallback(() => {
    setEstado({ texto: "Mudanças ainda não salvas" });
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { void salvarAgora(); }, ESPERA_MS);
  }, [salvarAgora]);

  const descarregar = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current);
    await salvarAgora();
  }, [salvarAgora]);

  /* O Puck chama onChange também quando nada mudou de fato (ao abrir, ao
     selecionar); só agenda quando o conteúdo é outro. */
  const aoMudar = useCallback((dados: DadosSite) => {
    setRaiz(dados.root.props);
    setTemBlocos(dados.content.length > 0);
    if (JSON.stringify(dados) === ultimoSalvo.current) return;
    pendente.current = dados;
    setForaDoAr(true);
    agendar();
  }, [agendar]);

  /* fechar a aba no meio da espera: o pendente vai com keepalive, que o
     navegador termina mesmo depois de a página sumir */
  useEffect(() => {
    function aoSair() {
      if (!pendente.current) return;
      void fetch(URL_API, {
        method: "POST", keepalive: true, headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acao: "salvar", id, rascunho: pendente.current }),
      });
    }
    window.addEventListener("pagehide", aoSair);
    return () => window.removeEventListener("pagehide", aoSair);
  }, [id]);

  const voltar = useVoltar("/painel/atelie", descarregar);

  async function verComoFica() {
    await descarregar();
    window.open("/atelie/previa/" + id, "_blank", "noopener");
  }

  async function publicar() {
    const ok = await confirmar(noAr
      ? {
        titulo: "Publicar as mudanças?",
        texto: `O site passa a mostrar "${nomeRef.current.trim() || nomeSalvo.current}" do jeito que está agora, com as mudanças que você fez.`,
        aviso: "Quem abrir o site depois disso já vê a versão nova.",
        rotuloOk: "Publicar",
      }
      : {
        titulo: "Pôr este modelo no ar?",
        texto: `O site passa a mostrar "${nomeRef.current.trim() || nomeSalvo.current}" do jeito que está agora, pra todo mundo que abrir o link do estúdio. O modelo que está no ar hoje sai do ar, mas continua guardado no Ateliê.`,
        aviso: "Isto não é um teste. Quem abrir o site depois disso já vê este modelo.",
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

  const corEstado = estado.tom === "ok" ? "text-ok" : estado.tom === "erro" ? "text-erro" : "text-ink-soft";
  const nadaAPublicar = noAr && !foraDoAr;
  const rotuloPublicar = noAr ? "Publicar mudanças" : "Pôr no ar";
  /* página vazia não vai pro ar (a API também barra): o site ficaria em branco */
  const motivoDesligado = !temBlocos ? "Coloque pelo menos um bloco antes" : nadaAPublicar ? "O site já está igual a este modelo" : undefined;

  return (
    <>
      <EditorAtelie
        dados={modelo.rascunho}
        contato={contatoDaPagina(raiz)}
        aoMudar={aoMudar}
        topo={
          <div className="flex min-w-0 items-center gap-1.5">
            <button type="button" onClick={() => { void voltar(); }} aria-label="Voltar pro Ateliê"
              className="inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-[10px] text-ink-soft transition-colors hover:bg-soft hover:text-accent">
              <ArrowLeft size={18} />
            </button>
            <div className="min-w-0 flex-1">
              {/* o título É o campo do nome, como no editor de contrato */}
              <input type="text" value={nome} maxLength={80} aria-label="Nome do modelo"
                onChange={(e) => { setNome(e.target.value); nomeRef.current = e.target.value; agendar(); }}
                className="-ml-1.5 block w-full max-w-[360px] truncate rounded-lg bg-transparent px-1.5 py-0.5 text-[15px] font-semibold text-ink outline-none hover:bg-soft focus:bg-soft" />
              <div className="flex min-w-0 items-center gap-1.5">
                {noAr ? <Selo tom="ok">No ar</Selo> : null}
                <p className={"m-0 truncate text-[12px] " + corEstado}>{estado.texto}</p>
              </div>
            </div>
          </div>
        }
        acoes={
          <>
            {/* invólucro com o display: "hidden" e o inline-flex do Botao na
                mesma lista brigam (ver CLAUDE.md, Responsivo) */}
            <span className="hidden lg:block">
              <Botao variante="fantasma" className="h-10 px-3.5" onClick={() => { void verComoFica(); }}>
                <Eye size={16} /> Ver como fica
              </Botao>
            </span>
            <Botao className="h-10 px-3.5 sm:px-4" disabled={Boolean(motivoDesligado) || publicando} onClick={() => { void publicar(); }}
              aria-label={rotuloPublicar} title={motivoDesligado}>
              <Globe size={16} />
              <span className="hidden sm:inline">{rotuloPublicar}</span>
              <span className="sm:hidden">{noAr ? "Publicar" : "No ar"}</span>
            </Botao>
          </>
        }
      />
      {toast}
    </>
  );
}

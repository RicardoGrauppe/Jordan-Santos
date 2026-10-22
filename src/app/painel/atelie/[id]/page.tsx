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

  O menu "Mais" (reticências) guarda o resto: Versões publicadas (ver e
  restaurar no rascunho) e Descartar mudanças (o rascunho volta a ser o que
  está publicado). Depois dos dois, o editor recarrega o modelo e remonta o
  Puck com o conteúdo novo, porque ele não aceita trocar os dados por fora.
*/
"use client";

import { use, useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, EllipsisVertical, Eye, Globe, History, RotateCcw } from "lucide-react";
import { EditorAtelie } from "@/components/EditorAtelie";
import { VersoesAtelie } from "@/components/VersoesAtelie";
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
  const [publicadoEm, setPublicadoEm] = useState<string | null>(null);
  /* trocar a chave remonta o Puck com o conteúdo recarregado */
  const [chaveEditor, setChaveEditor] = useState(0);
  const [menuAberto, setMenuAberto] = useState(false);
  const [versoesAbertas, setVersoesAbertas] = useState(false);
  const menu = useRef<HTMLDivElement>(null);

  const pendente = useRef<DadosSite | null>(null);
  const ultimoSalvo = useRef("");
  const nomeRef = useRef("");
  const nomeSalvo = useRef("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const salvando = useRef(false);
  const repetir = useRef(false);

  const aplicar = useCallback((m: Modelo) => {
    setModelo(m);
    setNome(m.nome); nomeRef.current = m.nome; nomeSalvo.current = m.nome;
    setRaiz(m.rascunho.root.props);
    setNoAr(m.noAr); setForaDoAr(m.pendente); setTemBlocos(m.rascunho.content.length > 0);
    setPublicadoEm(m.publicado_em);
    ultimoSalvo.current = JSON.stringify(m.rascunho);
  }, []);

  useEffect(() => {
    let vivo = true;
    api<{ modelo: Modelo }>(URL_API + "?id=" + encodeURIComponent(id))
      .then(({ modelo: m }) => { if (vivo) aplicar(m); })
      .catch((e) => {
        if (!vivo) return;
        if ((e as Error).message === ERRO_SESSAO) { router.replace("/entrar"); return; }
        setFalhaAoAbrir((e as Error).message || "Não consegui abrir este modelo.");
      });
    return () => { vivo = false; };
  }, [id, router, aplicar]);

  /* menu "Mais": fecha ao tocar fora (por contenção, ver o cartão da galeria) */
  useEffect(() => {
    if (!menuAberto) return;
    const fechar = (e: PointerEvent) => { if (!menu.current?.contains(e.target as Node)) setMenuAberto(false); };
    document.addEventListener("pointerdown", fechar);
    return () => document.removeEventListener("pointerdown", fechar);
  }, [menuAberto]);

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
  const fecharVersoes = useCallback(() => setVersoesAbertas(false), []);

  async function verComoFica() {
    await descarregar();
    window.open("/atelie/previa/" + id + "?barra=1", "_blank", "noopener");
  }

  /* Troca o conteúdo do editor pelo que está no banco agora. O que estava
     esperando pra salvar é jogado fora de propósito: quem chama acabou de
     substituir o rascunho. */
  async function recarregar() {
    if (timer.current) clearTimeout(timer.current);
    pendente.current = null;
    const { modelo: m } = await api<{ modelo: Modelo }>(URL_API + "?id=" + encodeURIComponent(id));
    aplicar(m);
    setEstado({ texto: "Tudo salvo", tom: "ok" });
    setChaveEditor((k) => k + 1);
  }

  async function descartar() {
    setMenuAberto(false);
    const ok = await confirmar({
      titulo: "Descartar as mudanças?",
      texto: "O que você editou desde a última publicação vai embora, e o modelo volta a ficar igual ao que foi publicado.",
      rotuloOk: "Descartar",
      perigo: true,
    });
    if (!ok) return;
    try {
      if (timer.current) clearTimeout(timer.current);
      pendente.current = null;
      await api(URL_API, { acao: "descartar", id });
      await recarregar();
      mostrar("Mudanças descartadas");
    } catch (e) { mostrar((e as Error).message || "Não consegui descartar, tente de novo."); }
  }

  async function restaurar(versao: { id: string; quando: string }) {
    const ok = await confirmar({
      titulo: "Restaurar esta versão?",
      texto: `O rascunho passa a ser a versão publicada em ${versao.quando}. O que está no rascunho agora é substituído. O site não muda até você publicar.`,
      rotuloOk: "Restaurar",
    });
    if (!ok) return;
    try {
      if (timer.current) clearTimeout(timer.current);
      pendente.current = null;
      await api(URL_API, { acao: "restaurar-versao", id, versao: versao.id });
      setVersoesAbertas(false);
      await recarregar();
      mostrar("Versão restaurada no rascunho ✓", { ok: true });
    } catch (e) { mostrar((e as Error).message || "Não consegui restaurar, tente de novo."); }
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
      setNoAr(true); setForaDoAr(false); setPublicadoEm(new Date().toISOString());
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
  const podeDescartar = Boolean(publicadoEm) && foraDoAr;
  /* página vazia não vai pro ar (a API também barra): o site ficaria em branco */
  const motivoDesligado = !temBlocos ? "Coloque pelo menos um bloco antes" : nadaAPublicar ? "O site já está igual a este modelo" : undefined;

  return (
    <>
      <EditorAtelie
        key={chaveEditor}
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
            <div ref={menu} className="relative">
              <button type="button" aria-label="Mais opções" aria-haspopup="true" aria-expanded={menuAberto}
                onClick={() => setMenuAberto((v) => !v)}
                className={"inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-full text-ink-soft transition-colors hover:bg-soft hover:text-ink " + (menuAberto ? "bg-soft text-ink" : "")}>
                <EllipsisVertical size={18} />
              </button>
              {menuAberto ? (
                <div className="absolute right-0 top-12 z-[60] min-w-[230px] rounded-xl bg-paper p-1.5 shadow-alta">
                  <button type="button" onClick={() => { setMenuAberto(false); setVersoesAbertas(true); }}
                    className="flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-[11px] py-[9px] text-left text-[13.5px] text-ink hover:bg-soft">
                    <History size={15} className="opacity-85" /> Versões publicadas
                  </button>
                  <button type="button" onClick={() => { void descartar(); }} disabled={!podeDescartar}
                    title={podeDescartar ? undefined : publicadoEm ? "Não há mudança fora do ar" : "Este modelo nunca foi publicado"}
                    className="flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-[11px] py-[9px] text-left text-[13.5px] text-erro enabled:hover:bg-erro-tint disabled:cursor-not-allowed disabled:opacity-40">
                    <RotateCcw size={15} className="opacity-85" /> Descartar mudanças
                  </button>
                </div>
              ) : null}
            </div>
          </>
        }
      />
      {versoesAbertas ? (
        <VersoesAtelie idModelo={id} noAr={noAr} aoRestaurar={(v) => { void restaurar(v); }} aoFechar={fecharVersoes} />
      ) : null}
      {toast}
    </>
  );
}

/*
  Formulário: o fotógrafo edita o /cadastro que manda pro casal (22/10/2026).
  Visual no brandbook, seção 18. Regras de quem pode o quê em lib/formulario.ts.

  Um card por seção do formulário, na ordem em que o casal vê. Dentro, uma
  linha por campo: fechada mostra o nome e as chaves; o lápis abre o texto da
  pergunta e o de exemplo. Pergunta nova nasce aberta, com o cursor no texto.

  "Digitou, salvou", como a ficha: 700ms de pausa e grava. Uma gravação por vez
  (quem chega no meio vira "salva de novo quando terminar") e nada sobe se o
  conteúdo for igual ao último salvo. A resposta do servidor NÃO volta pro
  estado da tela: ela vem normalizada (sem espaço no fim, por exemplo), e
  trocar o texto embaixo do cursor enquanto a pessoa digita come letras.
*/
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowDown, ArrowUp, CalendarHeart, ExternalLink, Lock, MapPin, Pencil, Plus,
  Sparkles, Trash2, TriangleAlert, UserRound, X,
} from "lucide-react";
import { Botao, BotaoVoltar, Campo, CartaoAviso, Chave, Estado } from "@/components/ui";
import { useConfirmar } from "@/components/ModalConfirmar";
import { TituloMobile } from "@/components/cabecalho-mobile";
import { EditorFotos } from "./EditorFotos";
import {
  CAMPOS_FIXOS, SECOES, SEM_PLACEHOLDER, TIPOS_PERGUNTA, LIMITES, novoIdPergunta, regraDoPar,
  type AjusteCampo, type DefinicaoCampo, type Formulario, type Pergunta, type SecaoFormulario, type TipoPergunta,
} from "@/lib/formulario";

const ESPERA_AUTOSAVE = 700;

const ICONE_SECAO: Record<SecaoFormulario, typeof UserRound> = {
  assinar: UserRound,
  endereco: MapPin,
  evento: CalendarHeart,
  extra: Sparkles,
};

/* o que cada seção diz sobre si mesma, abaixo do título */
const AJUDA_SECAO: Partial<Record<SecaoFormulario, string>> = {
  extra: "Perguntas suas, no fim do formulário. As respostas aparecem na ficha do cliente.",
};

type Msg = { texto: string; tom?: "ok" | "erro" };

/* ---------- linhas ---------- */

/* Linha no pastel petróleo #F7F9FA, sem borda (brandbook 18 e o comentário
   do <Secao> no kit: dentro de card branco, o que é item usa esse tom). */
const LINHA = "rounded-[14px] bg-[#F7F9FA] px-3.5 py-3 transition-opacity";

const BOTAO_ICONE =
  "inline-flex h-[30px] w-[30px] shrink-0 cursor-pointer items-center justify-center rounded-[9px] " +
  "bg-transparent text-ink-soft transition-colors hover:bg-line hover:text-accent disabled:cursor-default disabled:opacity-35";

function BotaoEditar({ aberto, aoAlternar, rotulo }: { aberto: boolean; aoAlternar: () => void; rotulo: string }) {
  return (
    <button
      type="button"
      onClick={aoAlternar}
      aria-expanded={aberto}
      aria-label={(aberto ? "Fechar " : "Editar ") + rotulo}
      className={BOTAO_ICONE + (aberto ? " bg-line text-accent" : "")}
    >
      {aberto ? <X size={14} /> : <Pencil size={14} />}
    </button>
  );
}

/* As três chaves de todo campo (brandbook 18): Obrigatório, Aparece e
   Cadeado. O cadeado trava as outras duas; obrigatório também trava quando o
   campo está escondido (não dá pra exigir o que o casal não vê). */
function ChavesCampo({
  rotuloObrigatorio = "Obrigatório", visivel, obrigatorio, travado, aoMudar,
}: {
  rotuloObrigatorio?: string;
  visivel: boolean;
  obrigatorio: boolean;
  travado: boolean;
  aoMudar: (m: { visivel?: boolean; obrigatorio?: boolean; travado?: boolean }) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
      <Chave rotulo={rotuloObrigatorio} ligada={obrigatorio} desligada={travado || !visivel}
        aoMudar={(v) => aoMudar({ obrigatorio: v })} />
      <Chave rotulo="Aparece" ligada={visivel} desligada={travado} aoMudar={(v) => aoMudar({ visivel: v })} />
      <Chave rotulo="Cadeado" ligada={travado} aoMudar={(v) => aoMudar({ travado: v })} />
    </div>
  );
}

/* Linha de baixo do nome: o estado (com o cadeado na frente quando travado)
   ou, quando o campo deixa de cumprir o que o contrato precisa, o aviso. */
function EstadoCampo({ travado, texto, aviso }: { travado: boolean; texto: string; aviso?: string | null }) {
  if (aviso) {
    return (
      <div className="mt-0.5 flex items-start gap-1 text-[11.5px] leading-[1.4] text-[#7A5A11]">
        <TriangleAlert size={12} className="mt-px shrink-0" /> {aviso}
      </div>
    );
  }
  return (
    <div className="mt-0.5 flex items-center gap-1 text-[11.5px] text-ink-soft">
      {travado ? <Lock size={11} className="shrink-0" aria-label="Com cadeado" /> : null}
      {texto}
    </div>
  );
}

function LinhaCampoFixo({
  def, ajuste, parNomes, aoMudar,
}: { def: DefinicaoCampo; ajuste: AjusteCampo; parNomes: boolean; aoMudar: (a: AjusteCampo) => void }) {
  const [aberto, setAberto] = useState(false);
  const ehNome = def.id === "noivo" || def.id === "noiva";
  const estado = !ajuste.visivel
    ? (def.foraDoContrato || def.aviso ? "Escondido" : "Escondido, fica em branco no contrato")
    : ajuste.obrigatorio ? "Obrigatório"
    : ehNome && parNomes ? "Basta um dos dois nomes"
    : "Opcional";
  /* aviso só pra quem o contrato usa e quando ele pode chegar vazio */
  const podeFaltar = !ajuste.visivel || (!ajuste.obrigatorio && !(ehNome && parNomes));
  const aviso = def.aviso && podeFaltar ? estado + ". " + def.aviso : null;

  return (
    <div className={LINHA + (ajuste.visivel ? "" : " opacity-60")}>
      <div className="flex items-start gap-3 md:items-center">
        <div className="flex min-w-0 flex-1 flex-col gap-1.5 md:flex-row md:items-center md:gap-4">
          <div className="min-w-0 md:flex-1">
            <div className="truncate text-[13.5px] font-semibold text-ink">{ajuste.rotulo}</div>
            <EstadoCampo travado={ajuste.travado} texto={estado} aviso={aviso} />
          </div>
          <ChavesCampo visivel={ajuste.visivel} obrigatorio={ajuste.obrigatorio} travado={ajuste.travado}
            aoMudar={(m) => aoMudar({ ...ajuste, ...m })} />
        </div>
        <BotaoEditar aberto={aberto} aoAlternar={() => setAberto((v) => !v)} rotulo={ajuste.rotulo} />
      </div>

      {aberto ? (
        <div className="mt-3 grid grid-cols-1 gap-x-4 md:grid-cols-2">
          <Campo id={"f-" + def.id + "-rotulo"} rotulo="Pergunta" autoComplete="off" maxLength={LIMITES.rotulo}
            placeholder={def.rotulo} value={ajuste.rotulo} className="bg-white focus:bg-white"
            onChange={(e) => aoMudar({ ...ajuste, rotulo: e.target.value })} />
          {SEM_PLACEHOLDER.includes(def.id) ? null : (
            <Campo id={"f-" + def.id + "-exemplo"} rotulo="Texto de exemplo" autoComplete="off" maxLength={LIMITES.placeholder}
              placeholder="Aparece apagado dentro do campo" value={ajuste.placeholder} className="bg-white focus:bg-white"
              onChange={(e) => aoMudar({ ...ajuste, placeholder: e.target.value })} />
          )}
          {ajuste.rotulo.trim() !== def.rotulo || ajuste.placeholder !== def.placeholder ? (
            <div className="col-span-full -mt-1">
              <button type="button"
                onClick={() => aoMudar({ ...ajuste, rotulo: def.rotulo, placeholder: def.placeholder })}
                className="cursor-pointer rounded-lg bg-transparent px-2 py-1 -ml-2 text-[12.5px] text-ink-soft transition-colors hover:bg-line hover:text-accent">
                Voltar ao texto original
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

const SELECT =
  "h-11 w-full cursor-pointer appearance-none rounded-[10px] bg-white px-3.5 text-sm text-ink outline-none transition-colors";

function LinhaPergunta({
  pergunta, abertaInicial, primeira, ultima, aoMudar, aoMover, aoApagar,
}: {
  pergunta: Pergunta;
  abertaInicial: boolean;
  primeira: boolean;
  ultima: boolean;
  aoMudar: (p: Pergunta) => void;
  aoMover: (passo: -1 | 1) => void;
  aoApagar: () => void;
}) {
  const [aberta, setAberta] = useState(abertaInicial);
  const tipo = TIPOS_PERGUNTA.find((t) => t.id === pergunta.tipo)?.rotulo ?? "";
  const semOpcoes = pergunta.tipo === "escolha" && !pergunta.opcoes.some((o) => o.trim());
  const aviso = !pergunta.rotulo.trim() ? "Sem texto, ainda não aparece pro casal"
    : semOpcoes ? "Sem opções, ainda não aparece pro casal" : null;

  function mudarOpcao(i: number, v: string) {
    aoMudar({ ...pergunta, opcoes: pergunta.opcoes.map((o, j) => (j === i ? v : o)) });
  }

  return (
    <div className={LINHA + (pergunta.visivel ? "" : " opacity-60")}>
      <div className="flex items-start gap-3 md:items-center">
        <div className="flex min-w-0 flex-1 flex-col gap-1.5 md:flex-row md:items-center md:gap-4">
          <div className="min-w-0 md:flex-1">
            <div className={"truncate text-[13.5px] font-semibold " + (pergunta.rotulo.trim() ? "text-ink" : "text-ink-soft")}>
              {pergunta.rotulo.trim() || "Pergunta nova"}
            </div>
            <EstadoCampo travado={pergunta.travado} aviso={aviso}
              texto={tipo + (!pergunta.visivel ? ", escondida" : pergunta.obrigatorio ? ", obrigatória" : ", opcional")} />
          </div>
          <ChavesCampo rotuloObrigatorio="Obrigatória" visivel={pergunta.visivel} obrigatorio={pergunta.obrigatorio}
            travado={pergunta.travado} aoMudar={(m) => aoMudar({ ...pergunta, ...m })} />
        </div>
        <BotaoEditar aberto={aberta} aoAlternar={() => setAberta((v) => !v)} rotulo={pergunta.rotulo || "pergunta"} />
      </div>

      {aberta ? (
        <div className="mt-3">
          <Campo id={"f-" + pergunta.id + "-rotulo"} rotulo="Pergunta" autoComplete="off" maxLength={LIMITES.rotulo}
            placeholder="Ex.: Como vocês se conheceram?" value={pergunta.rotulo} className="bg-white focus:bg-white"
            autoFocus={abertaInicial}
            onChange={(e) => aoMudar({ ...pergunta, rotulo: e.target.value })} />

          <div className="grid grid-cols-1 gap-x-4 md:grid-cols-2">
            <div className="mb-3.5">
              <label htmlFor={"f-" + pergunta.id + "-tipo"} className="mb-1.5 block text-[12.5px] font-medium text-ink-soft">Tipo de resposta</label>
              <select id={"f-" + pergunta.id + "-tipo"} className={SELECT} value={pergunta.tipo}
                onChange={(e) => {
                  const tipoNovo = e.target.value as TipoPergunta;
                  aoMudar({
                    ...pergunta, tipo: tipoNovo,
                    /* escolha nasce com uma linha pronta pra digitar */
                    opcoes: tipoNovo === "escolha" ? (pergunta.opcoes.length ? pergunta.opcoes : [""]) : [],
                    placeholder: tipoNovo === "data" || tipoNovo === "escolha" ? "" : pergunta.placeholder,
                  });
                }}>
                {TIPOS_PERGUNTA.map((t) => <option key={t.id} value={t.id}>{t.rotulo}</option>)}
              </select>
            </div>
            <div className="mb-3.5">
              <label htmlFor={"f-" + pergunta.id + "-secao"} className="mb-1.5 block text-[12.5px] font-medium text-ink-soft">Seção</label>
              <select id={"f-" + pergunta.id + "-secao"} className={SELECT} value={pergunta.secao}
                onChange={(e) => aoMudar({ ...pergunta, secao: e.target.value as SecaoFormulario })}>
                {SECOES.map((s) => <option key={s.id} value={s.id}>{s.titulo}</option>)}
              </select>
            </div>
          </div>

          {pergunta.tipo === "escolha" ? (
            <div className="mb-3.5">
              <div className="mb-1.5 text-[12.5px] font-medium text-ink-soft">Opções</div>
              <div className="flex flex-col gap-2">
                {pergunta.opcoes.map((o, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      aria-label={"Opção " + (i + 1)}
                      autoComplete="off"
                      maxLength={LIMITES.opcao}
                      placeholder={"Opção " + (i + 1)}
                      value={o}
                      onChange={(e) => mudarOpcao(i, e.target.value)}
                      className="h-11 w-full rounded-[10px] bg-white px-3.5 text-sm text-ink outline-none placeholder:text-ink-soft/70"
                    />
                    <button type="button" aria-label={"Tirar opção " + (i + 1)} className={BOTAO_ICONE}
                      onClick={() => aoMudar({ ...pergunta, opcoes: pergunta.opcoes.filter((_, j) => j !== i) })}>
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
              {pergunta.opcoes.length < LIMITES.opcoes ? (
                <button type="button"
                  onClick={() => aoMudar({ ...pergunta, opcoes: [...pergunta.opcoes, ""] })}
                  className="mt-2 inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-transparent px-2 py-1.5 -ml-2 text-[12.5px] font-medium text-accent transition-colors hover:bg-line">
                  <Plus size={14} /> Adicionar opção
                </button>
              ) : null}
            </div>
          ) : pergunta.tipo !== "data" ? (
            <Campo id={"f-" + pergunta.id + "-exemplo"} rotulo="Texto de exemplo" autoComplete="off" maxLength={LIMITES.placeholder}
              placeholder="Aparece apagado dentro do campo" value={pergunta.placeholder} className="bg-white focus:bg-white"
              onChange={(e) => aoMudar({ ...pergunta, placeholder: e.target.value })} />
          ) : null}

          <div className="flex items-center gap-1">
            <button type="button" className={BOTAO_ICONE} disabled={primeira} aria-label="Subir pergunta" onClick={() => aoMover(-1)}>
              <ArrowUp size={14} />
            </button>
            <button type="button" className={BOTAO_ICONE} disabled={ultima} aria-label="Descer pergunta" onClick={() => aoMover(1)}>
              <ArrowDown size={14} />
            </button>
            <button type="button" onClick={aoApagar}
              className="ml-auto inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-transparent px-2 py-1.5 text-[12.5px] font-medium text-erro transition-colors hover:bg-erro-tint">
              <Trash2 size={14} /> Apagar pergunta
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/* ---------- página ---------- */

export default function PaginaFormulario() {
  const confirmar = useConfirmar();
  const [form, setForm] = useState<Formulario | null>(null);
  const [erroCarga, setErroCarga] = useState("");
  const [msg, setMsg] = useState<Msg>({ texto: "" });
  /* pergunta recém-criada: nasce aberta e com foco */
  const [novaId, setNovaId] = useState<string | null>(null);

  const formRef = useRef<Formulario | null>(null);
  const ultimoSalvo = useRef("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const salvando = useRef(false);
  const deNovo = useRef(false);

  useEffect(() => {
    fetch("/api/formulario")
      .then(async (r) => {
        const j = (await r.json().catch(() => ({}))) as { formulario?: Formulario; erro?: string };
        if (!r.ok || !j.formulario) throw new Error(j.erro || "falha");
        ultimoSalvo.current = JSON.stringify(j.formulario);
        formRef.current = j.formulario;
        setForm(j.formulario);
      })
      .catch(() => setErroCarga("Não consegui carregar o formulário. Recarregue a página."));
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, []);

  const salvar = useCallback(async () => {
    const atual = formRef.current;
    if (!atual) return;
    const corpo = JSON.stringify(atual);
    if (corpo === ultimoSalvo.current) return;
    if (salvando.current) { deNovo.current = true; return; }
    salvando.current = true;
    setMsg({ texto: "Salvando…" });
    try {
      const r = await fetch("/api/formulario", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ formulario: atual }),
      });
      const j = (await r.json().catch(() => ({}))) as { erro?: string };
      if (!r.ok) throw new Error(j.erro || "Não consegui salvar.");
      ultimoSalvo.current = corpo;
      setMsg({ texto: "Salvo ✓", tom: "ok" });
    } catch (e) {
      setMsg({ texto: (e as Error).message || "Não consegui salvar.", tom: "erro" });
    } finally {
      salvando.current = false;
      if (deNovo.current) { deNovo.current = false; void salvar(); }
    }
  }, []);

  function mudar(novo: Formulario) {
    formRef.current = novo;
    setForm(novo);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { timer.current = null; void salvar(); }, ESPERA_AUTOSAVE);
  }

  /* saiu da página com gravação pendente: grava já, sem esperar a pausa */
  useEffect(() => () => {
    if (!timer.current) return;
    clearTimeout(timer.current);
    const atual = formRef.current;
    if (!atual || JSON.stringify(atual) === ultimoSalvo.current) return;
    void fetch("/api/formulario", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ formulario: atual }), keepalive: true,
    });
  }, []);

  /* lê a lista do formRef, não do estado: várias fotos sobem em sequência e
     cada uma tem que entrar na lista que já tem a anterior */
  function mudarFotos(fn: (atual: Formulario["fotos"]) => Formulario["fotos"]) {
    const atual = formRef.current;
    if (!atual) return;
    const fotos = fn(atual.fotos);
    if (fotos === atual.fotos) return;
    mudar({ ...atual, fotos });
  }

  function mudarCampo(id: DefinicaoCampo["id"], ajuste: AjusteCampo) {
    if (!form) return;
    mudar({ ...form, campos: { ...form.campos, [id]: ajuste } });
  }

  function mudarPergunta(p: Pergunta) {
    if (!form) return;
    mudar({ ...form, perguntas: form.perguntas.map((x) => (x.id === p.id ? p : x)) });
  }

  function adicionarPergunta(secao: SecaoFormulario) {
    if (!form || form.perguntas.length >= LIMITES.perguntas) return;
    const id = novoIdPergunta();
    setNovaId(id);
    mudar({
      ...form,
      perguntas: [...form.perguntas, {
        id, secao, tipo: "texto", rotulo: "", placeholder: "", obrigatorio: false, visivel: true, travado: false, opcoes: [],
      }],
    });
  }

  /* troca de lugar com a vizinha DA MESMA SEÇÃO: a lista guarda todas
     juntas, e a ordem que importa é a de dentro de cada seção */
  function moverPergunta(p: Pergunta, passo: -1 | 1) {
    if (!form) return;
    const daSecao = form.perguntas.filter((x) => x.secao === p.secao);
    const i = daSecao.findIndex((x) => x.id === p.id);
    const vizinha = daSecao[i + passo];
    if (!vizinha) return;
    const lista = [...form.perguntas];
    const a = lista.findIndex((x) => x.id === p.id);
    const b = lista.findIndex((x) => x.id === vizinha.id);
    [lista[a], lista[b]] = [lista[b], lista[a]];
    mudar({ ...form, perguntas: lista });
  }

  async function apagarPergunta(p: Pergunta) {
    if (!form) return;
    const ok = await confirmar({
      titulo: "Apagar pergunta?",
      texto: "Ela sai do formulário. Quem já respondeu continua com a resposta na ficha.",
      rotuloOk: "Apagar",
      perigo: true,
    });
    if (!ok || !formRef.current) return;
    mudar({ ...formRef.current, perguntas: formRef.current.perguntas.filter((x) => x.id !== p.id) });
  }

  function abrirFormulario() {
    window.open("/cadastro", "_blank", "noopener");
  }

  const cheio = !!form && form.perguntas.length >= LIMITES.perguntas;

  return (
    <div className="mx-auto max-w-[760px]">
      <TituloMobile acao={{ rotulo: "Ver formulário", Icone: ExternalLink, aoAcionar: abrirFormulario }} />

      {/* no celular o título e o voltar vivem no cabeçalho (cabecalho-mobile.tsx) */}
      <div className="hidden md:block">
        <BotaoVoltar href="/painel" rotulo="Home" />
        <div className="mb-6 flex items-center justify-between gap-4">
          <h1 className="m-0 text-[26px] font-bold text-ink">Formulário</h1>
          <Botao variante="secundario" onClick={abrirFormulario}>
            <ExternalLink size={15} /> Ver formulário
          </Botao>
        </div>
      </div>

      <CartaoAviso className="mb-4">
        É o formulário que o casal preenche pra confirmar a data. Mude o texto das perguntas, esconda o que você não usa e
        crie perguntas suas. Ligue o cadeado no que não pode mudar sem querer.
      </CartaoAviso>

      {erroCarga ? <p className="text-[13px] text-erro">{erroCarga}</p> : null}

      {form ? (
        <>
          <EditorFotos fotos={form.fotos} aoMudar={mudarFotos} />
          {SECOES.map((secao) => {
            const Icone = ICONE_SECAO[secao.id];
            const fixos = CAMPOS_FIXOS.filter((c) => c.secao === secao.id);
            const perguntas = form.perguntas.filter((p) => p.secao === secao.id);
            return (
              <section key={secao.id} className="mb-4 rounded-[22px] bg-paper px-4 pb-5 pt-[20px] shadow-card md:px-6 md:pb-6">
                <h2 className="m-0 flex items-center gap-[9px] text-[13px] font-semibold tracking-[.02em] text-ink">
                  <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[13px] bg-accent-tint text-accent">
                    <Icone size={16} />
                  </span>
                  {secao.titulo}
                </h2>
                {AJUDA_SECAO[secao.id] ? (
                  <p className="m-0 mt-2 text-[12.5px] text-ink-soft">{AJUDA_SECAO[secao.id]}</p>
                ) : null}

                <div className="mt-4 flex flex-col gap-2">
                  {fixos.map((def) => (
                    <LinhaCampoFixo key={def.id} def={def} ajuste={form.campos[def.id]} parNomes={regraDoPar(form)}
                      aoMudar={(a) => mudarCampo(def.id, a)} />
                  ))}
                  {perguntas.map((p, i) => (
                    <LinhaPergunta key={p.id} pergunta={p} abertaInicial={p.id === novaId}
                      primeira={i === 0} ultima={i === perguntas.length - 1}
                      aoMudar={mudarPergunta} aoMover={(passo) => moverPergunta(p, passo)}
                      aoApagar={() => void apagarPergunta(p)} />
                  ))}
                </div>

                <button
                  type="button"
                  disabled={cheio}
                  onClick={() => adicionarPergunta(secao.id)}
                  className={
                    "mt-3 inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-transparent px-2 py-1.5 -ml-2 " +
                    "text-[13px] font-medium text-accent transition-colors hover:bg-soft disabled:cursor-default disabled:opacity-45"
                  }
                >
                  <Plus size={15} /> Adicionar pergunta
                </button>
              </section>
            );
          })}
          {cheio ? <p className="m-0 mb-4 text-[12.5px] text-ink-soft">Chegou no limite de {LIMITES.perguntas} perguntas suas.</p> : null}
        </>
      ) : !erroCarga ? (
        <div className="flex flex-col gap-4" aria-hidden>
          {[0, 1, 2].map((i) => <div key={i} className="h-[220px] animate-pulse rounded-[22px] bg-paper shadow-card" />)}
        </div>
      ) : null}

      {/* estado do salvamento grudado embaixo, onde o olho termina; no
          celular sobe acima da barra flutuante */}
      <div className="pointer-events-none sticky bottom-[calc(96px+var(--sab,0px))] z-10 flex justify-end md:bottom-4">
        {msg.texto ? (
          <div className="rounded-full bg-paper px-3.5 py-1.5 shadow-card">
            <Estado texto={msg.texto} tom={msg.tom} />
          </div>
        ) : null}
      </div>
      <span className="sr-only" aria-live="polite">{msg.texto}</span>
    </div>
  );
}

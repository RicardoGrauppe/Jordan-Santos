/*
  Editor do contrato DE UM CLIENTE (22/10/2026). É o "Abrir rascunho do
  contrato" da ficha.

  Mesma tela do editor de modelos (componente EditorContrato, página cheia,
  salvamento automático), mas editando a CÓPIA do texto que o contrato guarda
  (template_json_snapshot): mexer aqui não muda o modelo nem outro cliente. Os
  campos fixos (nome, CPF, endereço, evento, valores…) entram pelo "+" da
  barra e puxam o valor da ficha do cliente na hora de gerar o PDF; o texto se
  edita aqui, os dados se editam na ficha.

  O botão do cabeçalho é o fluxo inteiro, decidido com o Ricardo:
  - nunca enviado → "Assinar e enviar": sobe pra Autentique, o fotógrafo
    assina lá na hora (o clique É a assinatura dele; o passo de desenhar a
    cursiva dentro do app saiu) e volta o link do casal;
  - enviado e sem edição depois → "Abrir na Autentique";
  - enviado e EDITADO depois → "Atualizar na Autentique": confirma antes,
    porque a Autentique não troca o PDF de um documento existente. O de lá é
    apagado e outro é criado: link novo pro casal e um documento a mais da
    cota.
  - assinado pelo casal → nada edita; só abre na Autentique.

  Contrato antigo, de texto fixo (sem a cópia editável), continua na tela de
  revisão de antes: esta página manda pra lá.
*/
"use client";

import { use, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Braces, CalendarHeart, Check, ChevronDown, ExternalLink, FileText, Heart, Package, LayoutTemplate, LoaderCircle, MapPin, PenLine,
  PenTool, Plus, Search, Send, Table, Wallet, type LucideIcon,
} from "lucide-react";
import type { JSONContent } from "@tiptap/core";
import type { Editor } from "@tiptap/react";
import { EditorContrato } from "@/components/EditorContrato";
import { useConfirmar } from "@/components/ModalConfirmar";
import { ModalNovoModelo, type BaseModelo } from "@/components/ModalNovoModelo";
import { SeletorItens } from "@/components/SeletorItens";
import { alternarItem, type ItemEscolhido, type Produto } from "@/lib/produtos";
import { useVoltar } from "@/lib/voltar";
import type { Contrato } from "@/lib/ficha";
import { ERRO_SESSAO, api, avisoDeCota, rotaDaRevisaoAntiga, urlNoAutentique } from "@/lib/painel";
import { ROTULOS_CAMPO, jsonParaHtml } from "@/lib/contrato-editor";

const ESPERA_MS = 700;

/* Campos da lateral, agrupados como a ficha agrupa. Toda chave aqui existe em
   ROTULOS_CAMPO (é a mesma lista que o gerador de PDF sabe preencher). */
const GRUPOS_CAMPO: { titulo: string; icone: LucideIcon; campos: string[] }[] = [
  { titulo: "Casal", icone: Heart, campos: ["noivo", "cpf-noivo", "noiva", "cpf-noiva", "tel-noivo", "tel-noiva"] },
  { titulo: "Endereço", icone: MapPin, campos: ["endereco", "numero", "bairro", "cidade", "complemento", "estado", "cep"] },
  { titulo: "Evento", icone: CalendarHeart, campos: ["data-formatada", "local", "horario"] },
  { titulo: "Valores", icone: Wallet, campos: ["valor-total", "valor-entrada"] },
  { titulo: "Assinatura", icone: PenLine, campos: ["cidade-assinatura", "data-assinatura"] },
];

/* busca sem acento e sem caixa: "endereco" acha "Endereço" */
const semAcento = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

type ModeloResumo = { id: string; nome: string | null; ativo: boolean };

type LateralProps = {
  editor: Editor;
  fechar: () => void;
  modelos: ModeloResumo[] | null;
  modeloId: string | null;
  ocupado: boolean;
  aoEscolher: (id: string) => void;
  aoCriar: (nome: string, base: BaseModelo) => Promise<boolean>;
  /* pacote e valores do casal */
  valores: Parameters<typeof SeletorItens>[0];
};

/* Cartão flutuante da lateral: mesmo cabeçalho da ficha (ícone em quadrado
   accent-tint + título + uma linha), ver brandbook "Painel lateral do editor". */
function CartaoLateral({ chave, icone: Icone, titulo, texto, children }: {
  chave: string; icone: LucideIcon; titulo: string; texto: string; children: ReactNode;
}) {
  /* colapsável; quem fechou o quê fica lembrado neste navegador (preferência
     de quem usa, não dado do contrato) */
  const [aberto, setAberto] = useState(() => {
    try { return localStorage.getItem("lateral-contrato:" + chave) !== "0"; } catch { return true; }
  });
  function alternar() {
    setAberto((v) => {
      try { localStorage.setItem("lateral-contrato:" + chave, v ? "0" : "1"); } catch { /* sem storage: só não lembra */ }
      return !v;
    });
  }
  return (
    /* sem sombra: o fundo da lateral (#ECEEF1) já separa o cartão branco */
    <section className="rounded-[20px] bg-paper p-4">
      <button type="button" onClick={alternar} aria-expanded={aberto}
        className="flex w-full cursor-pointer items-center gap-2.5 text-left">
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[13px] bg-accent-tint text-accent">
          <Icone size={17} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[14px] font-semibold leading-tight text-ink">{titulo}</span>
          <span className="mt-0.5 block truncate text-[12px] leading-snug text-ink-soft">{texto}</span>
        </span>
        <ChevronDown size={16} className={"shrink-0 text-ink-soft transition-[rotate] duration-300 " + (aberto ? "rotate-180" : "")} />
      </button>
      <div inert={!aberto}
        className={"grid transition-[grid-template-rows,opacity] duration-300 ease-[var(--ease-desliza)] " +
          (aberto ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0")}>
        <div className="min-h-0 overflow-hidden">{children}</div>
      </div>
    </section>
  );
}

/* Lateral exclusiva do contrato de um cliente (o editor de modelos não tem).
   Três cartões: o modelo do contrato (trocar ou criar), os campos do casal e
   os blocos. */
function LateralContrato({ editor, fechar, modelos, modeloId, ocupado, aoEscolher, aoCriar, valores }: LateralProps) {
  const [criando, setCriando] = useState(false);
  const [busca, setBusca] = useState("");
  /* o chip que acabou de entrar no texto fica verde por um instante */
  const [inserido, setInserido] = useState<string | null>(null);
  const timerInserido = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timerInserido.current) clearTimeout(timerInserido.current); }, []);

  function inserir(chave: string, conteudo: JSONContent) {
    editor.chain().focus().insertContent(conteudo).run();
    setInserido(chave);
    if (timerInserido.current) clearTimeout(timerInserido.current);
    timerInserido.current = setTimeout(() => setInserido(null), 900);
    fechar();
  }

  const [aberto, setAberto] = useState(false);
  const modeloAtual = modelos?.find((m) => m.id === modeloId) ?? null;

  const termo = semAcento(busca.trim());
  const grupos = GRUPOS_CAMPO
    .map((g) => ({ ...g, campos: termo ? g.campos.filter((c) => semAcento(ROTULOS_CAMPO[c]).includes(termo)) : g.campos }))
    .filter((g) => g.campos.length);

  const linha = "flex h-10 w-full cursor-pointer items-center gap-2.5 rounded-xl px-2.5 text-left text-[13px] transition-colors disabled:cursor-default";

  return (
    <div className="grid gap-3">
      <CartaoLateral chave="modelo" icone={FileText} titulo="Modelo do contrato" texto="Qual texto este contrato usa">
        {/* dropdown que abre DENTRO do cartão: o gatilho mostra o modelo atual
            e a lista expande empurrando o resto da lateral pra baixo */}
        <button type="button" aria-expanded={aberto} disabled={modelos === null} onClick={() => setAberto((v) => !v)}
          className="mt-3 flex h-11 w-full cursor-pointer items-center gap-2.5 rounded-xl bg-soft px-3 text-left text-[13px] transition-colors hover:bg-line disabled:cursor-default">
          <span className={"min-w-0 flex-1 truncate " + (modelos === null ? "text-ink-soft" : "font-semibold text-ink")}>
            {modelos === null ? "Carregando modelos…" : modeloAtual?.nome || (modeloId ? "Modelo apagado" : "Sem modelo")}
          </span>
          {modeloAtual?.ativo ? (
            <span className="shrink-0 rounded-[6px] bg-paper px-2 py-[3px] text-[10.5px] font-semibold tracking-[.03em] text-ink-soft">Padrão</span>
          ) : null}
          <ChevronDown size={16} className={"shrink-0 text-ink-soft transition-[rotate] duration-300 " + (aberto ? "rotate-180" : "")} />
        </button>

        <div inert={!aberto}
          className={"grid transition-[grid-template-rows,opacity] duration-300 ease-[var(--ease-desliza)] " +
            (aberto ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0")}>
          <div className="min-h-0 overflow-hidden">
            <div className="grid gap-0.5 pt-1.5">
              {(modelos || []).map((m) => {
                const atual = m.id === modeloId;
                return (
                  <button key={m.id} type="button" disabled={ocupado} aria-pressed={atual}
                    onClick={() => { setAberto(false); if (!atual) aoEscolher(m.id); }}
                    className={linha + " " + (atual ? "bg-accent-tint font-semibold text-accent" : "text-ink hover:bg-soft")}>
                    <span className={"inline-flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full transition-colors " +
                      (atual ? "bg-accent text-white" : "bg-line")}>
                      {atual ? <Check size={12} strokeWidth={3} /> : null}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{m.nome || "Sem nome"}</span>
                    {m.ativo ? (
                      <span className={"shrink-0 rounded-[6px] px-2 py-[3px] text-[10.5px] font-semibold tracking-[.03em] " +
                        (atual ? "bg-paper text-ink-soft" : "bg-soft text-ink-soft")}>Padrão</span>
                    ) : null}
                  </button>
                );
              })}

              {/* "Novo modelo" abre um pop-up (nome + de onde parte) */}
              <button type="button" disabled={ocupado} onClick={() => setCriando(true)}
                className={linha + " text-ink-soft hover:bg-soft hover:text-ink"}>
                <Plus size={18} className="shrink-0" /> Novo modelo
              </button>
            </div>
          </div>
        </div>
        <ModalNovoModelo aberto={criando} ocupado={ocupado} aoFechar={() => setCriando(false)}
          aoCriar={async (n, b) => { const ok = await aoCriar(n, b); if (ok) setAberto(false); return ok; }} />
      </CartaoLateral>

      <CartaoLateral chave="pacote" icone={Package} titulo="Pacote e valores" texto="O que o casal contratou">
        <SeletorItens {...valores} />
      </CartaoLateral>

      <CartaoLateral chave="campos" icone={Braces} titulo="Campos" texto="Clique pra inserir no texto">
        <label className="mt-3 flex h-9 items-center gap-2 rounded-[10px] bg-soft px-3 text-ink-soft">
          <Search size={15} className="shrink-0" />
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar campo" aria-label="Buscar campo"
            className="h-full min-w-0 flex-1 bg-transparent text-[13px] text-ink outline-none placeholder:text-ink-soft/70" />
        </label>
        {grupos.length ? grupos.map((g) => (
          <div key={g.titulo} className="mt-3.5">
            <div className="flex items-center gap-1.5 text-[11.5px] font-semibold text-ink-soft">
              <g.icone size={13} /> {g.titulo}
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {g.campos.map((c) => {
                const ok = inserido === c;
                return (
                  <button key={c} type="button" onClick={() => inserir(c, { type: "campo", attrs: { campo: c } })}
                    className={"inline-flex cursor-pointer items-center gap-1 rounded-[7px] px-[9px] py-[5px] text-[12.5px] font-medium transition-[translate,scale,background-color,box-shadow,color] duration-150 hover:-translate-y-px hover:shadow-card active:scale-[.97] " +
                      (ok ? "bg-ok-tint text-ok" : "bg-campo text-accent hover:bg-campo-hover")}>
                    {ok ? <><Check size={13} strokeWidth={2.5} /> Inserido</> : ROTULOS_CAMPO[c]}
                  </button>
                );
              })}
            </div>
          </div>
        )) : (
          <p className="m-0 mt-3 text-[12.5px] text-ink-soft">Nenhum campo com esse nome.</p>
        )}
      </CartaoLateral>

      <CartaoLateral chave="blocos" icone={LayoutTemplate} titulo="Blocos" texto="Partes prontas">
        <div className="mt-3 grid grid-cols-2 gap-2">
          {([
            ["tabelaItens", Table, "Tabela de itens", "Pacote, adicionais e total"],
            ["blocoAssinaturas", PenTool, "Assinaturas", "Linhas pra assinar"],
          ] as const).map(([tipo, Icone, titulo, texto]) => {
            const ok = inserido === tipo;
            return (
              <button key={tipo} type="button" onClick={() => inserir(tipo, { type: tipo })}
                className={"flex cursor-pointer flex-col items-start gap-2 rounded-[14px] p-3 text-left transition-[background-color,scale] duration-150 active:scale-[.97] " +
                  (ok ? "bg-ok-tint" : "bg-soft hover:bg-accent-tint")}>
                <span className={ok ? "text-ok" : "text-accent"}>{ok ? <Check size={18} /> : <Icone size={18} />}</span>
                <span>
                  <span className="block text-[12.5px] font-semibold text-ink">{ok ? "Inserido" : titulo}</span>
                  <span className="mt-0.5 block text-[11.5px] leading-snug text-ink-soft">{texto}</span>
                </span>
              </button>
            );
          })}
        </div>
      </CartaoLateral>
    </div>
  );
}

type Cliente = {
  id: string; noivo?: string | null; noiva?: string | null; email?: string | null; cidade?: string | null;
  itens?: ItemEscolhido[] | null; total?: number | string | null; entrada?: number | string | null;
};
type Resposta = { cliente: Cliente; contrato: Contrato | null };
type RespostaEnvio = {
  link?: string | null; mensagem?: string; telefone?: string;
  alterado?: boolean; linkNovo?: boolean; assinado?: boolean;
};
type Estado = { texto: string; tom?: "ok" | "erro" };

export default function EditorContratoDoCliente({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const confirmar = useConfirmar();

  const [carga, setCarga] = useState<Resposta | null>(null);
  const [erroCarga, setErroCarga] = useState("");
  const [estado, setEstado] = useState<Estado>({ texto: "" });
  /* tela de carregamento por cima de tudo enquanto a Autentique responde */
  const [enviando, setEnviando] = useState<false | "enviando" | "atualizando">(false);
  /* editado depois de ir pra Autentique (o servidor diz ao abrir; a tela
     marca sozinha a cada gravação, pra o botão mudar na hora) */
  const [alterado, setAlterado] = useState(false);
  /* modelos pra lateral; null = ainda carregando */
  const [modelos, setModelos] = useState<ModeloResumo[] | null>(null);
  const [modeloId, setModeloId] = useState<string | null>(null);
  const [trocando, setTrocando] = useState(false);
  /* pacote e valores (cartão da lateral); gravados no cliente, não no contrato */
  const [produtos, setProdutos] = useState<Produto[] | null>(null);
  const [itens, setItens] = useState<ItemEscolhido[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [entrada, setEntrada] = useState<number | null>(null);
  const valoresPendentes = useRef<{ itens: ItemEscolhido[]; total: number | null; entrada: number | null } | null>(null);
  const timerValores = useRef<ReturnType<typeof setTimeout> | null>(null);

  const pendente = useRef<{ json: JSONContent; html: string } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const salvando = useRef(false);
  const repetir = useRef(false);
  const temDocumento = useRef(false);

  /* ---------- carga ---------- */
  useEffect(() => {
    let vivo = true;
    api<Resposta>("/api/estudio?id=" + encodeURIComponent(id))
      .then((r) => {
        if (!vivo) return;
        const c = r.contrato;
        /* contrato antigo, de texto fixo: não tem o que editar aqui */
        if (c && !c.template_json_snapshot && c.status !== "cancelado") {
          router.replace(rotaDaRevisaoAntiga(id));
          return;
        }
        setCarga(r);
        setModeloId(c?.template_id ?? null);
        setItens(Array.isArray(r.cliente.itens)
          ? r.cliente.itens.map((i) => ({ id: String(i.id), nome: String(i.nome ?? ""), valor: Number(i.valor) || 0, ...(i.tipo ? { tipo: i.tipo } : {}) }))
          : []);
        setTotal(r.cliente.total != null && r.cliente.total !== "" ? Number(r.cliente.total) : null);
        setEntrada(r.cliente.entrada != null && r.cliente.entrada !== "" ? Number(r.cliente.entrada) : null);
        temDocumento.current = !!c?.autentique_id;
        setAlterado(!!c?.alterado_desde_envio);
      })
      .catch((e: Error) => {
        if (e.message === ERRO_SESSAO) { router.replace("/entrar"); return; }
        setErroCarga("Não consegui abrir este contrato.");
      });
    return () => { vivo = false; };
  }, [id, router]);

  /* ---------- modelos ---------- */
  const carregarModelos = useCallback(
    () => api<{ modelos: ModeloResumo[] }>("/api/templates")
      .catch(() => null)
      .then((r) => setModelos(r?.modelos ?? [])),
    [],
  );
  useEffect(() => {
    let vivo = true;
    api<{ modelos: ModeloResumo[] }>("/api/templates")
      .catch(() => null)
      .then((r) => { if (vivo) setModelos(r?.modelos ?? []); });
    return () => { vivo = false; };
  }, []);

  useEffect(() => {
    let vivo = true;
    api<{ produtos: Produto[] }>("/api/produtos")
      .catch(() => null)
      .then((r) => { if (vivo) setProdutos(r?.produtos ?? []); });
    return () => { vivo = false; };
  }, []);

  /* ---------- pacote e valores ---------- */
  const salvarValores = useCallback(async () => {
    if (timerValores.current) { clearTimeout(timerValores.current); timerValores.current = null; }
    const v = valoresPendentes.current;
    if (!v) return;
    valoresPendentes.current = null;
    try {
      /* mesma ação da ficha: o servidor atualiza o snapshot do contrato junto */
      await api("/api/estudio", { acao: "atualizar", id, cliente: { itens: v.itens, total: v.total, entrada: v.entrada } });
      setEstado({ texto: "Todas as alterações foram salvas", tom: "ok" });
      if (temDocumento.current) setAlterado(true);
    } catch (e) {
      setEstado({ texto: (e as Error).message || "Não consegui salvar os valores.", tom: "erro" });
    }
  }, [id]);

  function mudarValores(novo: { itens: ItemEscolhido[]; total: number | null; entrada: number | null }) {
    setItens(novo.itens);
    setTotal(novo.total);
    setEntrada(novo.entrada);
    valoresPendentes.current = novo;
    setEstado({ texto: "Editando…" });
    if (timerValores.current) clearTimeout(timerValores.current);
    timerValores.current = setTimeout(() => { void salvarValores(); }, ESPERA_MS);
  }

  /* itens mudaram: total = soma e entrada = 30% (regra da ficha) */
  function comItens(novos: ItemEscolhido[]) {
    const soma = novos.reduce((s, i) => s + (Number(i.valor) || 0), 0);
    mudarValores(novos.length
      ? { itens: novos, total: soma, entrada: Math.round(soma * 30) / 100 }
      : { itens: novos, total, entrada });
  }

  /* ---------- salvamento automático (mesmo desenho do editor de modelos) ---------- */
  const salvarAgora = useCallback(async () => {
    if (salvando.current) { repetir.current = true; return; }
    salvando.current = true;
    do {
      repetir.current = false;
      const corpo = pendente.current;
      if (!corpo) break;
      setEstado({ texto: "Salvando…" });
      try {
        await api("/api/estudio", { acao: "salvar-texto-contrato", id, json: corpo.json, html: corpo.html });
        if (pendente.current === corpo) pendente.current = null;
        setEstado({ texto: "Todas as alterações foram salvas", tom: "ok" });
        /* contrato que já está na Autentique e mudou: o botão vira "Atualizar" */
        if (temDocumento.current) setAlterado(true);
      } catch (e) {
        setEstado({ texto: (e as Error).message || "Não consegui salvar.", tom: "erro" });
      }
    } while (repetir.current);
    salvando.current = false;
  }, [id]);

  const aoMudar = useCallback((json: JSONContent, html: string) => {
    pendente.current = { json, html };
    setEstado({ texto: "Editando…" });
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { void salvarAgora(); }, ESPERA_MS);
  }, [salvarAgora]);

  /* tudo que estiver pendente vai pro banco ANTES de sair ou de enviar: o PDF
     é montado no servidor a partir do que está gravado */
  const descarregar = useCallback(async () => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    await Promise.all([salvarAgora(), salvarValores()]);
  }, [salvarAgora, salvarValores]);

  const voltar = useVoltar("/painel/clientes/" + encodeURIComponent(id), descarregar);

  /* Sem e-mail do casal a Autentique não tem a quem amarrar o link. Pop-up
     com o caminho pronto: salva o que estiver pendente e leva pra ficha com
     o campo do e-mail aberto e focado. */
  async function pedirEmail() {
    const ok = await confirmar({
      titulo: "Falta o e-mail do casal",
      texto:
        "A Autentique amarra o link de assinatura ao e-mail de quem assina. Cadastre o e-mail na ficha " +
        "e volte aqui pra enviar. O texto do contrato fica salvo.",
      rotuloOk: "Cadastrar e-mail",
    });
    if (!ok) return;
    await descarregar();
    router.push("/painel/clientes/" + encodeURIComponent(id) + "?campo=email");
  }

  /* ---------- enviar / atualizar ---------- */
  async function enviar(atualizar: boolean) {
    if (!carga?.cliente.email?.trim()) { await pedirEmail(); return; }
    if (atualizar) {
      const aviso = await avisoDeCota(id);
      const ok = await confirmar({
        titulo: "Atualizar na Autentique?",
        texto:
          "A Autentique não deixa trocar o arquivo de um contrato já enviado, então o atual é apagado e um novo " +
          "é criado no lugar. O link do casal muda: mande o novo pra eles.",
        aviso,
        rotuloOk: "Atualizar",
      });
      if (!ok) return;
    }
    setEnviando(atualizar ? "atualizando" : "enviando");
    setEstado({ texto: "" });
    try {
      await descarregar();
      const j = await api<RespostaEnvio>("/api/estudio", { acao: "liberar-contrato-cliente", id, atualizar });
      /* deu certo: volta pra ficha, que abre o pop-up de compartilhar (link,
         WhatsApp, e-mail e "Ver contrato"). A tela de carregamento fica até
         a ficha montar, sem piscar o editor no meio. */
      router.push("/painel/clientes/" + encodeURIComponent(id) + "?enviado=" + (j.linkNovo ? "atualizado" : "1"));
      return;
    } catch (e) {
      setEnviando(false);
      if ((e as Error).message === ERRO_SESSAO) { router.replace("/entrar"); return; }
      /* o e-mail sumiu da ficha em outra aba depois que esta abriu */
      if (/e-mail do casal/.test((e as Error).message)) { setEstado({ texto: "" }); await pedirEmail(); return; }
      setEstado({ texto: (e as Error).message || "Não deu pra falar com a Autentique.", tom: "erro" });
    }
  }

  /* troca o texto pelo do modelo; o servidor grava e devolve o texto novo */
  async function trocarModelo(editor: Editor, modelo: string, perguntar: boolean): Promise<boolean> {
    if (perguntar) {
      const nomeModelo = modelos?.find((m) => m.id === modelo)?.nome || "este modelo";
      const ok = await confirmar({
        titulo: "Trocar o modelo do contrato?",
        texto:
          "O texto deste contrato vira o de \"" + nomeModelo + "\". O que você editou só aqui se perde. " +
          "Os dados do casal continuam vindo da ficha.",
        rotuloOk: "Trocar modelo",
      });
      if (!ok) return false;
    }
    setTrocando(true);
    try {
      await descarregar();
      const j = await api<{ json: JSONContent; alterado: boolean }>("/api/estudio", {
        acao: "trocar-modelo-contrato", id, modelo_id: modelo,
      });
      /* sem emitir update: o servidor já gravou, não precisa salvar de novo */
      if (perguntar) editor.commands.setContent(j.json, { emitUpdate: false });
      setModeloId(modelo);
      if (temDocumento.current) setAlterado(j.alterado);
      if (perguntar) setEstado({ texto: "Modelo trocado", tom: "ok" });
      return true;
    } catch (e) {
      if ((e as Error).message === ERRO_SESSAO) { router.replace("/entrar"); return false; }
      setEstado({ texto: (e as Error).message || "Não consegui trocar o modelo.", tom: "erro" });
      return false;
    } finally {
      setTrocando(false);
    }
  }

  /* Modelo novo. Com o texto deste contrato: passa a ser o modelo dele. Em
     branco: este contrato não muda (trocar apagaria o texto) e o modelo abre
     no editor de modelos, numa guia nova pra este editor seguir aberto. */
  async function criarModelo(editor: Editor, nome: string, base: BaseModelo): Promise<boolean> {
    /* a guia abre AGORA, ainda no clique: depois do await o navegador trata
       como pop-up e bloqueia */
    const guia = base === "branco" ? window.open("", "_blank") : null;
    setTrocando(true);
    try {
      const json: JSONContent = base === "branco" ? { type: "doc", content: [{ type: "paragraph" }] } : editor.getJSON();
      const criado = await api<{ modelo: { id: string } }>("/api/templates", { acao: "criar", nome });
      await api("/api/templates", { acao: "salvar", id: criado.modelo.id, conteudo_json: json, conteudo_html: jsonParaHtml(json) || "<p></p>" });
      await carregarModelos();
      if (base === "branco") {
        const rota = "/painel/configuracoes/contrato/" + encodeURIComponent(criado.modelo.id);
        if (guia) guia.location.href = rota; else window.open(rota, "_blank");
        setEstado({ texto: "Modelo \"" + nome + "\" criado e aberto no editor de modelos", tom: "ok" });
        return true;
      }
      const ok = await trocarModelo(editor, criado.modelo.id, false);
      if (ok) setEstado({ texto: "Modelo \"" + nome + "\" criado", tom: "ok" });
      return ok;
    } catch (e) {
      guia?.close();
      if ((e as Error).message === ERRO_SESSAO) { router.replace("/entrar"); return false; }
      setEstado({ texto: (e as Error).message || "Não consegui criar o modelo.", tom: "erro" });
      return false;
    } finally {
      setTrocando(false);
    }
  }

  /* o que a folha desenha na tabela de itens e nas assinaturas: a ficha +
     o pacote e o total que a lateral está mexendo agora */
  /* total digitado na tabela da folha = o total da lateral (entrada 30%) */
  const mudarTotalPelaFolha = useRef<(t: number | null) => void>(() => {});
  useEffect(() => {
    mudarTotalPelaFolha.current = (t) =>
      mudarValores({ itens, total: t, entrada: t != null ? Math.round(t * 30) / 100 : entrada });
  });
  const dadosFolha = useMemo(() => (carga ? {
    noivo: carga.cliente.noivo, noiva: carga.cliente.noiva, cidade: carga.cliente.cidade, itens, total,
    aoMudarTotal: (t: number | null) => mudarTotalPelaFolha.current(t),
  } : null), [carga, itens, total]);

  /* ---------- telas de estado ---------- */
  if (erroCarga) return <p className="px-5 pt-6 text-[13px] text-erro">{erroCarga}</p>;
  if (!carga) return <p className="px-5 pt-6 text-[13px] text-ink-soft">Abrindo…</p>;

  const contrato = carga.contrato;
  const casal = [carga.cliente.noivo, carga.cliente.noiva].filter(Boolean).join(" e ");
  const assinado = contrato?.status === "assinado";

  if (!contrato || contrato.status === "cancelado") {
    return (
      <div className="px-5 pt-6">
        <p className="m-0 text-[14px] text-ink-soft">Este cliente ainda não tem contrato. Gere o rascunho pela ficha.</p>
        <button type="button" onClick={() => router.push("/painel/clientes/" + encodeURIComponent(id))}
          className="mt-3 cursor-pointer rounded-xl bg-accent px-4 py-2.5 text-[13.5px] font-semibold text-white">
          Voltar pra ficha
        </button>
      </div>
    );
  }

  /* ---------- botão principal: o fluxo inteiro mora nele ---------- */
  const botao = assinado || (contrato.autentique_id && !alterado)
    ? (
      <a href={contrato.autentique_id ? urlNoAutentique(contrato.autentique_id) : "#"} target="_blank" rel="noreferrer"
        className="inline-flex h-10 shrink-0 items-center gap-2 rounded-xl bg-accent px-4 text-[13.5px] font-semibold text-white no-underline transition-colors hover:bg-accent-hover">
        <ExternalLink size={15} /> Abrir na Autentique
      </a>
    )
    : (
      <button type="button" disabled={!!enviando} onClick={() => void enviar(!!contrato.autentique_id)}
        className="inline-flex h-10 shrink-0 cursor-pointer items-center gap-2 rounded-xl bg-accent px-4 text-[13.5px] font-semibold text-white transition-colors hover:bg-accent-hover disabled:cursor-default disabled:opacity-50">
        <Send size={15} /> {contrato.autentique_id ? "Atualizar na Autentique" : "Assinar e enviar"}
      </button>
    );

  const topo = (
    <div className="pt-2">
      <div className="flex flex-wrap items-start gap-x-3 gap-y-2">
        <button type="button" onClick={() => { void voltar(); }} aria-label="Voltar pra ficha"
          className="mt-1 inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg text-ink-soft transition-colors hover:bg-line hover:text-accent">
          <ArrowLeft size={18} />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="m-0 truncate text-[20px] font-bold text-ink md:text-[22px]">
            Contrato{casal ? " · " + casal : ""}
          </h1>
          <p className={"m-0 text-[12.5px] " + (estado.tom === "ok" ? "text-ok" : estado.tom === "erro" ? "text-erro" : "text-ink-soft")}>
            {estado.texto || (assinado
              ? "Assinado pelos dois. A via oficial está na Autentique."
              : contrato.autentique_id
                ? (alterado ? "Você editou depois de enviar. Atualize pra o casal ver a versão nova." : "Enviado. Esperando a assinatura do casal.")
                : "Rascunho. Edite o texto e insira os campos pela lateral. Os dados vêm da ficha do cliente.")}
          </p>
        </div>
        {botao}
      </div>

    </div>
  );

  /* assinado: o texto não é mais nosso pra mexer; mostra só o cabeçalho */
  if (assinado) {
    return <div className="mx-auto max-w-[900px] px-5 pb-10">{topo}</div>;
  }

  return (
    <>
    {enviando ? <CarregandoAutentique atualizando={enviando === "atualizando"} /> : null}
    <EditorContrato
      conteudoInicial={(contrato.template_json_snapshot as JSONContent) ?? null}
      aoMudar={aoMudar}
      topo={topo}
      dados={dadosFolha}
      lateral={(editor, fechar) => (
        <LateralContrato editor={editor} fechar={fechar} modelos={modelos} modeloId={modeloId} ocupado={trocando || !!enviando}
          aoEscolher={(m) => { void trocarModelo(editor, m, true).then((ok) => { if (ok) fechar(); }); }}
          aoCriar={(nome, base) => criarModelo(editor, nome, base)}
          valores={{
            produtos, itens, total, entrada, travado: !!enviando,
            aoAlternar: (p) => comItens(alternarItem(itens, p, produtos || [])),
            aoTotal: (t) => mudarValores({ itens, total: t, entrada: t != null ? Math.round(t * 30) / 100 : entrada }),
            aoEntrada: (e) => mudarValores({ itens, total, entrada: e }),
          }} />
      )}
    />
    </>
  );
}

/* Tela de carregamento do envio. Não finge etapas: o servidor faz tudo num
   pedido só (PDF, upload, assinatura do fotógrafo), então diz o que está
   acontecendo e quanto costuma levar. */
function CarregandoAutentique({ atualizando }: { atualizando: boolean }) {
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-[rgba(246,247,249,.82)] p-5 backdrop-blur-[3px]"
      role="status" aria-live="polite">
      <div className="flex w-full max-w-[360px] flex-col items-center rounded-[18px] bg-paper px-8 py-9 text-center shadow-alta">
        <span className="relative inline-flex h-14 w-14 items-center justify-center rounded-[18px] bg-accent-tint text-accent">
          <LoaderCircle size={26} className="animate-spin" />
        </span>
        <h2 className="m-0 mt-5 text-[19px] font-semibold text-ink">
          {atualizando ? "Atualizando na Autentique" : "Enviando pra Autentique"}
        </h2>
        <p className="m-0 mt-2 text-[14px] leading-[1.55] text-ink-soft">
          Montando o PDF, subindo o contrato e assinando por você. Costuma levar alguns segundos.
        </p>
      </div>
    </div>
  );
}

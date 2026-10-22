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

import { use, useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, Copy, ExternalLink, MessageCircle, PenTool, Plus, Send, Table } from "lucide-react";
import type { JSONContent } from "@tiptap/core";
import type { Editor } from "@tiptap/react";
import { EditorContrato } from "@/components/EditorContrato";
import { useConfirmar } from "@/components/ModalConfirmar";
import { useVoltar } from "@/lib/voltar";
import { copiarTexto, type Contrato } from "@/lib/ficha";
import { ERRO_SESSAO, api, rotaDaRevisaoAntiga, urlNoAutentique } from "@/lib/painel";
import { ROTULOS_CAMPO, jsonParaHtml } from "@/lib/contrato-editor";

const ESPERA_MS = 700;

/* Campos da lateral, agrupados como a ficha agrupa. Toda chave aqui existe em
   ROTULOS_CAMPO (é a mesma lista que o gerador de PDF sabe preencher). */
const GRUPOS_CAMPO: { titulo: string; campos: string[] }[] = [
  { titulo: "Casal", campos: ["noivo", "cpf-noivo", "noiva", "cpf-noiva", "tel-noivo", "tel-noiva"] },
  { titulo: "Endereço", campos: ["endereco", "numero", "bairro", "cidade", "complemento", "estado", "cep"] },
  { titulo: "Evento", campos: ["data-formatada", "local", "horario"] },
  { titulo: "Valores", campos: ["valor-total", "valor-entrada"] },
  { titulo: "Assinatura", campos: ["cidade-assinatura", "data-assinatura"] },
];

type ModeloResumo = { id: string; nome: string | null; ativo: boolean };

type LateralProps = {
  editor: Editor;
  fechar: () => void;
  modelos: ModeloResumo[] | null;
  modeloId: string | null;
  ocupado: boolean;
  aoEscolher: (id: string) => void;
  aoCriar: (nome: string) => Promise<boolean>;
};

/* Lateral exclusiva do contrato de um cliente (o editor de modelos não tem).
   Em cima, o modelo do contrato (trocar ou criar um); embaixo, os campos e
   blocos que antes ficavam escondidos no "+". */
function LateralContrato({ editor, fechar, modelos, modeloId, ocupado, aoEscolher, aoCriar }: LateralProps) {
  const inserir = (conteudo: JSONContent) => { editor.chain().focus().insertContent(conteudo).run(); fechar(); };
  const item = "flex w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 py-[7px] text-left text-[13px] text-ink transition-colors hover:bg-line";
  const [criando, setCriando] = useState(false);
  const [nome, setNome] = useState("");

  async function criar() {
    const n = nome.trim();
    if (!n || ocupado) return;
    if (await aoCriar(n)) { setCriando(false); setNome(""); }
  }

  return (
    <div>
      <h2 className="m-0 text-[15px] font-bold text-ink">Modelo do contrato</h2>
      <p className="m-0 mt-1 text-[12.5px] leading-snug text-ink-soft">Trocar o modelo substitui o texto deste contrato.</p>
      <div className="mt-2">
        {modelos === null ? (
          <p className="m-0 px-2.5 py-[7px] text-[13px] text-ink-soft">Carregando modelos…</p>
        ) : modelos.map((m) => {
          const atual = m.id === modeloId;
          return (
            <button key={m.id} type="button" disabled={ocupado} aria-pressed={atual}
              onClick={() => { if (!atual) aoEscolher(m.id); }}
              className={item + " disabled:cursor-default " + (atual ? "bg-accent-tint font-semibold text-accent hover:bg-accent-tint" : "")}>
              <span className="min-w-0 flex-1 truncate">{m.nome || "Sem nome"}</span>
              {m.ativo ? <span className="shrink-0 text-[11.5px] font-normal text-ink-soft">padrão</span> : null}
              {atual ? <Check size={15} className="shrink-0" /> : null}
            </button>
          );
        })}
        {criando ? (
          <form className="mt-1 rounded-lg bg-paper p-2" onSubmit={(e) => { e.preventDefault(); void criar(); }}>
            <input autoFocus value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Contrato de ensaio" aria-label="Nome do modelo novo"
              className="h-9 w-full rounded-lg bg-soft px-2.5 text-[13px] text-ink outline-none placeholder:text-ink-soft focus:bg-line" />
            <p className="m-0 mt-1.5 text-[11.5px] leading-snug text-ink-soft">Nasce com o texto deste contrato.</p>
            <div className="mt-2 flex gap-1.5">
              <button type="submit" disabled={!nome.trim() || ocupado}
                className="h-8 flex-1 cursor-pointer rounded-lg bg-accent text-[12.5px] font-semibold text-white transition-colors hover:bg-accent-hover disabled:cursor-default disabled:opacity-50">
                Criar modelo
              </button>
              <button type="button" onClick={() => { setCriando(false); setNome(""); }}
                className="h-8 cursor-pointer rounded-lg px-3 text-[12.5px] text-ink-soft transition-colors hover:bg-soft hover:text-ink">
                Cancelar
              </button>
            </div>
          </form>
        ) : (
          <button type="button" disabled={ocupado} onClick={() => setCriando(true)} className={item + " text-ink-soft disabled:cursor-default"}>
            <Plus size={15} /> Novo modelo
          </button>
        )}
      </div>

      <h2 className="m-0 mt-6 text-[15px] font-bold text-ink">Inserir no contrato</h2>
      <p className="m-0 mt-1 text-[12.5px] leading-snug text-ink-soft">Clique pra pôr no lugar do cursor. O valor vem da ficha do cliente.</p>
      {GRUPOS_CAMPO.map((g) => (
        <section key={g.titulo} className="mt-4">
          <h3 className="m-0 mb-1 px-2.5 text-[12.5px] font-semibold text-ink-soft">{g.titulo}</h3>
          {g.campos.map((nome) => (
            <button key={nome} type="button" className={item} onClick={() => inserir({ type: "campo", attrs: { campo: nome } })}>
              {ROTULOS_CAMPO[nome]}
            </button>
          ))}
        </section>
      ))}
      <section className="mt-4">
        <h3 className="m-0 mb-1 px-2.5 text-[12.5px] font-semibold text-ink-soft">Blocos</h3>
        <button type="button" className={item} onClick={() => inserir({ type: "tabelaItens" })}>
          <Table size={15} className="text-ink-soft" /> Tabela de itens
        </button>
        <button type="button" className={item} onClick={() => inserir({ type: "blocoAssinaturas" })}>
          <PenTool size={15} className="text-ink-soft" /> Bloco de assinaturas
        </button>
      </section>
    </div>
  );
}

type Cliente = { id: string; noivo?: string | null; noiva?: string | null; email?: string | null };
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
  const [enviando, setEnviando] = useState(false);
  /* o que a Autentique devolveu: link do casal e a mensagem pronta */
  const [envio, setEnvio] = useState<RespostaEnvio | null>(null);
  /* editado depois de ir pra Autentique (o servidor diz ao abrir; a tela
     marca sozinha a cada gravação, pra o botão mudar na hora) */
  const [alterado, setAlterado] = useState(false);
  /* modelos pra lateral; null = ainda carregando */
  const [modelos, setModelos] = useState<ModeloResumo[] | null>(null);
  const [modeloId, setModeloId] = useState<string | null>(null);
  const [trocando, setTrocando] = useState(false);

  const pendente = useRef<{ json: JSONContent; html: string } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const salvando = useRef(false);
  const repetir = useRef(false);
  const temDocumento = useRef(false);

  /* ---------- carga ---------- */
  useEffect(() => {
    let vivo = true;
    api<Resposta>("/api/estudio?id=" + encodeURIComponent(id))
      .then(async (r) => {
        if (!vivo) return;
        const c = r.contrato;
        /* contrato antigo, de texto fixo: não tem o que editar aqui */
        if (c && !c.template_json_snapshot && c.status !== "cancelado") {
          router.replace(rotaDaRevisaoAntiga(id));
          return;
        }
        setCarga(r);
        setModeloId(c?.template_id ?? null);
        temDocumento.current = !!c?.autentique_id;
        setAlterado(!!c?.alterado_desde_envio);
        /* já foi pra Autentique: mostra o link do casal desde a abertura */
        if (c?.autentique_id) {
          const j = await api<RespostaEnvio>("/api/estudio", { acao: "liberar-contrato-cliente", id, apenasLink: true })
            .catch(() => null);
          if (vivo && j?.link) setEnvio(j);
        }
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
    await salvarAgora();
  }, [salvarAgora]);

  const voltar = useVoltar("/painel/clientes/" + encodeURIComponent(id), descarregar);

  /* ---------- enviar / atualizar ---------- */
  async function enviar(atualizar: boolean) {
    if (atualizar) {
      const ok = await confirmar({
        titulo: "Atualizar na Autentique?",
        texto:
          "A Autentique não deixa trocar o arquivo de um contrato já enviado, então o atual é apagado e um novo " +
          "é criado no lugar. O link do casal muda: mande o novo pra eles. Cada atualização usa 1 dos 10 " +
          "documentos do mês do plano gratuito.",
        rotuloOk: "Atualizar",
      });
      if (!ok) return;
    }
    setEnviando(true);
    setEstado({ texto: atualizar ? "Atualizando na Autentique…" : "Enviando pra Autentique…" });
    try {
      await descarregar();
      const j = await api<RespostaEnvio>("/api/estudio", { acao: "liberar-contrato-cliente", id, atualizar });
      setEnvio(j);
      temDocumento.current = true;
      setAlterado(!!j.alterado);
      setEstado({
        texto: j.linkNovo
          ? "Atualizado. O link do casal mudou: mande o novo."
          : "Assinado por você e enviado. Agora é com o casal.",
        tom: "ok",
      });
      /* a ficha e a Home leem o estado de novo na próxima visita */
      const r = await api<Resposta>("/api/estudio?id=" + encodeURIComponent(id)).catch(() => null);
      if (r) setCarga(r);
    } catch (e) {
      if ((e as Error).message === ERRO_SESSAO) { router.replace("/entrar"); return; }
      setEstado({ texto: (e as Error).message || "Não deu pra falar com a Autentique.", tom: "erro" });
    } finally {
      setEnviando(false);
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

  /* modelo novo com o texto deste contrato, que passa a ser o modelo dele */
  async function criarModelo(editor: Editor, nome: string): Promise<boolean> {
    setTrocando(true);
    try {
      const json = editor.getJSON();
      const criado = await api<{ modelo: { id: string } }>("/api/templates", { acao: "criar", nome });
      await api("/api/templates", { acao: "salvar", id: criado.modelo.id, conteudo_json: json, conteudo_html: jsonParaHtml(json) });
      await carregarModelos();
      const ok = await trocarModelo(editor, criado.modelo.id, false);
      if (ok) setEstado({ texto: "Modelo \"" + nome + "\" criado", tom: "ok" });
      return ok;
    } catch (e) {
      if ((e as Error).message === ERRO_SESSAO) { router.replace("/entrar"); return false; }
      setEstado({ texto: (e as Error).message || "Não consegui criar o modelo.", tom: "erro" });
      return false;
    } finally {
      setTrocando(false);
    }
  }

  async function copiar(texto: string, rotulo: string) {
    const ok = await copiarTexto(texto);
    setEstado({ texto: ok ? rotulo + " copiado" : "Não consegui copiar. Selecione e copie à mão.", tom: ok ? "ok" : "erro" });
  }

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
      <button type="button" disabled={enviando} onClick={() => void enviar(!!contrato.autentique_id)}
        className="inline-flex h-10 shrink-0 cursor-pointer items-center gap-2 rounded-xl bg-accent px-4 text-[13.5px] font-semibold text-white transition-colors hover:bg-accent-hover disabled:cursor-default disabled:opacity-50">
        <Send size={15} /> {contrato.autentique_id ? "Atualizar na Autentique" : "Assinar e enviar"}
      </button>
    );

  const whatsapp = envio?.telefone && envio.mensagem
    ? "https://wa.me/" + envio.telefone + "?text=" + encodeURIComponent(envio.mensagem)
    : null;

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

      {/* link do casal, depois de enviado: é por aqui que ele vai pro WhatsApp */}
      {envio?.link && !assinado ? (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl bg-soft px-3 py-2 text-[12.5px]">
          <span className="text-ink-soft">{envio.linkNovo ? "Link novo do casal:" : "Link do casal:"}</span>
          <span className="min-w-0 flex-1 truncate font-medium text-ink">{envio.link}</span>
          <button type="button" onClick={() => void copiar(envio.link as string, "Link")}
            className="inline-flex cursor-pointer items-center gap-1 rounded-lg px-2 py-1 text-ink-soft transition-colors hover:bg-line hover:text-accent">
            <Copy size={13} /> Copiar link
          </button>
          {envio.mensagem ? (
            <button type="button" onClick={() => void copiar(envio.mensagem as string, "Mensagem")}
              className="inline-flex cursor-pointer items-center gap-1 rounded-lg px-2 py-1 text-ink-soft transition-colors hover:bg-line hover:text-accent">
              <Copy size={13} /> Copiar mensagem
            </button>
          ) : null}
          {whatsapp ? (
            <a href={whatsapp} target="_blank" rel="noreferrer"
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-ink-soft no-underline transition-colors hover:bg-line hover:text-accent">
              <MessageCircle size={13} /> WhatsApp
            </a>
          ) : null}
        </div>
      ) : null}
    </div>
  );

  /* assinado: o texto não é mais nosso pra mexer; mostra só o cabeçalho */
  if (assinado) {
    return <div className="mx-auto max-w-[900px] px-5 pb-10">{topo}</div>;
  }

  return (
    <EditorContrato
      conteudoInicial={(contrato.template_json_snapshot as JSONContent) ?? null}
      aoMudar={aoMudar}
      topo={topo}
      lateral={(editor, fechar) => (
        <LateralContrato editor={editor} fechar={fechar} modelos={modelos} modeloId={modeloId} ocupado={trocando || enviando}
          aoEscolher={(m) => { void trocarModelo(editor, m, true).then((ok) => { if (ok) fechar(); }); }}
          aoCriar={(nome) => criarModelo(editor, nome)} />
      )}
    />
  );
}

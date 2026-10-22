/*
  Ficha do cliente. Portada da <div id="tela-detalhe"> do estudio.html, a maior
  tela do estúdio: dados do casal, evento, endereço, contrato (pacote,
  adicionais, valores, status da assinatura) e as ações de arquivar/excluir.
  A mesma tela cria cliente novo (id "novo").

  Comportamentos herdados, cada um custou tempo pra chegar:

  - "Digitou, salvou": autosave com 700ms de pausa. Sair do campo, trocar o
    select ou mexer no pacote grava na hora (são ações já terminadas). Três
    cuidados: não criar cliente fantasma (ficha nova só grava depois que existe
    um nome), não cruzar dois PATCH (quem chega no meio vira "salva de novo
    quando terminar") e não subir o mesmo conteúdo duas vezes (comparação com
    o último salvamento).
  - CPF e CEP: máscara ao digitar, formatado ao exibir, só dígitos ao salvar.
    Não é cosmético: o índice único do banco é (cpf_noivo, data_evento).
  - Pacote, adicionais, total e entrada NÃO se editam aqui desde 22/10/2026:
    a escolha mora no cartão "Pacote e valores" do editor do contrato, com as
    opções de Produtos e serviços. A ficha só mostra o resumo e nunca manda
    esses três campos no payload (senão uma ficha aberta noutra aba
    sobrescreveria o que foi escolhido no contrato).
  - Gerar contrato não exige ficha completa: a lista do que falta vai como
    aviso na confirmação, sem impedir.
  - autoComplete="off" em tudo: o navegador lia os rótulos (E-mail, CEP...),
    classificava o bloco como formulário de endereço e oferecia o perfil do
    FOTÓGRAFO pra preencher a ficha do casal.
*/
"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { CalendarHeart, ChevronDown, ClipboardList, Heart, MapPin, NotebookPen, Mail, Package } from "lucide-react";
import { Area, Aviso, Botao, BotaoVoltar, Campo, Estado } from "@/components/ui";
import { useConfirmar } from "@/components/ModalConfirmar";
import { useToast } from "@/components/Toast";
import { SecaoFicha } from "@/components/SecaoFicha";
import { CampoCopiavel } from "@/components/CampoCopiavel";
import { HeroCliente } from "@/components/HeroCliente";
import { TituloMobile } from "@/components/cabecalho-mobile";
import { ContratoVazio, TimelineContrato } from "@/components/TimelineContrato";
import { ModalLink, type DadosLink } from "@/components/ModalLink";
import { ModalContratoEnviado, type DadosEnviado } from "@/components/ModalContratoEnviado";
import { ModalTrocarEmail } from "@/components/ModalTrocarEmail";
import { abrirContratoEmNovaGuia, avisoDeCota, rotaDoContrato, urlNoAutentique } from "@/lib/painel";
import { exibirResposta, respostasDoCliente } from "@/lib/formulario";
import {
  CAMPOS_FICHA, FICHA_VAZIA, MASCARAS, SO_DIGITOS_AO_SALVAR,
  formatarMoeda, soDigitos, copiarTexto,
  type CampoFicha, type Cliente, type Contrato, type Ficha, type ItemContrato,
} from "@/lib/ficha";

const ESPERA_AUTOSAVE = 700;

const ORIGENS = ["Orçamento do site", "Instagram", "Indicação", "WhatsApp", "Google", "Outro"];

/* Campos que deixam o contrato incompleto quando faltam. Não bloqueiam nada:
   o fotógrafo gera com o que tem em mãos e a lista aparece como aviso. Noivo e
   noiva não entram: basta um dos dois, e a regra é sobre a pessoa (ver
   contratantesFaltando). CPF é opcional. */
const CAMPOS_CONTRATO: { campo: CampoFicha; rotulo: string }[] = [
  { campo: "email", rotulo: "E-mail do casal" },
  { campo: "cep", rotulo: "CEP" },
  { campo: "endereco", rotulo: "Endereço" },
  { campo: "numero", rotulo: "Número" },
  { campo: "bairro", rotulo: "Bairro" },
  { campo: "cidade", rotulo: "Cidade" },
  { campo: "estado", rotulo: "Estado" },
  { campo: "data_evento", rotulo: "Data do evento" },
  { campo: "local_evento", rotulo: "Local do evento" },
];

type Resposta = { cliente: Cliente; contrato: Contrato | null };
type Msg = { texto: string; tom?: "ok" | "erro" };

/** Erro que a rota devolve quando a sessão expirou: quem chama não mostra
 *  mensagem, a página inteira volta pra entrada (ver o efeito na página). */
const ERRO_SESSAO = "sessao";

async function api<T = unknown>(url: string, corpo?: unknown): Promise<T> {
  const r = await fetch(url, corpo
    ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(corpo) }
    : undefined);
  if (r.status === 401) throw new Error(ERRO_SESSAO);
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((j as { erro?: string }).erro ?? "falha");
  return j as T;
}

/* ---------- ficha ↔ cliente ---------- */

/** O banco guarda cru; a tela mostra formatado. */
function fichaDe(cliente: Cliente | null): Ficha {
  const f: Ficha = { ...FICHA_VAZIA };
  if (!cliente) return f;
  CAMPOS_FICHA.forEach((c) => {
    const v = cliente[c];
    f[c] = v == null ? "" : String(v);
    const mascara = MASCARAS[c];
    if (mascara) f[c] = mascara(f[c]);
  });
  /* total/entrada vêm crus (18600); exibe formatado (18.600,00) */
  if (cliente.total != null && cliente.total !== "") f.total = formatarMoeda(cliente.total);
  if (cliente.entrada != null && cliente.entrada !== "") f.entrada = formatarMoeda(cliente.entrada);
  return f;
}

/** Valor vem do que está gravado no cliente, NUNCA do catálogo: reabrir a
 *  ficha não pode apagar um preço negociado. O nome ainda vem do catálogo. */
function itensDe(cliente: Cliente | null): ItemContrato[] {
  if (!cliente || !Array.isArray(cliente.itens)) return [];
  return cliente.itens.map((i) => {
    return { id: i.id, nome: i.nome, valor: Number(i.valor) };
  });
}

/** Lê a ficha como o backend espera (só dígitos onde precisa). */
function montarCliente(ficha: Ficha): Record<string, unknown> {
  const cliente: Record<string, unknown> = { ...ficha };
  SO_DIGITOS_AO_SALVAR.forEach((k) => {
    if (ficha[k]) cliente[k] = soDigitos(ficha[k]);
  });
  /* pacote e valores são do editor do contrato (ver o cabeçalho) */
  delete cliente.total;
  delete cliente.entrada;
  return cliente;
}

/* ---------- validação do contrato ---------- */

/** O contrato aceita um contratante só. CPF pela metade é erro de digitação,
 *  não ausência, e sairia meio CPF impresso: continua apontado. */
function contratantesFaltando(f: Ficha): string[] {
  const pessoas = [
    { rotuloNome: "Nome do noivo", rotuloCpf: "CPF do noivo (incompleto)", nome: f.noivo.trim(), cpf: soDigitos(f.cpf_noivo) },
    { rotuloNome: "Nome da noiva", rotuloCpf: "CPF da noiva (incompleto)", nome: f.noiva.trim(), cpf: soDigitos(f.cpf_noiva) },
  ];
  if (pessoas.every((p) => !p.nome)) return ["Nome de pelo menos um contratante"];
  const faltas: string[] = [];
  pessoas.forEach((p) => {
    if (p.cpf && !p.nome) faltas.push(p.rotuloNome);
    if (p.cpf && p.cpf.length !== 11) faltas.push(p.rotuloCpf);
  });
  return faltas;
}

function camposFaltando(f: Ficha, itens: ItemContrato[]): string[] {
  const faltando = contratantesFaltando(f).concat(
    CAMPOS_CONTRATO.filter((c) => !f[c.campo].trim()).map((c) => c.rotulo),
  );
  if (!itens.length) faltando.push("Pelo menos um item do pacote/adicional");
  return faltando;
}

/* ---------- página ---------- */

export default function PaginaCliente() {
  const { id: idRota } = useParams<{ id: string }>();
  const ehNovo = idRota === "novo";
  const router = useRouter();
  /* `?campo=email`: quem chega mandado pra preencher um campo (hoje, o
     editor do contrato quando falta o e-mail pra Autentique) cai com a seção
     aberta e o cursor no campo */
  const parametros = useSearchParams();
  const campoAlvo = parametros.get("campo");
  /* `?enviado=1|atualizado`: o editor do contrato acabou de mandar pra
     Autentique e voltou pra cá; a ficha abre o pop-up de compartilhar */
  const enviadoAgora = parametros.get("enviado");
  const confirmar = useConfirmar();
  const { mostrar: avisar, elemento: toast } = useToast();

  const [clienteId, setClienteId] = useState<string | null>(ehNovo ? null : idRota);
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [contrato, setContrato] = useState<Contrato | null>(null);
  const [ficha, setFicha] = useState<Ficha>(FICHA_VAZIA);
  const [itens, setItens] = useState<ItemContrato[]>([]);
  const [carregando, setCarregando] = useState(!ehNovo);
  const [erroCarga, setErroCarga] = useState("");
  const [statusSalvo, setStatusSalvo] = useState<Msg>({ texto: "" });
  const [modalLink, setModalLink] = useState<DadosLink | null>(null);
  const [modalEnviado, setModalEnviado] = useState<DadosEnviado | null>(null);
  const [trocaEmail, setTrocaEmail] = useState<{ ocupado: boolean; erro: string } | null>(null);
  const enviadoTratado = useRef(false);
  const [ocupado, setOcupado] = useState(false);

  const travado = contrato?.status === "assinado";
  /* contrato na Autentique esperando o casal: o e-mail é o de quem assina lá,
     e muda pelo "Trocar e-mail e reenviar" (que troca lá também) */
  const emailNaAutentique = !!contrato?.autentique_id && (contrato.status === "enviado" || contrato.status === "visualizado");
  const contratoGerado = !!(contrato && contrato.status && contrato.status !== "cancelado");

  /* espelhos pra o autosave ler o estado mais recente de dentro de timers e
     promessas, sem depender do closure do render em que foram criados. São
     atualizados junto com o estado, nos handlers (nunca durante o render):
     toda escrita passa por atualizarFicha/aplicarItens/definirContrato. */
  const fichaRef = useRef<Ficha>(FICHA_VAZIA);
  const itensRef = useRef<ItemContrato[]>([]);
  const clienteIdRef = useRef<string | null>(ehNovo ? null : idRota);
  const travadoRef = useRef(false);
  const [sessaoExpirou, setSessaoExpirou] = useState(false);

  const carregadoId = useRef<string | null>(null);
  const ultimoSalvo = useRef<string | null>(null);
  const salvando = useRef(false);
  const refazerDepois = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ultimoCep = useRef("");

  /* sessão expirada em qualquer chamada: volta pra entrada uma vez só */
  useEffect(() => { if (sessaoExpirou) router.replace("/entrar"); }, [sessaoExpirou, router]);

  /** Trata o erro de uma chamada: sessão expirada redireciona, o resto vai pro `senao`. */
  const falhou = useCallback((e: unknown, senao: (msg: string) => void) => {
    const msg = (e as Error).message;
    if (msg === ERRO_SESSAO) setSessaoExpirou(true);
    else senao(msg);
  }, []);

  function atualizarFicha(mudanca: (f: Ficha) => Ficha) {
    const nova = mudanca(fichaRef.current);
    fichaRef.current = nova;
    setFicha(nova);
  }

  const definirContrato = useCallback((c: Contrato | null) => {
    travadoRef.current = c?.status === "assinado";
    setContrato(c);
  }, []);

  /* ---------- carga ---------- */

  const aplicarResposta = useCallback((r: Resposta) => {
    const f = fichaDe(r.cliente);
    const its = itensDe(r.cliente);
    setCliente(r.cliente);
    definirContrato(r.contrato ?? null);
    setFicha(f);
    setItens(its);
    fichaRef.current = f;
    itensRef.current = its;
    clienteIdRef.current = r.cliente.id;
    setClienteId(r.cliente.id);
    /* marco zero do autosave: "o que está na tela é o que está no banco" */
    ultimoSalvo.current = JSON.stringify(montarCliente(f));
    setStatusSalvo({ texto: "" });
  }, [definirContrato]);

  const carregar = useCallback(async (id: string) => {
    const r = await api<Resposta>("/api/estudio?id=" + encodeURIComponent(id));
    carregadoId.current = id;
    aplicarResposta(r);

    /* Pergunta à Autentique se o casal já viu ou assinou e, se mudou alguma
       coisa, recarrega a ficha. Vem DEPOIS da primeira carga de propósito: a
       ida até lá custa uma rede inteira, e segurar a tela por causa dela faria
       toda ficha abrir devagar por um estado que quase sempre é o mesmo.
       Sem chave configurada o servidor responde `sincronizado: false` e isto
       não faz nada. Enquanto o app não tiver endereço público pra receber
       webhook, este é o caminho por onde a novidade chega. */
    void api<{ sincronizado?: boolean; status?: string }>(
      "/api/estudio", { acao: "sincronizar-contrato", id },
    ).then((sinc) => {
      if (!sinc?.sincronizado) return;
      if (sinc.status && sinc.status === r.contrato?.status) return;
      return api<Resposta>("/api/estudio?id=" + encodeURIComponent(id)).then(aplicarResposta);
    }).catch(() => { /* rede fora: a ficha segue com o que já está na tela */ });
  }, [aplicarResposta]);

  useEffect(() => {
    if (ehNovo) {
      carregadoId.current = null;
      ultimoSalvo.current = JSON.stringify(montarCliente(FICHA_VAZIA));
      return;
    }
    /* a ficha nova que acabou de ser criada troca a URL pelo id real; nesse
       caso o conteúdo já está na tela e recarregar apagaria o que está sendo
       digitado */
    if (carregadoId.current === idRota) return;
    setCarregando(true);
    setErroCarga("");
    carregar(idRota)
      .catch((e: unknown) => falhou(e, () => setErroCarga("Não encontrei este cliente.")))
      .finally(() => setCarregando(false));
  }, [idRota, ehNovo, carregar, falhou]);

  useEffect(() => {
    if (carregando || campoAlvo !== "email") return;
    const el = document.getElementById("f-email");
    if (!el) return;
    el.scrollIntoView({ block: "center" });
    (el as HTMLInputElement).focus({ preventScroll: true });
    /* tira o ?campo da URL: recarregar a ficha não deve puxar o foco de novo */
    window.history.replaceState(null, "", window.location.pathname);
  }, [carregando, campoAlvo]);

  useEffect(() => {
    if (carregando || !enviadoAgora || enviadoTratado.current) return;
    const id = clienteIdRef.current;
    const autentiqueId = contrato?.autentique_id;
    if (!id || !autentiqueId) return;
    enviadoTratado.current = true;
    window.history.replaceState(null, "", window.location.pathname);
    /* apenasLink: só lê o link de um documento que já existe, nunca envia */
    api<{ link: string | null; mensagem?: string }>(
      "/api/estudio", { acao: "liberar-contrato-cliente", id, apenasLink: true },
    ).then((r) => {
      if (!r.link) return;
      setModalEnviado({
        link: r.link,
        mensagem: r.mensagem || r.link,
        urlContrato: urlNoAutentique(autentiqueId),
        atualizado: enviadoAgora === "atualizado",
      });
    }).catch((e: unknown) => falhou(e, (msg) => avisar(msg)));
  }, [carregando, enviadoAgora, contrato, falhou, avisar]);

  /* O pacote e os valores mudam no editor do contrato, que abre noutra
     guia. Voltando pra cá, relê só esses três do banco, sem mexer no que
     está sendo digitado na ficha. */
  useEffect(() => {
    if (ehNovo) return;
    function aoVoltar() {
      const id = clienteIdRef.current;
      if (document.visibilityState !== "visible" || !id) return;
      api<Resposta>("/api/estudio?id=" + encodeURIComponent(id)).then((r) => {
        const its = itensDe(r.cliente);
        setItens(its);
        itensRef.current = its;
        const f = fichaDe(r.cliente);
        atualizarFicha((atual) => ({ ...atual, total: f.total, entrada: f.entrada }));
        definirContrato(r.contrato ?? null);
      }).catch(() => { /* rede fora: fica o resumo de antes */ });
    }
    document.addEventListener("visibilitychange", aoVoltar);
    return () => document.removeEventListener("visibilitychange", aoVoltar);
  }, [ehNovo, definirContrato]);

  /* ---------- salvamento ---------- */

  /** Cria ou atualiza; devolve o id (o novo, quando acabou de nascer). */
  const salvarCliente = useCallback(async (payload: Record<string, unknown>): Promise<string | null> => {
    const id = clienteIdRef.current;
    if (id) {
      await api("/api/estudio", { acao: "atualizar", id, cliente: payload });
      return id;
    }
    const r = await api<{ cliente?: Cliente }>("/api/estudio", { acao: "criar", cliente: payload });
    if (!r.cliente) return null;
    clienteIdRef.current = r.cliente.id;
    carregadoId.current = r.cliente.id;
    setClienteId(r.cliente.id);
    setCliente(r.cliente);
    /* a ficha nasceu no meio da digitação: um F5 em /novo abriria outra ficha
       vazia em vez do cliente que acabou de existir. replaceState porque não
       é uma navegação nova. */
    window.history.replaceState(null, "", "/painel/clientes/" + encodeURIComponent(r.cliente.id));
    return r.cliente.id;
  }, []);

  const salvarAgoraRef = useRef<() => Promise<void>>(async () => {});

  const salvarAgora = useCallback(async () => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    const f = fichaRef.current;
    /* ficha nova ainda sem dono: espera um nome antes de existir no banco */
    if (!clienteIdRef.current && !(f.noivo.trim() || f.noiva.trim())) return;
    if (salvando.current) { refazerDepois.current = true; return; }
    const payload = montarCliente(f);
    const agora = JSON.stringify(payload);
    if (agora === ultimoSalvo.current) return;
    salvando.current = true;
    setStatusSalvo({ texto: "Salvando…" });
    try {
      await salvarCliente(payload);
      ultimoSalvo.current = agora;
      setStatusSalvo({ texto: "Salvo", tom: "ok" });
      avisar("Salvo", { ok: true, ms: 900 });
    } catch (e) {
      falhou(e, (msg) => setStatusSalvo({ texto: "Não salvou: " + msg, tom: "erro" }));
    } finally {
      salvando.current = false;
      if (refazerDepois.current) { refazerDepois.current = false; void salvarAgoraRef.current(); }
    }
  }, [salvarCliente, avisar, falhou]);
  useEffect(() => { salvarAgoraRef.current = salvarAgora; }, [salvarAgora]);

  function agendarSalvamento() {
    setStatusSalvo({ texto: "" });
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void salvarAgoraRef.current(), ESPERA_AUTOSAVE);
  }

  /** Ação já terminada (sair do campo, select, pacote): grava na hora. O
   *  setTimeout(0) deixa o estado do render atual chegar nos espelhos antes. */
  function salvarLogo() {
    setTimeout(() => void salvarAgoraRef.current(), 0);
  }

  /* sair da ficha (ou trocar de aba) não pode levar embora o que ainda estava no timer */
  useEffect(() => {
    function flush() { if (timer.current) void salvarAgoraRef.current(); }
    function visibilidade() { if (document.visibilityState === "hidden") flush(); }
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", visibilidade);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", visibilidade);
      flush();
    };
  }, []);

  /* ---------- campos ---------- */

  function mudarCampo(campo: CampoFicha, valor: string) {
    const mascara = MASCARAS[campo];
    const v = mascara ? mascara(valor) : valor;
    atualizarFicha((f) => ({ ...f, [campo]: v }));
    agendarSalvamento();
    if (campo === "cep") void buscarCep(v);
  }

  /* ViaCEP (gratuito, sem chave) preenche o endereço. Só dispara ao DIGITAR:
     abrir uma ficha não gera requisição. */
  async function buscarCep(valor: string) {
    const cep = soDigitos(valor);
    if (cep.length !== 8 || cep === ultimoCep.current) return;
    ultimoCep.current = cep;
    try {
      const j = await (await fetch("https://viacep.com.br/ws/" + cep + "/json/")).json() as {
        erro?: boolean; logradouro?: string; bairro?: string; localidade?: string; uf?: string;
      };
      if (j.erro) return;
      atualizarFicha((f) => ({
        ...f,
        endereco: f.endereco || (j.logradouro ?? ""),
        bairro: j.bairro ?? "",
        cidade: j.localidade ?? "",
        estado: j.uf ?? "",
      }));
      agendarSalvamento();
    } catch { /* sem rede ou CEP fora do ar: o fotógrafo digita à mão */ }
  }

  /* ---------- contrato ---------- */

  /* guia nova: o contrato é documento, e quem abre quase sempre quer conferir
     sem perder a ficha que estava preenchendo */
  function abrirContrato() {
    if (!clienteIdRef.current) return;
    /* já foi pra Autentique? abre lá, que é onde o casal assina e todo mundo
       baixa. Ainda é rascunho? abre a nossa revisão, que é onde se edita. */
    abrirContratoEmNovaGuia(clienteIdRef.current, contrato?.autentique_id);
  }

  /* o editor do contrato, mesmo com ele já na Autentique (é por lá que se
     edita e se manda a versão nova) */
  /* Contrato que já foi pra Autentique já tem a assinatura do fotógrafo.
     Editar pode, mas o casal só vê a versão nova depois de reenviar, e
     reenviar é documento novo (gasta cota): o pop-up diz isso e quanto
     sobra, antes de abrir o editor. O editor abre o texto DESTE contrato,
     com o modelo que ele usou, nunca o padrão. */
  async function editarContrato() {
    const id = clienteIdRef.current;
    if (!id) return;
    if (contrato?.autentique_id && contrato.status !== "assinado") {
      const aviso = await avisoDeCota(id);
      const ok = await confirmar({
        titulo: "Já assinado por você",
        texto:
          "Este contrato já está na Autentique com a sua assinatura" +
          (contrato.visualizado_em ? ", e o casal já abriu" : "") + ". " +
          "Dá pra editar, mas o casal só vê a versão nova depois que você reenviar: a Autentique cria um " +
          "documento novo e o link muda.",
        aviso,
        rotuloOk: "Editar mesmo assim",
      });
      if (!ok) return;
    }
    window.open(rotaDoContrato(id), "_blank");
  }

  async function acaoDoContrato() {
    if (!clienteIdRef.current) return;
    /* com contrato na mão, abre direto a revisão, sem confirmação nem validação */
    if (contratoGerado) { abrirContrato(); return; }

    const faltando = camposFaltando(fichaRef.current, itensRef.current);
    let texto = "Abre o contrato pra você revisar. Fica salvo como rascunho, ainda editável, e o casal só vê depois que você clicar em Copiar link.";
    if (faltando.length) texto += "\n\nO contrato vai sair sem: " + faltando.join(", ") + ".";

    const ok = await confirmar({ titulo: "Abrir contrato pra revisar?", texto, rotuloOk: "Abrir" });
    if (!ok) return;

    setOcupado(true);
    try {
      const payload = montarCliente(fichaRef.current);
      await salvarCliente(payload);
      ultimoSalvo.current = JSON.stringify(payload);
      await api("/api/estudio", { acao: "gerar-contrato", id: clienteIdRef.current });
      abrirContrato();
    } catch (e) {
      falhou(e, (msg) => avisar(msg));
    } finally {
      setOcupado(false);
    }
  }

  /* "Copiar link": libera o contrato, deixa a mensagem no clipboard e abre o
     pop-up. O ClipboardItem com Promise é o pulo do gato: o Safari do iOS
     exige que a escrita COMECE dentro do gesto, mas o texto só existe depois
     do fetch; criando o item já no clique, ele aceita o texto chegando depois. */
  async function copiarLink() {
    const id = clienteIdRef.current;
    if (!id) return;
    /* estado ANTES da chamada: se era rascunho, este clique é a primeira
       liberação de verdade e o modal avisa; senão é só re-cópia */
    const eraRascunho = contrato?.status === "rascunho";
    const pedido = api<{ link: string; mensagem?: string; assinado?: boolean }>(
      "/api/estudio", { acao: "liberar-contrato-cliente", id },
    );

    let copiando: Promise<boolean> = Promise.resolve(false);
    if (navigator.clipboard?.write && typeof ClipboardItem !== "undefined") {
      const blob = pedido.then((r) => new Blob([r.mensagem || r.link], { type: "text/plain" }));
      copiando = navigator.clipboard.write([new ClipboardItem({ "text/plain": blob })]).then(() => true, () => false);
    }

    try {
      const [r, copiouNoGesto] = await Promise.all([pedido, copiando]);
      const copiou = copiouNoGesto || await copiarTexto(r.mensagem || r.link);
      setModalLink({
        link: r.link,
        mensagem: r.mensagem || r.link,
        assinado: !!r.assinado,
        primeiraLiberacao: eraRascunho,
        jaCopiou: copiou,
      });
      /* recarrega cliente+contrato pra timeline refletir o estado real */
      const r2 = await api<Resposta>("/api/estudio?id=" + encodeURIComponent(id));
      definirContrato(r2.contrato ?? null);
      setCliente(r2.cliente);
    } catch (e) {
      falhou(e, (msg) => avisar(msg));
    }
  }

  /* E-mail do casal errado num contrato já enviado: troca quem assina no
     mesmo documento da Autentique e abre o pop-up do link novo. */
  /* troca (ou reenvia, com o mesmo e-mail) e abre o pop-up do link; lança
     o erro pra quem chamou decidir onde mostrar */
  async function executarTrocaEmail(email: string) {
    const id = clienteIdRef.current;
    const autentiqueId = contrato?.autentique_id;
    if (!id || !autentiqueId) return;
    const mesmoEmail = email.trim().toLowerCase() === (fichaRef.current.email || "").trim().toLowerCase();
    await api("/api/estudio", { acao: "trocar-email-casal", id, email });
    const r = await api<{ link: string | null; mensagem?: string }>(
      "/api/estudio", { acao: "liberar-contrato-cliente", id, apenasLink: true },
    );
    await carregar(id);
    if (r.link) {
      setModalEnviado({
        link: r.link,
        mensagem: r.mensagem || r.link,
        urlContrato: urlNoAutentique(autentiqueId),
        /* reenvio pro mesmo e-mail não troca o link: sem o aviso âmbar */
        atualizado: !mesmoEmail,
        titulo: mesmoEmail ? "E-mail reenviado" : "E-mail trocado",
        texto: (mesmoEmail ? "A Autentique mandou de novo o pedido de assinatura pra " : "O casal agora assina com ") + email +
          ". É o mesmo contrato, com a sua assinatura, e não gastou documento da Autentique.",
      });
    }
  }

  async function trocarEmail(email: string) {
    setTrocaEmail({ ocupado: true, erro: "" });
    try {
      await executarTrocaEmail(email);
      setTrocaEmail(null);
    } catch (e) {
      falhou(e, (msg) => setTrocaEmail({ ocupado: false, erro: msg || "Não deu pra trocar o e-mail." }));
    }
  }

  /* menu do cartão do contrato: mesmo e-mail, sem formulário */
  async function reenviarEmail() {
    const email = (fichaRef.current.email || "").trim();
    if (!email) { setTrocaEmail({ ocupado: false, erro: "" }); return; }
    const ok = await confirmar({
      titulo: "Reenviar pro casal?",
      texto: "A Autentique manda de novo o pedido de assinatura pra " + email + ". É o mesmo contrato e não gasta documento.",
      rotuloOk: "Reenviar",
    });
    if (!ok) return;
    setOcupado(true);
    try {
      await executarTrocaEmail(email);
    } catch (e) {
      falhou(e, (msg) => avisar(msg || "Não deu pra reenviar."));
    } finally {
      setOcupado(false);
    }
  }

  /* ---------- arquivar / excluir ---------- */

  async function arquivar() {
    const id = clienteIdRef.current;
    if (!id) return;
    const ok = await confirmar({
      titulo: "Arquivar cliente?",
      texto: "Ele sai da lista padrão, mas continua acessível pelo filtro de status.",
      rotuloOk: "Arquivar",
    });
    if (!ok) return;
    try {
      await api("/api/estudio", { acao: "arquivar", id });
      router.push("/painel/clientes");
    } catch (e) {
      falhou(e, () => avisar("Não deu pra arquivar. Tente de novo."));
    }
  }

  async function excluir() {
    const id = clienteIdRef.current;
    if (!id) return;
    const ok = await confirmar({
      titulo: "Excluir de vez?",
      texto: "Este cliente será apagado permanentemente. Não dá pra desfazer.",
      rotuloOk: "Excluir",
      perigo: true,
    });
    if (!ok) return;
    try {
      await api("/api/estudio", { acao: "excluir", id });
      router.push("/painel/clientes");
    } catch (e) {
      falhou(e, () => avisar("Não deu pra excluir o cliente. Tente de novo."));
    }
  }

  /* ---------- botão de salvar ---------- */

  async function salvarPeloBotao(e: FormEvent) {
    e.preventDefault();
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    const eraNovo = !clienteIdRef.current;
    const payload = montarCliente(fichaRef.current);
    const enviado = JSON.stringify(payload);
    setStatusSalvo({ texto: "Salvando…" });
    try {
      const id = await salvarCliente(payload);
      ultimoSalvo.current = enviado;
      if (eraNovo && id) { await carregar(id); return; }
      setStatusSalvo({ texto: "Salvo", tom: "ok" });
    } catch (err) {
      falhou(err, (msg) => setStatusSalvo({ texto: "Não salvou: " + msg, tom: "erro" }));
    }
  }

  /* ---------- render ---------- */

  /* clique em data/hora abre o picker (por padrão só o iconezinho da direita
     abre). Só no click, então quem navega por teclado ganha foco e digita. */
  function abrirPicker(e: React.MouseEvent<HTMLInputElement>) {
    const el = e.currentTarget;
    if (typeof el.showPicker !== "function") return;
    try { el.showPicker(); } catch { /* Firefox exige gesto; clique é gesto, mas fica de rede */ }
  }

  if (erroCarga) {
    return (
      <div className="mx-auto max-w-[1100px]">
        <Voltar />
        <div className="mt-6"><Aviso>{erroCarga}</Aviso></div>
      </div>
    );
  }

  /* mesma regra do herói: os dois nomes, ou "Novo cliente" enquanto a ficha
     está em branco. Vai pro cabeçalho do celular, que no computador não existe. */
  const nomeDoCasal = ehNovo
    ? "Novo cliente"
    : [ficha.noivo, ficha.noiva].filter(Boolean).join(" & ");

  return (
    /* Mesma largura da lista de onde se chega aqui. Estava em 1280, o que
       fazia o conteúdo encostar no respiro da página e a tela parecer uma
       moldura dentro de outra — e mais largo que a Home (960) e que a própria
       lista (1100), então a cada clique a coluna crescia. */
    <div className="mx-auto max-w-[1100px]">
      <TituloMobile titulo={nomeDoCasal} />
      <div className="flex items-center justify-between gap-4">
        <Voltar />
        {/* "Digitou, salvou": o recado fica no topo, à vista enquanto se
            digita, e não num rodapé que ninguém rola até ver */}
        {statusSalvo.texto && !(ehNovo && !clienteId) ? (
          <div className="ml-auto text-right"><Estado texto={statusSalvo.texto} tom={statusSalvo.tom} /></div>
        ) : null}
      </div>

      {carregando ? (
        <Esqueleto />
      ) : (
        <form autoComplete="off" onSubmit={salvarPeloBotao}>
          <HeroCliente cliente={cliente} contratoAssinado={travado} onArquivar={arquivar} onExcluir={excluir} />

          {/* HIERARQUIA (refeita em 22/10/2026, pedido do Ricardo):
              1. quem é e quando (herói);
              2. em que pé está o contrato e o que fazer agora (coluna da
                 direita, no topo; no celular vem ANTES dos dados, porque é
                 o motivo de quase toda visita à ficha);
              3. quanto (pacote e valores, logo embaixo do contrato);
              4. os dados do casal, abertos e agrupados por pessoa, pra
                 consultar e copiar.
              Antes os dados ficavam em quatro tiras fechadas e o status do
              contrato era o segundo cartão da direita. */}
          <div className="grid grid-cols-1 items-start gap-x-5 min-[1080px]:grid-cols-[minmax(0,1.42fr)_minmax(0,1fr)]">
            {/* ---------- coluna direita: contrato e valores ---------- */}
            <div className="min-w-0 min-[1080px]:sticky min-[1080px]:top-[78px] min-[1080px]:order-2">
              {contrato && contratoGerado ? (
                <TimelineContrato contrato={contrato} onAbrirContrato={abrirContrato} onEditarContrato={() => void editarContrato()} onTrocarEmail={() => setTrocaEmail({ ocupado: false, erro: "" })} onReenviarEmail={() => void reenviarEmail()} onCopiarLink={() => void copiarLink()} avisar={avisar} />
              ) : (
                <ContratoVazio podeCriar={!!clienteId && !ocupado} onCriar={() => void acaoDoContrato()} />
              )}

              {/* resumo só leitura: a escolha mora no editor do contrato.
                  Ficha nova ainda sem cliente não tem o que resumir. */}
              {clienteId ? (
              <section className="mb-4 rounded-[22px] bg-paper p-5 md:px-6">
                <div className="mb-4 flex items-center gap-3">
                  <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[13px] bg-accent-tint text-accent">
                    <Package size={16} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[14.5px] font-semibold leading-[1.3] text-ink">Pacote e valores</span>
                    <span className="block truncate text-[12.5px] leading-[1.4] text-ink-soft">O que o casal contratou</span>
                  </span>
                </div>
                {/* o total é o número que se procura: grande, primeiro */}
                <div className="flex items-end justify-between gap-3 rounded-2xl bg-soft px-4 py-3.5">
                  <div className="min-w-0">
                    <span className="block text-[12px] font-medium text-ink-soft">Total</span>
                    <span className="block text-[22px] font-semibold leading-[1.2] tabular-nums text-ink">R$ {ficha.total || "0,00"}</span>
                  </div>
                  <div className="shrink-0 text-right">
                    <span className="block text-[12px] font-medium text-ink-soft">Entrada</span>
                    <span className="block text-[15px] font-semibold tabular-nums text-accent">R$ {ficha.entrada || "0,00"}</span>
                  </div>
                </div>
                {itens.length ? (
                  <ul className="m-0 mt-2 list-none p-0">
                    {itens.map((i) => (
                      <li key={i.id} className="flex items-center gap-3 px-1 py-2 text-[13.5px]">
                        <span className="min-w-0 flex-1 truncate text-ink">{i.nome}</span>
                        <span className="shrink-0 whitespace-nowrap text-[13px] tabular-nums text-ink-soft">R$ {formatarMoeda(i.valor)}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="m-0 mt-3 px-1 text-[13.5px] text-ink-soft">Nenhum pacote escolhido ainda.</p>
                )}
                {/* sem botão de editar (pedido do Ricardo): pacote e valores se
                    mexem no editor do contrato, aberto pelo cartão de cima */}
                {travado ? (
                  <p className="m-0 mt-3 px-1 text-[12.5px] leading-[1.5] text-ink-soft">
                    O casal já assinou: pacote, adicionais e valores ficam como estão no contrato.
                  </p>
                ) : null}
              </section>
              ) : null}
            </div>

            {/* ---------- coluna esquerda: o casal ---------- */}
            <div className="min-w-0 min-[1080px]:order-1">
              <SecaoFicha icone={<Heart size={16} />} titulo="O casal" descricao="Contratantes e contato" chave="casal"
                forcarAberta={ehNovo || campoAlvo === "email"}>
                {/* uma coluna por pessoa: o olho lê "o noivo" de cima a baixo,
                    em vez de pular entre noivo e noiva a cada campo */}
                <div className="grid grid-cols-1 gap-x-6 sm:grid-cols-2">
                  <div className="min-w-0">
                    <CampoCopiavel id="f-noivo" rotulo="Noivo" value={ficha.noivo} avisar={avisar}
                      onChange={(e) => mudarCampo("noivo", e.target.value)} onBlur={salvarLogo} />
                    <CampoCopiavel id="f-cpf-noivo" rotulo="CPF do noivo" value={ficha.cpf_noivo} avisar={avisar}
                      inputMode="numeric" placeholder="000.000.000-00" maxLength={14}
                      onChange={(e) => mudarCampo("cpf_noivo", e.target.value)} onBlur={salvarLogo} />
                    <CampoCopiavel id="f-tel-noivo" rotulo="Telefone do noivo" value={ficha.tel_noivo} avisar={avisar}
                      copiavel={false} whatsapp inputMode="tel" placeholder="(00) 00000-0000"
                      onChange={(e) => mudarCampo("tel_noivo", e.target.value)} onBlur={salvarLogo} />
                  </div>
                  <div className="min-w-0">
                    <CampoCopiavel id="f-noiva" rotulo="Noiva" value={ficha.noiva} avisar={avisar}
                      onChange={(e) => mudarCampo("noiva", e.target.value)} onBlur={salvarLogo} />
                    <CampoCopiavel id="f-cpf-noiva" rotulo="CPF da noiva" value={ficha.cpf_noiva} avisar={avisar}
                      inputMode="numeric" placeholder="000.000.000-00" maxLength={14}
                      onChange={(e) => mudarCampo("cpf_noiva", e.target.value)} onBlur={salvarLogo} />
                    <CampoCopiavel id="f-tel-noiva" rotulo="Telefone da noiva" value={ficha.tel_noiva} avisar={avisar}
                      copiavel={false} whatsapp inputMode="tel" placeholder="(00) 00000-0000"
                      onChange={(e) => mudarCampo("tel_noiva", e.target.value)} onBlur={salvarLogo} />
                  </div>
                </div>
                <CampoCopiavel id="f-email" rotulo="E-mail do casal" value={ficha.email} avisar={avisar} type="email"
                  readOnly={emailNaAutentique}
                  acao={emailNaAutentique ? (
                    <button type="button" onClick={() => setTrocaEmail({ ocupado: false, erro: "" })}
                      className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-[10px] bg-soft px-3.5 text-[13px] font-semibold text-accent transition-colors hover:bg-line">
                      {/* no celular só "Trocar": o campo do e-mail ficava com 9 letras à vista */}
                      <Mail size={15} /> <span>Trocar<span className="hidden sm:inline"> e reenviar</span></span>
                    </button>
                  ) : undefined}
                  onChange={(e) => { if (!emailNaAutentique) mudarCampo("email", e.target.value); }} onBlur={salvarLogo} />
                {emailNaAutentique ? (
                  <p className="m-0 -mt-2 text-[11.5px] leading-[1.5] text-ink-soft/85">
                    O contrato já foi pra esse e-mail. Se estiver errado, troque e reenvie pro casal.
                  </p>
                ) : null}
              </SecaoFicha>

              <SecaoFicha icone={<CalendarHeart size={16} />} titulo="O evento" descricao="Data, horário e local" chave="evento">
                <div className="grid grid-cols-1 gap-x-6 sm:grid-cols-2">
                  <Campo id="f-data" rotulo="Data do casamento" type="date" autoComplete="off" className="h-11 py-0"
                    value={ficha.data_evento} onChange={(e) => mudarCampo("data_evento", e.target.value)} onBlur={salvarLogo} onClick={abrirPicker} />
                  <Campo id="f-horario" rotulo="Horário" type="time" autoComplete="off" className="h-11 py-0"
                    value={ficha.horario} onChange={(e) => mudarCampo("horario", e.target.value)} onBlur={salvarLogo} onClick={abrirPicker} />
                  <div className="col-span-full">
                    <Campo id="f-local" rotulo="Local" autoComplete="off" className="h-11 py-0"
                      value={ficha.local_evento} onChange={(e) => mudarCampo("local_evento", e.target.value)} onBlur={salvarLogo} />
                  </div>
                  <div className="col-span-full">
                    <Campo id="f-endereco-evento" rotulo="Endereço do evento" autoComplete="off" className="h-11 py-0"
                      placeholder="Rua, número, cidade"
                      value={ficha.endereco_evento} onChange={(e) => mudarCampo("endereco_evento", e.target.value)} onBlur={salvarLogo} />
                  </div>
                </div>
              </SecaoFicha>

              <SecaoFicha icone={<MapPin size={16} />} titulo="Endereço" descricao="Vai no contrato" chave="endereco">
                {/* grade de 6: cada campo com a largura do que cabe nele (UF
                    não precisa de um terço da linha, endereço precisa de mais) */}
                <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-6 [&>*]:min-w-0">
                  <div className="sm:col-span-2">
                    <CampoCopiavel id="f-cep" rotulo="CEP" value={ficha.cep} avisar={avisar}
                      inputMode="numeric" placeholder="00000-000" maxLength={9}
                      onChange={(e) => mudarCampo("cep", e.target.value)} onBlur={salvarLogo} />
                  </div>
                  <div className="sm:col-span-4">
                    <CampoCopiavel id="f-endereco" rotulo="Endereço" value={ficha.endereco} avisar={avisar}
                      onChange={(e) => mudarCampo("endereco", e.target.value)} onBlur={salvarLogo} />
                  </div>
                  <div className="sm:col-span-2">
                    <CampoCopiavel id="f-numero" rotulo="Número" value={ficha.numero} avisar={avisar}
                      onChange={(e) => mudarCampo("numero", e.target.value)} onBlur={salvarLogo} />
                  </div>
                  <div className="sm:col-span-4">
                    <Campo id="f-complemento" rotulo="Complemento" autoComplete="off" className="h-11 py-0"
                      value={ficha.complemento} onChange={(e) => mudarCampo("complemento", e.target.value)} onBlur={salvarLogo} />
                  </div>
                  <div className="sm:col-span-2">
                    <CampoCopiavel id="f-bairro" rotulo="Bairro" value={ficha.bairro} avisar={avisar}
                      onChange={(e) => mudarCampo("bairro", e.target.value)} onBlur={salvarLogo} />
                  </div>
                  <div className="sm:col-span-3">
                    <CampoCopiavel id="f-cidade" rotulo="Cidade" value={ficha.cidade} avisar={avisar}
                      onChange={(e) => mudarCampo("cidade", e.target.value)} onBlur={salvarLogo} />
                  </div>
                  <div className="sm:col-span-1">
                    <Campo id="f-estado" rotulo="UF" autoComplete="off" placeholder="UF" maxLength={2} className="h-11 py-0 uppercase"
                      value={ficha.estado} onChange={(e) => mudarCampo("estado", e.target.value.toUpperCase())} onBlur={salvarLogo} />
                  </div>
                </div>
              </SecaoFicha>
              {/* Perguntas que o fotógrafo criou em /painel/formulario. Só
                  leitura: é o que o casal escreveu, com a pergunta do jeito
                  que estava quando ele respondeu. Só aparece se houver. */}
              {respostasDoCliente(cliente?.respostas_formulario).length ? (
                <SecaoFicha icone={<ClipboardList size={16} />} titulo="Respostas do formulário" descricao="O que o casal escreveu" chave="respostas">
                  <dl className="m-0 grid grid-cols-1 gap-x-6 gap-y-3.5 sm:grid-cols-2">
                    {respostasDoCliente(cliente?.respostas_formulario).map((r, i) => (
                      <div key={r.id + i} className={"min-w-0 " + (r.tipo === "paragrafo" ? "col-span-full" : "")}>
                        <dt className="mb-1 text-[12.5px] font-medium text-ink-soft">{r.rotulo}</dt>
                        <dd className="m-0 whitespace-pre-line break-words rounded-[10px] bg-soft px-3.5 py-3 text-sm text-ink">{exibirResposta(r)}</dd>
                      </div>
                    ))}
                  </dl>
                </SecaoFicha>
              ) : null}

              <SecaoFicha icone={<NotebookPen size={16} />} titulo="Anotações" descricao="Só você vê" chave="anotacoes">
                <div className="mb-3.5 sm:max-w-[50%]">
                  <label htmlFor="f-origem" className="mb-1.5 block text-[12.5px] font-medium text-ink-soft">Como conheceu</label>
                  <div className="relative">
                    <select
                      id="f-origem"
                      autoComplete="off"
                      value={ficha.origem}
                      onChange={(e) => { mudarCampo("origem", e.target.value); salvarLogo(); }}
                      className="h-11 w-full cursor-pointer appearance-none rounded-[10px] bg-soft pl-3.5 pr-9 text-sm text-ink outline-none transition-colors focus:bg-[#EEF0F3]"
                    >
                      <option value="">Selecione</option>
                      {ORIGENS.map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                    <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink-soft" aria-hidden />
                  </div>
                </div>
                <Area id="f-observacoes" rotulo="Observações" autoComplete="off" placeholder="Anotações internas, só você vê."
                  className="min-h-[72px]" value={ficha.observacoes}
                  onChange={(e) => mudarCampo("observacoes", e.target.value)} onBlur={salvarLogo} />
              </SecaoFicha>
            </div>
          </div>

          {/* Ficha que já existe se salva sozinha (o estado mora no topo, ao
              lado do Voltar); botão só pra criar a ficha nova, que é o único
              momento em que salvar é uma decisão. Enter num campo continua
              salvando (submit do form). */}
          {ehNovo && !clienteId ? (
            <div className="mb-16 mt-4 flex flex-col items-stretch justify-end gap-3 md:flex-row md:items-center">
              <div className="text-center md:text-left"><Estado texto={statusSalvo.texto} tom={statusSalvo.tom} /></div>
              <Botao type="submit" className="w-full md:w-auto">Criar cliente</Botao>
            </div>
          ) : <div className="mb-16" />}
        </form>
      )}

      {modalLink ? <ModalLink dados={modalLink} onFechar={() => setModalLink(null)} /> : null}
      {modalEnviado ? <ModalContratoEnviado dados={modalEnviado} onFechar={() => setModalEnviado(null)} /> : null}
      {trocaEmail ? (
        <ModalTrocarEmail emailAtual={ficha.email || ""} ocupado={trocaEmail.ocupado} erro={trocaEmail.erro}
          aoFechar={() => setTrocaEmail(null)} aoTrocar={(email) => void trocarEmail(email)} />
      ) : null}
      {toast}
    </div>
  );
}

/* No celular quem volta é a seta do cabeçalho (ver cabecalho-mobile.tsx).
   O rótulo diz "Início" porque é onde se cai quando não há histórico nosso;
   havendo, a seta devolve pra tela de onde se veio (ver lib/voltar.ts). */
function Voltar() {
  return (
    <div className="hidden md:block">
      <BotaoVoltar href="/painel/clientes" rotulo="Clientes" />
    </div>
  );
}

function Esqueleto() {
  /* mesma ordem da ficha: no celular o contrato vem antes dos dados */
  const bloco = "animate-pulse rounded-[22px] bg-paper";
  return (
    <div aria-busy="true" aria-label="Carregando">
      <div className="mb-5 mt-3 h-[150px] animate-pulse rounded-3xl bg-line md:mb-8" />
      <div className="grid grid-cols-1 items-start gap-x-5 gap-y-4 min-[1080px]:grid-cols-[minmax(0,1.42fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-4 min-[1080px]:order-2">
          <div className={bloco + " h-[260px]"} />
          <div className={bloco + " h-[220px]"} />
        </div>
        <div className="flex flex-col gap-4 min-[1080px]:order-1">
          <div className={bloco + " h-[330px]"} />
          <div className={bloco + " h-[240px]"} />
        </div>
      </div>
    </div>
  );
}

/*
  Formulário de cadastro (/cadastro) editável pelo fotógrafo, em
  /painel/formulario (22/10/2026).

  Duas coisas diferentes moram aqui:

  1. Os CAMPOS FIXOS, que já existiam e gravam cada um numa coluna do cliente
     (nome, CPF, endereço, data...). O fotógrafo muda o texto e escolhe três
     coisas em cada um: aparece, obrigatório e CADEADO. O cadeado trava as
     outras duas, pra ninguém mudar sem querer; não é regra do sistema
     (pedido do Ricardo Grauppe em 22/10/2026: tudo escolhível). Os campos
     que o contrato e a assinatura usam (nomes, WhatsApp, e-mail, data) vêm
     com cadeado ligado. Destravado e escondido, o campo leva um `aviso` do
     que deixa de funcionar, e o /api/orcamento aceita qualquer combinação
     (sem data ou sem nome, não procura ficha repetida; só cria).
     Nomes têm uma regra à parte, a do PAR: se os dois aparecem e nenhum é
     obrigatório, basta um dos dois (ver regraDoPar).
  2. As PERGUNTAS NOVAS, criadas pelo fotógrafo. Não têm coluna: a resposta vai
     pra `clientes.respostas_formulario` junto com o texto da pergunta na hora
     do envio, pra continuar legível depois que a pergunta mudar ou sumir.

  `normalizarFormulario` é a única porta de entrada: roda ao ler do banco e ao
  salvar, e é ela que garante os limites. O cliente nunca é confiável aqui (a
  rota pública de cadastro lê a mesma config pra decidir o que exigir).

  Sem React e sem "server-only": o editor, o formulário e as rotas usam.
*/

export type SecaoFormulario = "assinar" | "endereco" | "evento" | "extra";

/* Os títulos são o que o CASAL lê no /cadastro (e o editor repete, pra o
   fotógrafo ver a mesma coisa): fala de gente, não de cadastro. Os ids ficam
   como estão, porque são o que está gravado nas perguntas novas. */
export const SECOES: readonly { id: SecaoFormulario; titulo: string }[] = [
  { id: "assinar", titulo: "Sobre vocês" },
  { id: "endereco", titulo: "Endereço do contrato" },
  { id: "evento", titulo: "Sobre o grande dia" },
  { id: "extra", titulo: "Conta pra gente" },
];

/* Explicação de cada etapa no /cadastro (o card informativo azul), editável
   no painel. Na voz do estúdio, primeira pessoa do plural (TOM-DE-VOZ.md). */
export const EXPLICACAO_PADRAO: Record<SecaoFormulario, string> = {
  assinar: "Dados de quem vai assinar o contrato. Se só uma pessoa for assinar, basta preencher os dados dela.",
  endereco: "O contrato pede um endereço pra ficar completo. Digitem o CEP que a gente preenche o resto.",
  evento: "Com a data, o horário e o local a gente reserva a agenda e começa a planejar a cobertura.",
  extra: "Algumas perguntas pra gente conhecer vocês um pouco melhor antes do grande dia.",
};
/* O padrão de "Sobre vocês" fala de "basta uma pessoa", que só vale com a
   regra do par; fora dela, e sem texto do fotógrafo, vale este. */
export const EXPLICACAO_ASSINAR_SEM_PAR = "Dados de quem vai assinar o contrato.";

export const TITULO_SECAO = Object.fromEntries(SECOES.map((x) => [x.id, x.titulo])) as Record<SecaoFormulario, string>;

export type CampoFixoId =
  | "noivo" | "noiva" | "cpfNoivo" | "cpfNoiva" | "contato" | "email"
  | "cep" | "numero" | "endereco" | "complemento" | "bairro" | "cidade" | "estado"
  | "data" | "horario" | "local" | "enderecoEvento";

export type DefinicaoCampo = {
  id: CampoFixoId;
  secao: SecaoFormulario;
  rotulo: string;
  placeholder: string;
  obrigatorio: boolean;
  /** vem com cadeado ligado (os campos que o contrato e a assinatura usam) */
  travado: boolean;
  /** o que deixa de funcionar se o campo for escondido ou ficar opcional, na voz do painel */
  aviso?: string;
  /** não vai pro contrato: escondido, não deixa nada em branco lá */
  foraDoContrato?: boolean;
};

/* Na ordem em que aparecem no /cadastro. */
export const CAMPOS_FIXOS: readonly DefinicaoCampo[] = [
  { id: "noivo", secao: "assinar", rotulo: "Nome do noivo", placeholder: "", obrigatorio: false, travado: true, aviso: "O contrato precisa do nome de quem assina" },
  { id: "noiva", secao: "assinar", rotulo: "Nome da noiva", placeholder: "", obrigatorio: false, travado: true, aviso: "O contrato precisa do nome de quem assina" },
  /* CPF opcional desde 2026-08-11: o Jordan atende quem não tem */
  { id: "cpfNoivo", secao: "assinar", rotulo: "CPF do noivo", placeholder: "000.000.000-00", obrigatorio: false, travado: false },
  { id: "cpfNoiva", secao: "assinar", rotulo: "CPF da noiva", placeholder: "000.000.000-00", obrigatorio: false, travado: false },
  { id: "contato", secao: "assinar", rotulo: "WhatsApp", placeholder: "", obrigatorio: true, travado: true, aviso: "É por onde você manda o contrato" },
  { id: "email", secao: "assinar", rotulo: "E-mail", placeholder: "", obrigatorio: true, travado: true, aviso: "Sem e-mail, o contrato não vai pra assinatura" },
  { id: "cep", secao: "endereco", rotulo: "CEP", placeholder: "00000-000", obrigatorio: true, travado: false },
  { id: "numero", secao: "endereco", rotulo: "Número", placeholder: "", obrigatorio: true, travado: false },
  { id: "endereco", secao: "endereco", rotulo: "Endereço", placeholder: "Rua, avenida...", obrigatorio: true, travado: false },
  { id: "complemento", secao: "endereco", rotulo: "Complemento", placeholder: "", obrigatorio: false, travado: false },
  { id: "bairro", secao: "endereco", rotulo: "Bairro", placeholder: "", obrigatorio: true, travado: false },
  { id: "cidade", secao: "endereco", rotulo: "Cidade", placeholder: "", obrigatorio: true, travado: false },
  { id: "estado", secao: "endereco", rotulo: "Estado", placeholder: "UF", obrigatorio: true, travado: false },
  { id: "data", secao: "evento", rotulo: "Data do casamento", placeholder: "", obrigatorio: true, travado: true, aviso: "O contrato precisa da data, e é ela que separa um casal do outro" },
  { id: "horario", secao: "evento", rotulo: "Horário", placeholder: "", obrigatorio: true, travado: false },
  { id: "local", secao: "evento", rotulo: "Local do evento", placeholder: "Nome do espaço", obrigatorio: true, travado: false },
  /* onde o espaço fica, pra quem vai fotografar chegar (22/10/2026). Não
     entra no contrato, que cita só o local. */
  { id: "enderecoEvento", secao: "evento", rotulo: "Endereço do evento", placeholder: "Rua, número, cidade", obrigatorio: false, travado: false, foraDoContrato: true },
];

export const DEFINICAO: Record<CampoFixoId, DefinicaoCampo> = Object.fromEntries(
  CAMPOS_FIXOS.map((c) => [c.id, c]),
) as Record<CampoFixoId, DefinicaoCampo>;

/* data e hora não têm onde mostrar texto de exemplo (o navegador desenha o
   próprio controle), e o WhatsApp é formatado pelo plugin de DDI */
export const SEM_PLACEHOLDER: readonly CampoFixoId[] = ["data", "horario", "contato"];

export type AjusteCampo = { rotulo: string; placeholder: string; visivel: boolean; obrigatorio: boolean; travado: boolean };

export type TipoPergunta = "texto" | "paragrafo" | "numero" | "data" | "escolha";

export const TIPOS_PERGUNTA: readonly { id: TipoPergunta; rotulo: string }[] = [
  { id: "texto", rotulo: "Texto curto" },
  { id: "paragrafo", rotulo: "Parágrafo" },
  { id: "numero", rotulo: "Número" },
  { id: "data", rotulo: "Data" },
  { id: "escolha", rotulo: "Escolha" },
];

export type Pergunta = {
  id: string;
  secao: SecaoFormulario;
  tipo: TipoPergunta;
  rotulo: string;
  placeholder: string;
  obrigatorio: boolean;
  visivel: boolean;
  travado: boolean;
  /** só pro tipo "escolha" */
  opcoes: string[];
};

/* ---------- fotos da abertura do /cadastro ----------
   "padrao" são as do portfólio do Jordan que já vêm no app (webp prontos em
   public/img/abertura/); "enviada" são as que o fotógrafo sobe pelo editor,
   guardadas no bucket privado formulario-fotos e entregues pela rota
   /api/formulario/fotos/<arquivo>. As duas têm 750 e 1200px de largura.
   `foco` é a posição vertical do recorte, de 0 (topo) a 100 (base): as fotos
   costumam ser retrato e o quadro é 4:3. */
export type FotoAbertura = { id: string; origem: "padrao" | "enviada"; foco: number; alt: string };

export const FOTOS_PADRAO: readonly FotoAbertura[] = [
  { id: "prewedding", origem: "padrao", foco: 62, alt: "Casal no alto de uma caminhonete antiga, no campo, ao pôr do sol" },
  { id: "casal-jardim", origem: "padrao", foco: 40, alt: "Noivos caminhando de mãos dadas em um jardim" },
  { id: "entrega-1", origem: "padrao", foco: 45, alt: "Noivo beijando o rosto da noiva, em preto e branco" },
  { id: "casal-palacio", origem: "padrao", foco: 35, alt: "Noivos em um palácio, em preto e branco" },
  { id: "casal-campo", origem: "padrao", foco: 65, alt: "Noivos caminhando ao lado de um milharal, em preto e branco" },
  { id: "noiva-retrato", origem: "padrao", foco: 30, alt: "Retrato da noiva com véu, sentada, em preto e branco" },
  { id: "entrega-3", origem: "padrao", foco: 35, alt: "Retrato próximo dos noivos" },
  { id: "entrega-2", origem: "padrao", foco: 70, alt: "Noiva em um salão histórico, em preto e branco" },
];

export const MAX_FOTOS = 12;

/** id de foto enviada: "f_" + aleatório. É também o nome do arquivo no bucket. */
export const ID_FOTO_ENVIADA = /^f_[a-z0-9]{8,24}$/;

export function urlFoto(f: Pick<FotoAbertura, "id" | "origem">, largura: 750 | 1200): string {
  return f.origem === "padrao"
    ? "/img/abertura/" + f.id + "-" + largura + ".webp"
    : "/api/formulario/fotos/" + f.id + "-" + largura + ".webp";
}

export type Formulario = {
  /** títulos das etapas, editáveis; vazio volta o de SECOES */
  titulos: Record<SecaoFormulario, string>;
  /** explicação de cada etapa (card azul do /cadastro); vazio volta o padrão */
  explicacoes: Record<SecaoFormulario, string>;
  /** "Conta pra gente" ligada: a única etapa que se desliga inteira (as
      outras têm campos que o contrato usa). Desligada, as perguntas dela
      não aparecem nem são cobradas. */
  extraAtiva: boolean;
  campos: Record<CampoFixoId, AjusteCampo>;
  perguntas: Pergunta[];
  fotos: FotoAbertura[];
};

/** O que fica gravado no cliente: a resposta com a pergunta do momento. */
export type RespostaFormulario = { id: string; rotulo: string; tipo: TipoPergunta; valor: string };

export const LIMITES = {
  rotulo: 120,
  titulo: 60,
  explicacao: 300,
  placeholder: 120,
  perguntas: 20,
  opcoes: 12,
  opcao: 80,
  texto: 300,
  paragrafo: 2000,
} as const;

/* ---------- normalização ---------- */

function obj(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

function texto(v: unknown, max: number): string {
  return typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "";
}

const IDS_SECAO = new Set(SECOES.map((s) => s.id));
const IDS_TIPO = new Set(TIPOS_PERGUNTA.map((t) => t.id));

export function ajustePadrao(def: DefinicaoCampo): AjusteCampo {
  return { rotulo: def.rotulo, placeholder: def.placeholder, visivel: true, obrigatorio: def.obrigatorio, travado: def.travado };
}

export function formularioPadrao(): Formulario {
  return {
    titulos: { ...TITULO_SECAO },
    explicacoes: { ...EXPLICACAO_PADRAO },
    extraAtiva: false,
    campos: Object.fromEntries(CAMPOS_FIXOS.map((d) => [d.id, ajustePadrao(d)])) as Record<CampoFixoId, AjusteCampo>,
    perguntas: [],
    fotos: FOTOS_PADRAO.map((f) => ({ ...f })),
  };
}

const IDS_PADRAO = new Set(FOTOS_PADRAO.map((f) => f.id));

function normalizarFoto(v: unknown): FotoAbertura | null {
  const f = obj(v);
  const id = typeof f.id === "string" ? f.id : "";
  const origem = f.origem === "enviada" ? "enviada" : f.origem === "padrao" ? "padrao" : null;
  if (!origem) return null;
  if (origem === "padrao" && !IDS_PADRAO.has(id)) return null;
  if (origem === "enviada" && !ID_FOTO_ENVIADA.test(id)) return null;
  const foco = typeof f.foco === "number" && isFinite(f.foco) ? Math.min(100, Math.max(0, Math.round(f.foco))) : 50;
  const padrao = FOTOS_PADRAO.find((p) => p.id === id);
  return { id, origem, foco, alt: texto(f.alt, LIMITES.rotulo) || padrao?.alt || "Foto do portfólio" };
}

/** Id de pergunta nova. Curto e sem relação com o texto: renomear não muda. */
export function novoIdPergunta(): string {
  return "p_" + Math.random().toString(36).slice(2, 10);
}

function normalizarPergunta(v: unknown): Pergunta | null {
  const p = obj(v);
  const id = typeof p.id === "string" && /^p_[a-z0-9]{4,16}$/.test(p.id) ? p.id : null;
  if (!id) return null;
  const tipo = IDS_TIPO.has(p.tipo as TipoPergunta) ? (p.tipo as TipoPergunta) : "texto";
  const opcoes = tipo === "escolha" && Array.isArray(p.opcoes)
    ? [...new Set(p.opcoes.map((o) => texto(o, LIMITES.opcao)))].slice(0, LIMITES.opcoes)
    : [];
  return {
    id,
    secao: IDS_SECAO.has(p.secao as SecaoFormulario) ? (p.secao as SecaoFormulario) : "extra",
    tipo,
    /* rótulo vazio é permitido enquanto o fotógrafo digita; o /cadastro pula
       pergunta sem texto (ver perguntasVisiveis) */
    rotulo: texto(p.rotulo, LIMITES.rotulo),
    placeholder: tipo === "data" || tipo === "escolha" ? "" : texto(p.placeholder, LIMITES.placeholder),
    obrigatorio: p.obrigatorio === true,
    visivel: p.visivel !== false,
    travado: p.travado === true,
    /* opção vazia fica enquanto é digitada (é a linha nova do editor) */
    opcoes,
  };
}

/** Lê qualquer coisa e devolve um formulário válido, com as travas aplicadas. */
export function normalizarFormulario(bruto: unknown): Formulario {
  const b = obj(bruto);
  const campos = obj(b.campos);
  const saida = formularioPadrao();
  const titulos = obj(b.titulos);
  const explicacoes = obj(b.explicacoes);
  for (const sec of SECOES) {
    saida.titulos[sec.id] = texto(titulos[sec.id], LIMITES.titulo) || sec.titulo;
    saida.explicacoes[sec.id] = texto(explicacoes[sec.id], LIMITES.explicacao) || EXPLICACAO_PADRAO[sec.id];
  }

  for (const def of CAMPOS_FIXOS) {
    const c = obj(campos[def.id]);
    const rotulo = texto(c.rotulo, LIMITES.rotulo);
    saida.campos[def.id] = {
      /* rótulo apagado volta pro padrão: campo sem nome no /cadastro não tem
         como ser preenchido */
      rotulo: rotulo || def.rotulo,
      placeholder: SEM_PLACEHOLDER.includes(def.id) ? "" : (typeof c.placeholder === "string" ? texto(c.placeholder, LIMITES.placeholder) : def.placeholder),
      visivel: c.visivel !== false,
      obrigatorio: typeof c.obrigatorio === "boolean" ? c.obrigatorio : def.obrigatorio,
      travado: typeof c.travado === "boolean" ? c.travado : def.travado,
    };
  }

  const vistos = new Set<string>();
  saida.perguntas = (Array.isArray(b.perguntas) ? b.perguntas : [])
    .map(normalizarPergunta)
    .filter((p): p is Pergunta => !!p && !vistos.has(p.id) && !!vistos.add(p.id))
    .slice(0, LIMITES.perguntas);

  /* config de antes da chave: fica ligada se já tinha pergunta ali, que é
     como ela se comportava (aparecia quando tinha pergunta) */
  saida.extraAtiva = typeof b.extraAtiva === "boolean"
    ? b.extraAtiva
    : saida.perguntas.some((p) => p.secao === "extra");

  /* sem a chave (config antiga) ou com a lista vazia, valem as do portfólio:
     a abertura nunca fica sem foto */
  if (Array.isArray(b.fotos)) {
    const vistas = new Set<string>();
    const fotos = b.fotos
      .map(normalizarFoto)
      .filter((f): f is FotoAbertura => !!f && !vistas.has(f.id) && !!vistas.add(f.id))
      .slice(0, MAX_FOTOS);
    if (fotos.length) saida.fotos = fotos;
  }

  return saida;
}

/* ---------- uso no /cadastro e na rota ---------- */

/** O campo fixo é exigido no envio? (nomes também seguem a regra do par) */
export function campoExigido(f: Formulario, id: CampoFixoId): boolean {
  const c = f.campos[id];
  return c.visivel && c.obrigatorio;
}

/** O que o card azul da etapa diz pro casal. */
export function explicacaoDaEtapa(f: Formulario, secao: SecaoFormulario): string {
  const t = f.explicacoes[secao];
  if (secao === "assinar" && t === EXPLICACAO_PADRAO.assinar && !regraDoPar(f)) return EXPLICACAO_ASSINAR_SEM_PAR;
  return t;
}

/**
 * Regra do par dos nomes: quando os dois aparecem e nenhum foi marcado como
 * obrigatório, basta um dos dois (o contrato pode ter uma pessoa só,
 * 2026-08-08). Marcado como obrigatório, o nome vale sozinho.
 */
export function regraDoPar(f: Formulario): boolean {
  const { noivo, noiva } = f.campos;
  return noivo.visivel && noiva.visivel && !noivo.obrigatorio && !noiva.obrigatorio;
}

/** Perguntas que o casal vê: as que têm texto e, se forem de escolha, opções. */
export function perguntasVisiveis(f: Formulario): Pergunta[] {
  return f.perguntas.filter((p) =>
    p.visivel && p.rotulo && (p.tipo !== "escolha" || p.opcoes.some(Boolean)) &&
    (p.secao !== "extra" || f.extraAtiva));
}

/**
 * Confere as respostas das perguntas novas. Devolve a lista pra gravar no
 * cliente, ou o erro na voz do formulário (é o que o casal lê).
 */
export function validarRespostas(
  f: Formulario, bruto: unknown,
): { respostas: RespostaFormulario[]; erro: string | null; perguntaId?: string } {
  const entrada = obj(bruto);
  const respostas: RespostaFormulario[] = [];
  for (const p of perguntasVisiveis(f)) {
    const cru = entrada[p.id];
    const max = p.tipo === "paragrafo" ? LIMITES.paragrafo : LIMITES.texto;
    const valor = typeof cru === "string"
      ? (p.tipo === "paragrafo" ? cru.trim().slice(0, max) : texto(cru, max))
      : "";
    const erro = erroDaResposta(p, valor);
    if (erro) return { respostas: [], erro, perguntaId: p.id };
    if (valor) respostas.push({ id: p.id, rotulo: p.rotulo, tipo: p.tipo, valor });
  }
  return { respostas, erro: null };
}

/** Mesma regra no navegador (pra apontar o campo) e na rota (pra valer). */
export function erroDaResposta(p: Pergunta, valor: string): string | null {
  if (!valor) {
    if (!p.obrigatorio) return null;
    return p.tipo === "escolha" ? "Escolha uma das opções." : p.tipo === "data" ? "Escolha uma data." : "Preencha este campo.";
  }
  /* ponto e vírgula soltos de propósito: "1.500" e "1,5" são os dois jeitos
     que alguém escreve número aqui */
  if (p.tipo === "numero" && !/^-?\d[\d.,]*$/.test(valor)) return "Digite só números.";
  if (p.tipo === "data" && !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return "Escolha uma data.";
  if (p.tipo === "escolha" && !p.opcoes.includes(valor)) return "Escolha uma das opções.";
  return null;
}

/** Valor da resposta pra ler (data vira dd/mm/aaaa). */
export function exibirResposta(r: Pick<RespostaFormulario, "tipo" | "valor">): string {
  if (r.tipo === "data" && /^\d{4}-\d{2}-\d{2}$/.test(r.valor)) {
    const [a, m, d] = r.valor.split("-");
    return d + "/" + m + "/" + a;
  }
  return r.valor;
}

/** Lista gravada no cliente, lida de forma defensiva (jsonb é o que vier). */
export function respostasDoCliente(v: unknown): RespostaFormulario[] {
  if (!Array.isArray(v)) return [];
  return v.flatMap((x) => {
    const r = obj(x);
    if (typeof r.rotulo !== "string" || typeof r.valor !== "string" || !r.valor) return [];
    return [{
      id: typeof r.id === "string" ? r.id : "",
      rotulo: r.rotulo,
      tipo: IDS_TIPO.has(r.tipo as TipoPergunta) ? (r.tipo as TipoPergunta) : "texto",
      valor: r.valor,
    }];
  });
}

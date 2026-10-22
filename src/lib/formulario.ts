/*
  Formulário de cadastro (/cadastro) editável pelo fotógrafo, em
  /painel/formulario (22/10/2026).

  Duas coisas diferentes moram aqui:

  1. Os CAMPOS FIXOS, que já existiam e gravam cada um numa coluna do cliente
     (nome, CPF, endereço, data...). O contrato usa essas colunas, então o
     fotógrafo só muda o texto deles e, quando dá, esconde ou deixa opcional.
     Quem pode o quê é a `regra` de cada um:
       travado  → sempre aparece e sempre é pedido. Nomes (a regra é "ao menos
                  um dos dois"), WhatsApp, e-mail (a Autentique manda o pedido
                  de assinatura amarrado a ele) e data (é a chave que evita
                  ficha duplicada no reenvio).
       opcional → pode esconder, nunca vira obrigatório. É o CPF, opcional
                  desde 2026-08-11 porque o Jordan atende quem não tem.
       livre    → esconde e liga/desliga obrigatório. Escondido = fica em
                  branco no contrato, e o editor avisa.
  2. As PERGUNTAS NOVAS, criadas pelo fotógrafo. Não têm coluna: a resposta vai
     pra `clientes.respostas_formulario` junto com o texto da pergunta na hora
     do envio, pra continuar legível depois que a pergunta mudar ou sumir.

  `normalizarFormulario` é a única porta de entrada: roda ao ler do banco e ao
  salvar, e é ela que garante as travas. O cliente nunca é confiável aqui (a
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

export const TITULO_SECAO = Object.fromEntries(SECOES.map((x) => [x.id, x.titulo])) as Record<SecaoFormulario, string>;

export type CampoFixoId =
  | "noivo" | "noiva" | "cpfNoivo" | "cpfNoiva" | "contato" | "email"
  | "cep" | "numero" | "endereco" | "complemento" | "bairro" | "cidade" | "estado"
  | "data" | "horario" | "local";

export type RegraCampo = "travado" | "opcional" | "livre";

export type DefinicaoCampo = {
  id: CampoFixoId;
  secao: SecaoFormulario;
  rotulo: string;
  placeholder: string;
  regra: RegraCampo;
  obrigatorio: boolean;
  /** por que está travado, na voz do painel */
  porque?: string;
};

/* Na ordem em que aparecem no /cadastro. */
export const CAMPOS_FIXOS: readonly DefinicaoCampo[] = [
  { id: "noivo", secao: "assinar", rotulo: "Nome do noivo", placeholder: "", regra: "travado", obrigatorio: false, porque: "Basta um dos dois nomes, o contrato precisa dele" },
  { id: "noiva", secao: "assinar", rotulo: "Nome da noiva", placeholder: "", regra: "travado", obrigatorio: false, porque: "Basta um dos dois nomes, o contrato precisa dele" },
  { id: "cpfNoivo", secao: "assinar", rotulo: "CPF do noivo", placeholder: "000.000.000-00", regra: "opcional", obrigatorio: false },
  { id: "cpfNoiva", secao: "assinar", rotulo: "CPF da noiva", placeholder: "000.000.000-00", regra: "opcional", obrigatorio: false },
  { id: "contato", secao: "assinar", rotulo: "WhatsApp", placeholder: "", regra: "travado", obrigatorio: true, porque: "Sempre pedido, é por onde você manda o contrato" },
  { id: "email", secao: "assinar", rotulo: "E-mail", placeholder: "", regra: "travado", obrigatorio: true, porque: "Sempre pedido, a assinatura do contrato usa" },
  { id: "cep", secao: "endereco", rotulo: "CEP", placeholder: "00000-000", regra: "livre", obrigatorio: true },
  { id: "numero", secao: "endereco", rotulo: "Número", placeholder: "", regra: "livre", obrigatorio: true },
  { id: "endereco", secao: "endereco", rotulo: "Endereço", placeholder: "Rua, avenida...", regra: "livre", obrigatorio: true },
  { id: "complemento", secao: "endereco", rotulo: "Complemento", placeholder: "", regra: "livre", obrigatorio: false },
  { id: "bairro", secao: "endereco", rotulo: "Bairro", placeholder: "", regra: "livre", obrigatorio: true },
  { id: "cidade", secao: "endereco", rotulo: "Cidade", placeholder: "", regra: "livre", obrigatorio: true },
  { id: "estado", secao: "endereco", rotulo: "Estado", placeholder: "UF", regra: "livre", obrigatorio: true },
  { id: "data", secao: "evento", rotulo: "Data do casamento", placeholder: "", regra: "travado", obrigatorio: true, porque: "Sempre pedida, é ela que separa um casal do outro" },
  { id: "horario", secao: "evento", rotulo: "Horário", placeholder: "", regra: "livre", obrigatorio: true },
  { id: "local", secao: "evento", rotulo: "Local do evento", placeholder: "Nome do espaço ou endereço", regra: "livre", obrigatorio: true },
];

export const DEFINICAO: Record<CampoFixoId, DefinicaoCampo> = Object.fromEntries(
  CAMPOS_FIXOS.map((c) => [c.id, c]),
) as Record<CampoFixoId, DefinicaoCampo>;

/* data e hora não têm onde mostrar texto de exemplo (o navegador desenha o
   próprio controle), e o WhatsApp é formatado pelo plugin de DDI */
export const SEM_PLACEHOLDER: readonly CampoFixoId[] = ["data", "horario", "contato"];

export type AjusteCampo = { rotulo: string; placeholder: string; visivel: boolean; obrigatorio: boolean };

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
  /** só pro tipo "escolha" */
  opcoes: string[];
};

export type Formulario = {
  campos: Record<CampoFixoId, AjusteCampo>;
  perguntas: Pergunta[];
};

/** O que fica gravado no cliente: a resposta com a pergunta do momento. */
export type RespostaFormulario = { id: string; rotulo: string; tipo: TipoPergunta; valor: string };

export const LIMITES = {
  rotulo: 120,
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
  return { rotulo: def.rotulo, placeholder: def.placeholder, visivel: true, obrigatorio: def.obrigatorio };
}

export function formularioPadrao(): Formulario {
  return {
    campos: Object.fromEntries(CAMPOS_FIXOS.map((d) => [d.id, ajustePadrao(d)])) as Record<CampoFixoId, AjusteCampo>,
    perguntas: [],
  };
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
    /* opção vazia fica enquanto é digitada (é a linha nova do editor) */
    opcoes,
  };
}

/** Lê qualquer coisa e devolve um formulário válido, com as travas aplicadas. */
export function normalizarFormulario(bruto: unknown): Formulario {
  const b = obj(bruto);
  const campos = obj(b.campos);
  const saida = formularioPadrao();

  for (const def of CAMPOS_FIXOS) {
    const c = obj(campos[def.id]);
    const rotulo = texto(c.rotulo, LIMITES.rotulo);
    saida.campos[def.id] = {
      /* rótulo apagado volta pro padrão: campo sem nome no /cadastro não tem
         como ser preenchido */
      rotulo: rotulo || def.rotulo,
      placeholder: SEM_PLACEHOLDER.includes(def.id) ? "" : (typeof c.placeholder === "string" ? texto(c.placeholder, LIMITES.placeholder) : def.placeholder),
      visivel: def.regra === "travado" ? true : c.visivel !== false,
      obrigatorio:
        def.regra === "travado" ? def.obrigatorio
        : def.regra === "opcional" ? false
        : typeof c.obrigatorio === "boolean" ? c.obrigatorio : def.obrigatorio,
    };
  }

  const vistos = new Set<string>();
  saida.perguntas = (Array.isArray(b.perguntas) ? b.perguntas : [])
    .map(normalizarPergunta)
    .filter((p): p is Pergunta => !!p && !vistos.has(p.id) && !!vistos.add(p.id))
    .slice(0, LIMITES.perguntas);

  return saida;
}

/* ---------- uso no /cadastro e na rota ---------- */

/** O campo fixo é exigido no envio? (nomes seguem a regra do par, à parte) */
export function campoExigido(f: Formulario, id: CampoFixoId): boolean {
  const c = f.campos[id];
  return c.visivel && c.obrigatorio;
}

/** Perguntas que o casal vê: as que têm texto e, se forem de escolha, opções. */
export function perguntasVisiveis(f: Formulario): Pergunta[] {
  return f.perguntas.filter((p) => p.rotulo && (p.tipo !== "escolha" || p.opcoes.some(Boolean)));
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

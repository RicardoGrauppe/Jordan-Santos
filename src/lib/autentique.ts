import "server-only";
/*
  Cliente da API GraphQL da Autentique (v2), que desde 21/10/2026 é quem coleta
  as assinaturas do contrato. Antes isso era uma tela nossa (/assinar) com pad
  de assinatura, trilha de auditoria e PDF carimbado por nós.

  Docs: https://docs.autentique.com.br/api

  Portado do cliente que já roda no CRM da Nexus (server/services/autentique.ts),
  com três diferenças que são deste produto:
  - locale pt-BR, fuso de São Paulo e data DD/MM/AAAA (lá é cliente nos EUA);
  - sem exigir CPF nem data de nascimento (decisão do Ricardo em 21/10/2026: o
    fotógrafo atende gente sem CPF, e o número que importa já vem do cadastro
    pro corpo do contrato);
  - `reply_to` e o nome do remetente saem da CONTA da chave, que é a do próprio
    Jordan. É isso que faz o casal receber o pedido em nome dele.

  Ordem de assinatura (`sortable: true`): o fotógrafo é o primeiro signatário e
  a própria plataforma assina por ele no envio (`signDocument`, que não manda
  e-mail pro dono da chave); o casal é o segundo e só então é chamado.

  Entrega POR E-MAIL + link (desde 22/10/2026, no fim do dia): a Autentique
  manda o e-mail de assinatura pro casal E o painel pega o link com
  `createLinkToSignature`, pra o fotógrafo também mandar no WhatsApp. No modo
  e-mail a criação devolve `link: null`; foi isso que levou ao modo só-link de
  manhã, até achar essa mutation. Medido em sandbox: o e-mail sai de verdade
  (enviado e entregue em 2s), e `email_events` diz enviado/entregue/aberto/
  recusado com o motivo (o primeiro teste voltou com "caixa cheia").

  Cota: o plano gratuito dá 20 documentos por mês (lido da própria conta em
  22/10/2026: `me.subscription.documents`), renovando no dia do `ends_at`.
  `AUTENTIQUE_SANDBOX=true` cria documento de teste, que não gasta cota e some
  em alguns dias. Ver `cotaDocumentos()`.
*/
import { createHmac, timingSafeEqual } from "node:crypto";

const ENDPOINT = "https://api.autentique.com.br/v2/graphql";

export type EventosEmail = {
  sent: string | null;
  delivered: string | null;
  opened: string | null;
  refused: string | null;
  reason: string | null;
};

export type AssinaturaAutentique = {
  public_id: string;
  email_events?: EventosEmail | null;
  delivery_method?: string | null;
  name: string | null;
  email: string | null;
  action: { name: string } | null;
  link: { short_link: string | null } | null;
  viewed: { created_at: string } | null;
  signed: { created_at: string } | null;
  rejected: { created_at: string } | null;
};

export type DocumentoAutentique = {
  id: string;
  name: string;
  files: { original: string | null; signed: string | null } | null;
  signatures: AssinaturaAutentique[];
};

function chave(): string {
  const t = process.env.AUTENTIQUE_API_TOKEN?.trim() ?? "";
  if (!t) {
    throw new Error(
      "AUTENTIQUE_API_TOKEN não configurado. Gere a chave no painel da Autentique (menu API) e ponha no .env.local.",
    );
  }
  return t;
}

/** Sem chave, o painel some com o botão de enviar em vez de dar erro na cara. */
export function configurada(): boolean {
  return Boolean(process.env.AUTENTIQUE_API_TOKEN?.trim());
}

export function ehSandbox(): boolean {
  return process.env.AUTENTIQUE_SANDBOX?.trim().toLowerCase() === "true";
}

async function lerGraphql<T>(res: Response): Promise<T> {
  const corpo = (await res.json().catch(() => null)) as
    | { data?: T; errors?: { message: string; extensions?: { validation?: Record<string, string[]> } }[] }
    | null;
  if (!res.ok || !corpo || corpo.errors?.length || !corpo.data) {
    /* "validation" sozinho não diz nada: o detalhe vem em extensions, campo
       por campo (medido em 22/10/2026: e-mail com "+" volta como
       signer.email: format_is_invalid) */
    const validacao = corpo?.errors?.flatMap((e) =>
      Object.entries(e.extensions?.validation ?? {}).map(([campo, motivos]) => campo + ": " + motivos.join(", ")));
    if (validacao?.some((v) => /email/.test(v) && /format/.test(v))) {
      throw new Error("a Autentique não aceitou esse e-mail. Confira se está certo (ela não aceita e-mail com \"+\")");
    }
    const msg = validacao?.length
      ? "validação (" + validacao.join("; ") + ")"
      : corpo?.errors?.map((e) => e.message).join("; ") || "HTTP " + res.status;
    throw new Error("Autentique: " + msg);
  }
  return corpo.data;
}

async function gql<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { Authorization: "Bearer " + chave(), "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  return lerGraphql<T>(res);
}

let contaEmCache: { nome: string; email: string } | null = null;

/** Conta dona da chave: é ela que assina pelo fotógrafo e aparece como remetente. */
export async function conta(): Promise<{ nome: string; email: string }> {
  if (contaEmCache) return contaEmCache;
  const d = await gql<{ me: { name: string | null; email: string | null } }>("query { me { name email } }");
  if (!d.me?.email) throw new Error("Autentique: a conta da chave de API não tem e-mail");
  contaEmCache = { nome: d.me.name ?? "Estúdio", email: d.me.email };
  return contaEmCache;
}

const CAMPOS_ASSINATURA = `
  public_id
  name
  email
  action { name }
  link { short_link }
  viewed { created_at }
  signed { created_at }
  rejected { created_at }
  delivery_method
  email_events { sent delivered opened refused reason }
`;

/**
 * Sobe o PDF e cadastra os signatários NA ORDEM do array (fotógrafo, depois o
 * casal). O upload segue o graphql-multipart-request-spec: `operations`, `map`
 * e o arquivo em si.
 */
export async function criarDocumento(entrada: {
  titulo: string;
  pdf: Uint8Array;
  signatarios: { nome: string; email: string }[];
  mensagem?: string;
  responderPara?: string;
}): Promise<DocumentoAutentique> {
  const sandbox = ehSandbox();
  const query = `
    mutation CriarDocumento($document: DocumentInput!, $signers: [SignerInput!]!, $file: Upload!) {
      createDocument(sandbox: ${sandbox}, document: $document, signers: $signers, file: $file) {
        id
        name
        files { original signed }
        signatures { ${CAMPOS_ASSINATURA} }
      }
    }
  `;
  const variables = {
    document: {
      name: entrada.titulo,
      ...(entrada.mensagem ? { message: entrada.mensagem } : {}),
      refusable: true,
      sortable: true,
      new_signature_style: true,
      /* decisão de 21/10/2026: nada de CPF nem nascimento na hora de assinar */
      ignore_cpf: true,
      ignore_birthdate: true,
      ...(entrada.responderPara ? { reply_to: entrada.responderPara } : {}),
      locale: {
        country: "BR",
        language: "pt-BR",
        timezone: "America/Sao_Paulo",
        date_format: "DD_MM_YYYY",
      },
    },
    /* ENTREGA POR E-MAIL: a Autentique avisa o casal. O link pra copiar vem
       depois, de `linkDoSignatario` (aqui ele volta nulo). */
    signers: entrada.signatarios.map((s) => ({
      name: s.nome,
      email: s.email,
      action: "SIGN",
      delivery_method: "DELIVERY_METHOD_EMAIL",
    })),
    file: null,
  };

  const form = new FormData();
  form.append("operations", JSON.stringify({ query, variables }));
  form.append("map", JSON.stringify({ file: ["variables.file"] }));
  const nomeArquivo = entrada.titulo.toLowerCase().endsWith(".pdf") ? entrada.titulo : entrada.titulo + ".pdf";
  form.append("file", new Blob([new Uint8Array(entrada.pdf)], { type: "application/pdf" }), nomeArquivo);

  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { Authorization: "Bearer " + chave() },
    body: form,
  });
  const d = await lerGraphql<{ createDocument: DocumentoAutentique }>(res);
  return d.createDocument;
}

export async function buscarDocumento(id: string): Promise<DocumentoAutentique> {
  /* id inline como no exemplo oficial (o tipo do argumento não é documentado);
     só aceita caractere de id pra não abrir injeção na query */
  if (!/^[A-Za-z0-9-]+$/.test(id)) throw new Error("Autentique: id de documento inválido");
  const d = await gql<{ document: DocumentoAutentique }>(
    `query {
      document(id: "${id}") {
        id
        name
        files { original signed }
        signatures { ${CAMPOS_ASSINATURA} }
      }
    }`,
  );
  return d.document;
}

/**
 * Assina como a conta dona da chave, que aqui é o próprio fotógrafo. A
 * Autentique não manda e-mail pro dono pedindo que ele assine o próprio
 * documento, então isto fecha a vez dele e chama o casal na hora.
 */
export async function assinarComoDono(id: string): Promise<boolean> {
  const d = await gql<{ signDocument: boolean | null }>(
    "mutation ($id: UUID!) { signDocument(id: $id) }",
    { id },
  );
  return Boolean(d.signDocument);
}

/**
 * Link de assinatura de um signatário no modo e-mail, onde a criação não
 * devolve link. A Autentique gera (ou devolve o mesmo) `short_link`.
 */
export async function linkDoSignatario(publicId: string): Promise<string | null> {
  const d = await gql<{ createLinkToSignature: { short_link: string | null } | null }>(
    "mutation ($p: UUID!) { createLinkToSignature(public_id: $p) { short_link } }",
    { p: publicId },
  );
  return d.createLinkToSignature?.short_link ?? null;
}

/** Manda de novo o e-mail de assinatura (signatário em modo e-mail). */
export async function reenviarEmail(publicId: string): Promise<boolean> {
  const d = await gql<{ resendSignatures: boolean | null }>(
    "mutation ($ids: [UUID]) { resendSignatures(public_ids: $ids) }",
    { ids: [publicId] },
  );
  return Boolean(d.resendSignatures);
}

/**
 * Recria o signatário com o MESMO e-mail (a Autentique recusa dois iguais,
 * "signer_already_exists"): aqui não dá pra criar antes de apagar. Serve pra
 * tirar do modo link quem foi criado antes de a entrega voltar a ser por
 * e-mail. Se a criação falhar, tenta de novo uma vez antes de desistir.
 */
export async function recriarSignatario(
  documentoId: string,
  publicIdAntigo: string,
  pessoa: { nome: string; email: string },
): Promise<AssinaturaAutentique> {
  await gql<{ deleteSigner: boolean | null }>(
    "mutation ($pid: UUID!, $doc: UUID!) { deleteSigner(public_id: $pid, document_id: $doc) }",
    { pid: publicIdAntigo, doc: documentoId },
  );
  const criar = () => gql<{ createSigner: AssinaturaAutentique }>(
    `mutation ($doc: UUID!, $signer: SignerInput!) {
      createSigner(document_id: $doc, signer: $signer) { ${CAMPOS_ASSINATURA} }
    }`,
    { doc: documentoId, signer: { name: pessoa.nome, email: pessoa.email, action: "SIGN", delivery_method: "DELIVERY_METHOD_EMAIL" } },
  );
  const d = await criar().catch(() => criar());
  return d.createSigner;
}

/**
 * Troca quem assina sem trocar o documento (22/10/2026): tira o signatário
 * antigo e põe um novo, com o e-mail certo, no mesmo documento. A assinatura
 * de quem já assinou (o fotógrafo) fica, o PDF é o mesmo e não gasta cota,
 * que só conta documento criado. O link do signatário novo é outro; o antigo
 * deixa de valer junto com o signatário.
 *
 * Cria primeiro e apaga depois: se a criação falhar, o casal continua com o
 * link de antes em vez de ficar sem ninguém pra assinar.
 */
export async function trocarSignatario(
  documentoId: string,
  publicIdAntigo: string,
  novo: { nome: string; email: string },
): Promise<AssinaturaAutentique> {
  const d = await gql<{ createSigner: AssinaturaAutentique }>(
    `mutation ($doc: UUID!, $signer: SignerInput!) {
      createSigner(document_id: $doc, signer: $signer) { ${CAMPOS_ASSINATURA} }
    }`,
    {
      doc: documentoId,
      signer: { name: novo.nome, email: novo.email, action: "SIGN", delivery_method: "DELIVERY_METHOD_EMAIL" },
    },
  );
  await gql<{ deleteSigner: boolean | null }>(
    "mutation ($pid: UUID!, $doc: UUID!) { deleteSigner(public_id: $pid, document_id: $doc) }",
    { pid: publicIdAntigo, doc: documentoId },
  );
  return d.createSigner;
}

/**
 * Apaga o documento na Autentique. É o que impede o casal de assinar um
 * contrato que o fotógrafo cancelou aqui: sem isso o link curto continuaria
 * de pé, e um contrato cancelado no painel poderia voltar assinado.
 */
export async function apagarDocumento(id: string): Promise<boolean> {
  const d = await gql<{ deleteDocument: boolean | null }>(
    "mutation ($id: UUID!) { deleteDocument(id: $id) }",
    { id },
  );
  return Boolean(d.deleteDocument);
}

export async function baixarAssinado(doc: DocumentoAutentique): Promise<Uint8Array> {
  const url = doc.files?.signed;
  if (!url) throw new Error("Autentique: PDF assinado ainda não disponível");
  const res = await fetch(url, { headers: { Authorization: "Bearer " + chave() } });
  if (!res.ok) throw new Error("Autentique: falha ao baixar o PDF assinado (HTTP " + res.status + ")");
  return new Uint8Array(await res.arrayBuffer());
}

/**
 * Valida o cabeçalho x-autentique-signature (HMAC-SHA256 do corpo cru). Sem
 * segredo configurado, aceita: a rota não confia no corpo, ela só pega o id e
 * pergunta de novo pra Autentique, então um aviso falso não muda status nenhum.
 */
export function webhookConfere(corpoCru: string, assinatura: string | undefined): boolean {
  const segredos = [
    process.env.AUTENTIQUE_WEBHOOK_SECRET_DOCUMENTO,
    process.env.AUTENTIQUE_WEBHOOK_SECRET_ASSINATURA,
  ]
    .map((v) => v?.trim())
    .filter((v): v is string => Boolean(v));
  if (segredos.length === 0) return true;
  if (!assinatura) return false;
  const recebida = Buffer.from(assinatura.trim());
  return segredos.some((segredo) => {
    const esperada = Buffer.from(createHmac("sha256", segredo).update(corpoCru).digest("hex"));
    return esperada.length === recebida.length && timingSafeEqual(esperada, recebida);
  });
}

/** Tira o id do documento de um evento de webhook (document.* ou signature.*). */
export function idDoWebhook(payload: unknown): string | null {
  const obj = (payload as { event?: { data?: { object?: Record<string, unknown> } } })?.event?.data?.object;
  if (!obj) return null;
  const doc = obj.document as { id?: string } | string | undefined;
  if (typeof doc === "string") return doc;
  if (doc?.id) return doc.id;
  return typeof obj.id === "string" ? obj.id : null;
}

export type CotaAutentique = {
  plano: string;
  /** documentos que o plano dá por ciclo */
  total: number;
  /** documentos de verdade (fora do sandbox) criados neste ciclo */
  usados: number;
  restantes: number;
  /** quando o ciclo vira (ISO) */
  renovaEm: string | null;
};

let cotaEmCache: { em: number; valor: CotaAutentique } | null = null;

/* "2026-11-09T20:17:18.000000Z" e "2026-07-10 12:00:00": os dois formatos
   que a API devolve, normalizados pro Date entender */
function data(v: string): Date {
  return new Date(v.replace(" ", "T").replace(/\.\d+Z$/, "Z"));
}

/**
 * Quanto ainda dá pra criar neste ciclo. A API não entrega "restantes": a
 * assinatura diz o TOTAL do plano (`documents`) e quando o ciclo acaba
 * (`ends_at`), e os usados são contados na lista de documentos da conta,
 * do início do ciclo (um mês antes do `ends_at`) até agora. Documento
 * apagado some da lista, então a conta pode sair otimista nesse caso.
 * Cache de 1 minuto: abrir pop-up não pode gastar o rate limit (60/min).
 */
export async function cotaDocumentos(): Promise<CotaAutentique> {
  if (cotaEmCache && Date.now() - cotaEmCache.em < 60_000) return cotaEmCache.valor;
  const d = await gql<{ me: { subscription: { name: string | null; documents: number | null; ends_at: string | null } | null } }>(
    "query { me { subscription { name documents ends_at } } }",
  );
  const sub = d.me?.subscription;
  const total = Number(sub?.documents) || 0;
  const fim = sub?.ends_at ? data(sub.ends_at) : null;
  const inicio = fim ? new Date(fim) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  if (fim) inicio.setMonth(inicio.getMonth() - 1);

  let usados = 0;
  for (let pagina = 1; pagina <= 5; pagina++) {
    const r = await gql<{ documents: { data: { created_at: string; sandbox: boolean | null }[] } }>(
      "query ($p: Int!) { documents(limit: 60, page: $p) { data { created_at sandbox } } }",
      { p: pagina },
    );
    const lista = r.documents?.data || [];
    let passou = false;
    for (const doc of lista) {
      const quando = data(doc.created_at);
      if (quando < inicio) { passou = true; continue; }
      if (!doc.sandbox) usados++;
    }
    if (passou || lista.length < 60) break;
  }

  const valor: CotaAutentique = {
    plano: sub?.name || "",
    total,
    usados,
    restantes: Math.max(0, total - usados),
    renovaEm: fim ? fim.toISOString() : null,
  };
  cotaEmCache = { em: Date.now(), valor };
  return valor;
}

import "server-only";
/*
  Ponte entre o contrato do estúdio e o documento na Autentique.

  Mora aqui, e não na rota, porque três caminhos precisam dela: o envio (painel),
  a sincronização sob demanda (painel abrindo a ficha) e o webhook. Se cada um
  escrevesse o seu, os três divergiriam na primeira mudança de regra.

  O ESTADO CONTINUA NAS COLUNAS DE SEMPRE (`status`, `visualizado_em`,
  `assinado_em`, `pdf_base64`...). A Autentique é a fonte, mas quem lê é o
  painel inteiro, que não precisa saber que ela existe. Só `autentique_id`,
  `autentique_link` e a dupla de recusa são novas.

  A recusa cai em `status: cancelado` + `recusado_em`, porque o CHECK da tabela
  não tem "recusado" e inventar um estado novo mexeria em toda a tradução de
  rótulo, cor e filtro do painel. O motivo fica em `recusa_motivo`.
*/
import { rest } from "@/lib/supabase";
import { montarPdfDoContrato, type LinhaParaPdf } from "@/lib/contrato-pdf/montar";
import {
  apagarDocumento, assinarComoDono, baixarAssinado, buscarDocumento, conta, criarDocumento, ehSandbox,
  adicionarSignatario, linkDoSignatario, recriarSignatario, reenviarEmail, trocarSignatario,
  type DocumentoAutentique,
} from "@/lib/autentique";

export type LinhaContratoAutentique = LinhaParaPdf & {
  id: string;
  status: string;
  jordan_confirmado_em?: string | null;
  autentique_id?: string | null;
  autentique_link?: string | null;
  visualizado_em?: string | null;
  assinado_em?: string | null;
  pdf_base64?: string | null;
  autentique_hash?: string | null;
  autentique_email?: unknown;
  snapshot?: unknown;
};

export type ContatoCasal = { nome: string; email: string };

async function sha256hex(bytes: Uint8Array): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new Uint8Array(bytes));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Impressão digital do que vai pra Autentique: o texto do contrato e os dados
 * do casal. Calculado SEMPRE a partir da linha lida do banco (nunca do corpo
 * de um pedido), pra o "na hora do envio" e o "agora" virem da mesma fonte e
 * da mesma serialização do jsonb.
 */
export async function hashDoConteudo(c: { template_json_snapshot?: unknown; snapshot?: unknown }): Promise<string> {
  const bruto = new TextEncoder().encode(JSON.stringify({ t: c.template_json_snapshot ?? null, s: c.snapshot ?? null }));
  return sha256hex(bruto);
}

/** A assinatura do CASAL dentro do documento: é a que não é a da conta dona. */
function assinaturaDoCasal(doc: DocumentoAutentique, emailDaConta: string) {
  const alvo = (doc.signatures || []).filter(
    (s) => (s.email || "").toLowerCase() !== emailDaConta.toLowerCase(),
  );
  return alvo[alvo.length - 1] || null;
}

/** Erro de dado (não de rede): a rota responde 409 com a mensagem como está. */
export class ErroEnvioAutentique extends Error {}

/* O casal com o MESMO e-mail da conta do fotógrafo na Autentique (comum em
   teste, ou e-mail copiado errado) vira um signatário só: a Autentique junta
   os dois, o documento nasce só com o fotógrafo, já assinado, gasta um
   documento da cota e o casal fica sem link. Medido em 22/10/2026. Barra
   ANTES de criar o documento. */
async function exigirEmailDoCasal(casal: ContatoCasal): Promise<void> {
  const dono = await conta();
  if (casal.email.trim().toLowerCase() === dono.email.trim().toLowerCase()) {
    throw new ErroEnvioAutentique(
      "o e-mail do casal é o mesmo da sua conta na Autentique (" + dono.email + "); troque pelo e-mail do casal na ficha",
    );
  }
}

/**
 * Sobe o contrato pra Autentique e já assina pelo fotógrafo, deixando o casal
 * como o próximo da fila. Devolve o link curto dele, que é o que o painel
 * manda por WhatsApp (a Autentique também avisa por e-mail).
 */
export async function enviarParaAssinatura(
  c: LinhaContratoAutentique,
  casal: ContatoCasal,
): Promise<{ link: string | null; documento: DocumentoAutentique }> {
  await exigirEmailDoCasal(casal);
  const dono = await conta();

  /* PDF sem a nossa folha de comprovante: quem comprova agora é a Autentique.
     O signatário fica em branco de propósito: o nome só existe depois que
     alguém assina, e escrever o do casal aqui imprimiria um rótulo de
     assinatura embaixo de uma linha vazia. */
  const pdf = await montarPdfDoContrato(c, {
    signatario: { nome: "", cpf: "", email: casal.email },
    assinadoEm: new Date(),
    semComprovante: true,
  });

  /* O título vira o assunto e o cabeçalho do e-mail da Autentique; a
     mensagem é o texto que o casal lê no corpo dele, no lugar do texto
     padrão dela (22/10/2026, pedido do Ricardo). Primeiros nomes, sem
     travessão (TOM-DE-VOZ.md), e assinado com o nome completo do fotógrafo. */
  const primeiros = (casal.nome || "").split(" e ").map((n) => n.trim().split(/\s+/)[0]).filter(Boolean);
  const titulo = "Contrato de fotografia" + (primeiros.length ? " (" + primeiros.join(" e ") + ")" : "");
  const dois = primeiros.length > 1;
  const mensagem =
    "Oi" + (primeiros.length ? ", " + primeiros.join(" e ") : "") + "! Aqui é o " + dono.nome + ". " +
    "Este é o contrato da cobertura fotográfica do casamento" + (dois ? " de vocês" : "") + ". " +
    "É só abrir, conferir os dados e assinar: leva uns 2 minutinhos e dá pra fazer pelo celular." +
    (dois ? " Basta um de vocês assinar." : "") +
    " Qualquer dúvida, é só me chamar.";
  const documento = await criarDocumento({
    titulo,
    mensagem,
    pdf,
    /* ordem importa: o fotógrafo é o primeiro e assina na linha abaixo, então
       o casal só é chamado com o documento já assinado por ele */
    signatarios: [
      { nome: dono.nome, email: dono.email },
      { nome: casal.nome || "Contratante", email: casal.email },
    ],
    responderPara: dono.email,
  });

  await assinarComoDono(documento.id);

  /* relê depois de assinar: é aí que o casal passa a ser a vez. No modo
     e-mail o link não vem junto; pede à parte pra o painel ter o que copiar */
  const atualizado = await buscarDocumento(documento.id).catch(() => documento);
  const sigCasal = assinaturaDoCasal(atualizado, dono.email);
  const link = sigCasal?.link?.short_link
    ?? (sigCasal ? await linkDoSignatario(sigCasal.public_id).catch(() => null) : null);

  const agora = new Date().toISOString();
  await rest("contratos?id=eq." + c.id, {
    method: "PATCH",
    body: {
      autentique_id: documento.id,
      autentique_link: link,
      autentique_sandbox: ehSandbox(),
      autentique_hash: await hashDoConteudo(c),
      /* documento novo: o e-mail do anterior não vale pra este */
      autentique_email: null,
      status: "enviado",
      enviado_em: agora,
      /* documento novo começa do zero: o "visto" do documento anterior não
         vale pra este */
      visualizado_em: null,
      /* desde 22/10/2026 o fotógrafo não assina mais dentro do app: o clique
         em "Assinar e enviar" É a assinatura dele, feita na Autentique */
      jordan_confirmado_em: agora,
    },
  });

  return { link, documento: atualizado };
}

/**
 * Atualizar um contrato já enviado. A Autentique não troca o PDF de um
 * documento existente, então isto APAGA o de lá e cria outro: link novo pro
 * casal, um documento a mais da cota, e o fotógrafo reassina sozinho.
 * Quem chama confirma isso com a pessoa antes (ver o painel).
 */
export async function substituirNaAutentique(
  c: LinhaContratoAutentique,
  casal: ContatoCasal,
): Promise<{ link: string | null; documento: DocumentoAutentique }> {
  /* antes de apagar o de lá: barrado aqui, o documento atual continua de pé */
  await exigirEmailDoCasal(casal);
  if (c.autentique_id) {
    try { await apagarDocumento(c.autentique_id); }
    catch (e) { console.error("autentique: não deu pra apagar o documento antigo:", (e as Error).message); }
  }
  return enviarParaAssinatura({ ...c, autentique_id: null, autentique_link: null }, casal);
}

/**
 * O e-mail do casal estava errado: troca o signatário NO MESMO documento
 * (ver trocarSignatario). Sem documento novo, então sem gastar cota e sem
 * mexer na assinatura do fotógrafo. Devolve o link novo do casal.
 */
export async function trocarEmailDoCasal(
  c: LinhaContratoAutentique,
  casal: ContatoCasal,
): Promise<{ link: string | null }> {
  if (!c.autentique_id) throw new Error("este contrato ainda não foi pra Autentique");
  const dono = await conta();
  if (casal.email.toLowerCase() === dono.email.toLowerCase()) {
    throw new Error("esse é o e-mail da sua conta na Autentique; use o e-mail do casal");
  }
  const doc = await buscarDocumento(c.autentique_id);
  const antiga = assinaturaDoCasal(doc, dono.email);
  /* documento sem o casal (nasceu com o e-mail do casal igual ao da conta):
     não há o que trocar, então põe o casal agora, no mesmo documento */
  if (!antiga) {
    try {
      const nova = await adicionarSignatario(doc.id, { nome: casal.nome || "Contratante", email: casal.email });
      const link = nova.link?.short_link ?? await linkDoSignatario(nova.public_id).catch(() => null);
      if (link) await rest("contratos?id=eq." + c.id, { method: "PATCH", body: { autentique_link: link } });
      return { link };
    } catch (e) {
      console.error("autentique: não deu pra pôr o casal no documento:", (e as Error).message);
      throw new Error("a Autentique não aceitou pôr o casal neste documento; use \"Atualizar na Autentique\" pra mandar um novo");
    }
  }
  if (antiga.signed?.created_at) throw new Error("o casal já assinou, não dá mais pra trocar o e-mail");
  /* mesmo e-mail: é reenvio. Em modo e-mail, a Autentique manda de novo; em
     modo link (contratos de antes de a entrega voltar a ser por e-mail),
     recria o signatário em modo e-mail pra ela mandar. */
  if ((antiga.email || "").toLowerCase() === casal.email.toLowerCase()) {
    if (antiga.delivery_method === "DELIVERY_METHOD_EMAIL") {
      await reenviarEmail(antiga.public_id);
      const link = antiga.link?.short_link ?? await linkDoSignatario(antiga.public_id).catch(() => null);
      return { link };
    }
    const recriada = await recriarSignatario(doc.id, antiga.public_id, { nome: casal.nome || "Contratante", email: casal.email });
    return { link: recriada.link?.short_link ?? await linkDoSignatario(recriada.public_id).catch(() => null) };
  }
  const nova = await trocarSignatario(doc.id, antiga.public_id, { nome: casal.nome || "Contratante", email: casal.email });
  let link = nova.link?.short_link ?? await linkDoSignatario(nova.public_id).catch(() => null);
  if (!link) {
    const atual = await buscarDocumento(doc.id).catch(() => null);
    link = (atual && assinaturaDoCasal(atual, dono.email)?.link?.short_link) ?? null;
  }
  return { link };
}

/**
 * Pergunta o estado à Autentique e escreve nas colunas de sempre. Devolve o
 * contrato como ficou (ou null quando não há o que sincronizar), pra quem
 * chamou responder sem uma segunda consulta.
 */
export async function sincronizarContrato(
  c: LinhaContratoAutentique,
): Promise<{ status: string; link: string | null } | null> {
  if (!c.autentique_id) return null;

  const dono = await conta();
  const doc = await buscarDocumento(c.autentique_id);
  const casal = assinaturaDoCasal(doc, dono.email);
  if (!casal) return null;

  const mudanca: Record<string, unknown> = {};
  const link = casal.link?.short_link ?? null;
  if (link && link !== c.autentique_link) mudanca.autentique_link = link;
  /* status do e-mail que a Autentique mandou pro casal (entregue, aberto,
     recusado e por quê): vira a linha embaixo de "Enviado ao casal" */
  const ev = casal.email_events;
  if (ev && JSON.stringify(ev) !== JSON.stringify(c.autentique_email ?? null)) mudanca.autentique_email = ev;

  if (casal.rejected?.created_at && c.status !== "cancelado") {
    mudanca.status = "cancelado";
    mudanca.recusado_em = casal.rejected.created_at;
    mudanca.recusa_motivo = "recusado pelo contratante na Autentique";
  } else if (casal.signed?.created_at) {
    /* quem assinou abriu antes: quando a sincronização só chega depois da
       assinatura, o "aberto" ficava vazio na linha do tempo */
    if (!c.visualizado_em) mudanca.visualizado_em = casal.viewed?.created_at || casal.signed.created_at;
    if (c.status !== "assinado") {
      mudanca.status = "assinado";
      mudanca.assinado_em = casal.signed.created_at;
      mudanca.signatario_nome = casal.name || null;
      mudanca.signatario_email = casal.email || null;
      mudanca.verificacao_metodo = "autentique";
      mudanca.aceite_texto =
        "Assinado eletronicamente pela Autentique, com validação de identidade e trilha de auditoria própria.";
      mudanca.aceite_em = casal.signed.created_at;
    }
    /* a via assinada vira nossa também: o painel baixa do banco, sem depender
       de a Autentique estar no ar nem da chave continuar válida */
    if (!c.pdf_base64) {
      try {
        const bytes = await baixarAssinado(doc);
        mudanca.pdf_base64 = Buffer.from(bytes).toString("base64");
        mudanca.doc_sha256 = await sha256hex(bytes);
      } catch {
        /* ainda não disponível: a próxima sincronização pega */
      }
    }
  } else if (casal.viewed?.created_at) {
    if (!c.visualizado_em) mudanca.visualizado_em = casal.viewed.created_at;
    if (c.status === "enviado") mudanca.status = "visualizado";
  }

  if (Object.keys(mudanca).length) {
    await rest("contratos?id=eq." + c.id, { method: "PATCH", body: mudanca });
  }

  return {
    status: (mudanca.status as string) || c.status,
    link: (mudanca.autentique_link as string) || c.autentique_link || link,
  };
}

/** Caminho do webhook: acha o contrato pelo id do documento e sincroniza. */
export async function sincronizarPorDocumento(autentiqueId: string): Promise<boolean> {
  const linhas = await rest<LinhaContratoAutentique[]>(
    "contratos?autentique_id=eq." + encodeURIComponent(autentiqueId) +
    "&select=id,status,autentique_id,autentique_link,autentique_email,visualizado_em,assinado_em,snapshot,template_id,template_json_snapshot,jordan_assinatura_dataurl&limit=1",
  );
  const c = linhas && linhas[0];
  if (!c) return false;
  /* pdf_base64 fica de fora do select (coluna pesada); pergunta só se precisar */
  if (!c.pdf_base64) {
    const tem = await rest<{ id: string }[]>(
      "contratos?id=eq." + c.id + "&pdf_base64=not.is.null&select=id&limit=1",
    );
    c.pdf_base64 = tem && tem.length ? "ja-tem" : null;
  }
  await sincronizarContrato(c);
  return true;
}

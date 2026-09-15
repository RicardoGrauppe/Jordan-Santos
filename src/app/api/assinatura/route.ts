/*
  Assinatura eletrônica do contrato pelo casal (PÚBLICO — sem sessão; o token do link
  é a credencial). O fotógrafo gera o contrato no painel (no original: api/estudio.js
  "gerar-contrato"); o casal abre /assinar?token=… e assina.

  Portado de `api/assinatura.js` do estúdio do Jordan. É documento jurídico: nada
  aqui foi simplificado, e cada comentário de "por quê" veio junto de propósito.

  GET  ?token=…                         → obtém o contrato p/ renderizar; marca "visualizado"
  GET  ?token=…&pdf=1                   → devolve a via assinada em base64 (só depois de assinado)
  POST {acao:"assinar", token, aceite, assinaturaDataUrl, nomeSignatario, cpfSignatario}
       → valida o aceite, MONTA O PDF, calcula hash, grava auditoria + PDF,
         status "assinado", e-mail pras duas partes.

  O PDF é montado AQUI (2026-07-31). Antes o casal mandava o documento pronto:
  o assinar.html fotografava a tela com html2pdf/html2canvas e subia ~2,9 MB de
  imagem — sem texto selecionável, serrilhado, com quebra de página por pixel
  (linha cortada ao meio) e resultado variando conforme o aparelho. Agora o
  casal manda só o PNG da assinatura (~15 KB) e o servidor preenche um template
  vetorial (src/lib/contrato-pdf/), sempre igual, ~240 KB.

  Validade jurídica: assinatura eletrônica simples entre as partes (MP 2.200-2/2001
  art. 10 §2º; CC arts. 107 e 219). A trilha (aceite expresso, nome+CPF, IP, UA,
  timestamp do servidor, hash SHA-256) é o que sustenta autoria/integridade.

  NÃO há mais código por e-mail (OTP): removido em 2026-07-25 porque o estúdio não
  tem domínio verificado no Resend e o código nunca chegaria ao casal. O fator de
  verificação passou a ser a POSSE DO LINK (token de 32 bytes aleatórios, entregue
  pelo fotógrafo no WhatsApp do casal). Foi descartada a ideia de mandar o código junto
  na mensagem: quem entrega passaria a conhecer o código, então ele não provaria
  autoria nenhuma e a página de auditoria estaria afirmando algo falso.
*/
import { NextResponse } from "next/server";
import { rest, supabaseConfigurado } from "@/lib/supabase";
import { enviarEmail, DESTINO_JORDAN } from "@/lib/email";
import { textoCurto, normalizarCpf, criarLimite, ipDe } from "@/lib/util";
import { gerarContratoPdf, type SnapshotContrato } from "@/lib/contrato-pdf/gerar";
import { gerarContratoPdfDinamico } from "@/lib/contrato-pdf/gerar-pdfmake";

/* pdf-lib, pdfmake e Buffer: isto só roda em Node, nunca no runtime edge */
export const runtime = "nodejs";

/* mesmo teto que a rota do painel usa pra assinatura do fotógrafo */
const LIMITE_ASSINATURA_DATAURL = 500_000;
const ACEITE_TEXTO =
  "Declaro que li e concordo com os termos deste contrato e reconheço a validade da " +
  "minha assinatura eletrônica realizada por este meio (MP 2.200-2/2001, art. 10, §2º).";

/* throttle best-effort por IP na ação de assinar (janela de 15 min, 10 tentativas) */
const estourou = criarLimite(15 * 60_000, 10);

/* ---------- tipos das linhas que cada leitura pede ao PostgREST ---------- */

/** O snapshot congelado na geração também guarda o e-mail do casal. */
type Snapshot = SnapshotContrato & { email?: string | null };

type LinhaPdf = {
  status: string | null;
  pdf_base64: string | null;
  snapshot: Snapshot | null;
};

type LinhaLeitura = {
  status: string | null;
  expira_em: string | null;
  snapshot: Snapshot | null;
  jordan_assinatura_dataurl: string | null;
  jordan_assinatura_tipo: string | null;
  jordan_confirmado_em: string | null;
  versao: number | null;
  criado_em: string | null;
  enviado_em: string | null;
  visualizado_em: string | null;
  assinado_em: string | null;
  signatario_nome: string | null;
  signatario_cpf: string | null;
  signatario_email: string | null;
  assinante_ip: string | null;
  assinante_ua: string | null;
  doc_sha256: string | null;
  verificacao_metodo: string | null;
  template_id: string | null;
  template_html_snapshot: string | null;
};

/** `select=*,clientes(email)`: tudo da linha mais o e-mail do cliente vinculado. */
type LinhaAssinar = LinhaLeitura & {
  template_json_snapshot: unknown;
  clientes: { email?: string | null } | null;
} & Record<string, unknown>;

type LinhaTemplateHtml = { conteudo_html: string | null };
type LinhaTemplateJson = { conteudo_json: unknown };
type LinhaConfig = { valor: string | null };

function tokenValido(t: unknown): t is string {
  return typeof t === "string" && /^[A-Za-z0-9_-]{20,64}$/.test(t);
}

/** Objeto do corpo, ou {} quando veio outra coisa (o original lia `req.body || {}`). */
function objeto(valor: unknown): Record<string, unknown> {
  return valor && typeof valor === "object" ? (valor as Record<string, unknown>) : {};
}

/* Hash dos BYTES do PDF (2026-07-31). Antes era o hash da string base64, o que
   nunca batia com um `sha256sum` no arquivo baixado — agora bate, e qualquer
   perito confere a integridade da via sem depender do nosso código. Contratos
   assinados antes desta data guardam a semântica antiga; nada recomputa nem
   compara hash, o valor só é gravado e mandado no e-mail. */
async function sha256hex(bytes: Uint8Array): Promise<string> {
  /* `new Uint8Array(bytes)` copia os mesmos bytes pra um ArrayBuffer próprio:
     o `subtle.digest` do TypeScript recusa a view de um Buffer (que pode
     apontar pra memória compartilhada). O hash é dos mesmos bytes. */
  const buf = await crypto.subtle.digest("SHA-256", new Uint8Array(bytes));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}

/* `new Date(null)` é a época (0), então expira_em nulo conta como expirado,
   exatamente como no original */
function expirado(c: { expira_em: string | null }): boolean {
  return new Date(c.expira_em ?? 0) < new Date();
}

/* HTML do template FIXADO neste contrato, nunca o modelo vivo atual — editar
   o modelo depois não pode mudar o texto de um contrato já em andamento ou já
   assinado. Prefere o snapshot congelado na geração; só cai no join do modelo
   por template_id pra contratos antigos, gerados antes do snapshot existir.
   Sem nenhum dos dois: null, e a tela usa CONTRATO_TEMPLATE.html({modo}). */
async function templateHtmlDoContrato(
  c: { template_html_snapshot: string | null; template_id: string | null } | null,
): Promise<string | null> {
  if (c && c.template_html_snapshot) return c.template_html_snapshot;
  const templateId = c && c.template_id;
  if (!templateId) return null;
  try {
    const linhas = await rest<LinhaTemplateHtml[]>(
      "contrato_templates?id=eq." + templateId + "&select=conteudo_html&limit=1",
    );
    return (linhas && linhas[0] && linhas[0].conteudo_html) || null;
  } catch {
    return null;
  }
}

function emailDoContrato(c: LinhaAssinar): string | null {
  return (c.snapshot && c.snapshot.email) || (c.clientes && c.clientes.email) || null;
}

/* Assinatura padrão do fotógrafo (tabela config). A página que a editava
   (/configuracoes) saiu em 2026-07-28; isto é só fallback pra contrato sem a
   assinatura própria da revisão. Nada escreve mais nesta chave. */
async function preferenciasEstudio(): Promise<{ assinatura_jordan: string | null }> {
  try {
    const linhas = await rest<LinhaConfig[]>("config?chave=eq.assinatura_jordan&select=valor&limit=1");
    return { assinatura_jordan: (linhas && linhas[0] && linhas[0].valor) || null };
  } catch {
    return { assinatura_jordan: null };
  }
}

export async function GET(req: Request) {
  if (!supabaseConfigurado()) {
    return NextResponse.json({ erro: "indisponível no momento" }, { status: 503 });
  }

  const params = new URL(req.url).searchParams;

  /* ---------- GET ?pdf=1: baixar a via assinada ---------- */
  if (params.get("pdf")) {
    const token = params.get("token");
    if (!tokenValido(token)) return NextResponse.json({ erro: "link inválido" }, { status: 400 });
    /* select explícito e só aqui: o blob nunca vem junto nas outras leituras */
    const linhas = await rest<LinhaPdf[]>(
      "contratos?token=eq." + token + "&select=status,pdf_base64,snapshot&limit=1",
    );
    const c = linhas && linhas[0];
    if (!c) return NextResponse.json({ erro: "contrato não encontrado" }, { status: 404 });
    if (c.status !== "assinado" || !c.pdf_base64) {
      return NextResponse.json({ erro: "este contrato ainda não foi assinado" }, { status: 404 });
    }
    /* o nome do arquivo sai daqui porque quem volta depois de assinado não
       recebe mais o snapshot na tela (o GET normal devolve só o status) */
    const s: Snapshot = c.snapshot || {};
    const casal = [s.noivo, s.noiva].filter(Boolean).join(" e ");
    return NextResponse.json({
      pdf: c.pdf_base64,
      arquivo: "Contrato assinado" + (casal ? " - " + casal : "") + ".pdf",
    });
  }

  /* ---------- GET: obter o contrato p/ renderizar ---------- */
  const token = params.get("token");
  if (!tokenValido(token)) return NextResponse.json({ erro: "link inválido" }, { status: 400 });
  /* select ampliado (2026-09-01): a sidebar de /assinar (abas "Assinantes"/
     "Histórico", igual à do /revisar-contrato) mostra pro próprio casal a
     linha do tempo e — só depois de assinado — a trilha de auditoria. É o
     contrato DELES, atrás do link exclusivo; não é dado de terceiro. */
  const linhas = await rest<LinhaLeitura[]>(
    "contratos?token=eq." + token +
    "&select=status,expira_em,snapshot,jordan_assinatura_dataurl,jordan_assinatura_tipo," +
    "jordan_confirmado_em,versao,criado_em,enviado_em,visualizado_em,assinado_em," +
    "signatario_nome,signatario_cpf,signatario_email,assinante_ip,assinante_ua," +
    "doc_sha256,verificacao_metodo,template_id,template_html_snapshot&limit=1",
  );
  const c = linhas && linhas[0];
  if (!c) return NextResponse.json({ erro: "contrato não encontrado" }, { status: 404 });
  if (c.status === "cancelado") return NextResponse.json({ erro: "este contrato foi cancelado" }, { status: 410 });
  if (c.status === "rascunho") return NextResponse.json({ erro: "este contrato ainda não foi liberado por mim" }, { status: 404 });
  if (expirado(c)) return NextResponse.json({ erro: "este link expirou, me peça um novo" }, { status: 410 });
  /* O fotógrafo editou a ficha depois de liberar (2026-09-01): "atualizar" na
     rota do painel limpou jordan_confirmado_em pra ele reconfirmar sobre o
     conteúdo novo antes do casal poder assinar — sem essa checagem o casal
     assinaria uma versão que ele nunca revisou. */
  if (c.status !== "assinado" && !c.jordan_confirmado_em) {
    return NextResponse.json({ erro: "atualizei este contrato e preciso confirmar de novo antes de liberar" }, { status: 404 });
  }
  const meta = {
    status: c.status, versao: c.versao || 1, criado_em: c.criado_em,
    enviado_em: c.enviado_em, visualizado_em: c.visualizado_em, assinado_em: c.assinado_em,
    jordan_confirmado_em: c.jordan_confirmado_em, jordan_assinatura_tipo: c.jordan_assinatura_tipo,
    signatario_nome: c.signatario_nome, signatario_cpf: c.signatario_cpf,
    signatario_email: c.signatario_email, assinante_ip: c.assinante_ip,
    assinante_ua: c.assinante_ua, doc_sha256: c.doc_sha256, verificacao_metodo: c.verificacao_metodo,
  };
  const template_html = await templateHtmlDoContrato(c);
  if (c.status === "assinado") {
    return NextResponse.json({
      status: "assinado", contrato: c.snapshot || {}, meta: meta, template_html: template_html,
    });
  }
  if (c.status === "enviado") {
    try {
      await rest("contratos?token=eq." + token, {
        method: "PATCH",
        body: { status: "visualizado", visualizado_em: new Date().toISOString() },
      });
      meta.status = "visualizado";
      meta.visualizado_em = new Date().toISOString();
    } catch { /* não bloqueia a leitura */ }
  }
  /* preferências do estúdio (assinatura padrão do fotógrafo), pro contrato renderizar
     igual em qualquer dispositivo — best-effort, não bloqueia a leitura. A assinatura
     deste contrato específico (feita na revisão) tem prioridade sobre a padrão. */
  const estudio = await preferenciasEstudio();
  return NextResponse.json({
    status: "pronto",
    meta: meta,
    contrato: c.snapshot || {},
    estudio: estudio,
    jordanAssinatura: c.jordan_assinatura_dataurl || null,
    template_html: template_html,
  });
}

export async function POST(req: Request) {
  if (!supabaseConfigurado()) {
    return NextResponse.json({ erro: "indisponível no momento" }, { status: 503 });
  }

  const ip = ipDe(req.headers);
  const corpo = objeto(await req.json().catch(() => ({})));
  const { acao, token } = corpo;
  if (!tokenValido(token)) return NextResponse.json({ erro: "link inválido" }, { status: 400 });

  const linhas = await rest<LinhaAssinar[]>(
    "contratos?token=eq." + token + "&select=*,clientes(email)&limit=1",
  );
  const c = linhas && linhas[0];
  if (!c) return NextResponse.json({ erro: "contrato não encontrado" }, { status: 404 });
  if (c.status === "cancelado") return NextResponse.json({ erro: "este contrato foi cancelado" }, { status: 410 });
  if (c.status === "rascunho") return NextResponse.json({ erro: "este contrato ainda não foi liberado por mim" }, { status: 404 });
  if (expirado(c)) return NextResponse.json({ erro: "este link expirou, me peça um novo" }, { status: 410 });
  /* mesma checagem do GET: edição depois da liberação limpa jordan_confirmado_em
     e o casal não pode assinar até o fotógrafo reconfirmar sobre o conteúdo novo */
  if (c.status !== "assinado" && !c.jordan_confirmado_em) {
    return NextResponse.json({ erro: "atualizei este contrato e preciso confirmar de novo antes de liberar" }, { status: 404 });
  }

  try {
    /* ---------- assinar ---------- */
    if (acao === "assinar") {
      if (c.status === "assinado") return NextResponse.json({ erro: "contrato já assinado" }, { status: 409 });
      if (estourou("assinar:" + (ip || "sem-ip"))) return NextResponse.json({ erro: "muitas tentativas, aguarde" }, { status: 429 });

      const { aceite, assinaturaDataUrl, nomeSignatario, cpfSignatario } = corpo;
      if (aceite !== true) return NextResponse.json({ erro: "é preciso aceitar os termos para assinar" }, { status: 400 });

      if (typeof assinaturaDataUrl !== "string" || !/^data:image\/png;base64,/.test(assinaturaDataUrl)) {
        return NextResponse.json({ erro: "assinatura ausente" }, { status: 400 });
      }
      if (assinaturaDataUrl.length > LIMITE_ASSINATURA_DATAURL) {
        return NextResponse.json({ erro: "assinatura grande demais" }, { status: 413 });
      }

      const nome = textoCurto(nomeSignatario, 120);
      /* CPF opcional desde 2026-08-11: o fotógrafo atende clientes que não têm
         CPF, e exigir aqui impediria de assinar. Quem tem, informa — e aí
         precisa estar completo. O nome continua obrigatório: é ele que
         identifica quem assinou. */
      const cpf = normalizarCpf(cpfSignatario || "");
      if (!nome) return NextResponse.json({ erro: "preencha seu nome" }, { status: 400 });
      if (cpf && cpf.length !== 11) return NextResponse.json({ erro: "CPF precisa ter 11 dígitos, ou pode ficar em branco" }, { status: 400 });

      const email = emailDoContrato(c);
      const assinadoEm = new Date();
      const agora = assinadoEm.toISOString();

      /* monta o PDF ANTES do PATCH: se a geração falhar, o contrato continua
         não-assinado e o casal pode tentar de novo, em vez de ficar marcado
         como assinado sem via nenhuma guardada */
      /* contrato com modelo (texto editado em /configuracoes) monta o PDF do
         zero via pdfmake; sem modelo (texto fixo de sempre) continua no
         template.pdf pré-paginado — gerar.js intocado. Prefere o snapshot json
         congelado na geração; só cai no join do modelo vivo pra contratos
         antigos, gerados antes do snapshot existir. */
      /* Uint8Array do pdf-lib (gerar.js) ou Buffer do pdfmake (gerar-pdfmake.js);
         Buffer é Uint8Array, e os dois consumidores abaixo aceitam qualquer um */
      let pdfBytes: Uint8Array;
      if (c.template_json_snapshot || c.template_id) {
        let templateJson: unknown = c.template_json_snapshot || null;
        if (!templateJson && c.template_id) {
          const tplLinhas = await rest<LinhaTemplateJson[]>(
            "contrato_templates?id=eq." + c.template_id + "&select=conteudo_json&limit=1",
          );
          templateJson = tplLinhas && tplLinhas[0] && tplLinhas[0].conteudo_json;
        }
        pdfBytes = await gerarContratoPdfDinamico({
          templateJson: templateJson,
          snapshot: c.snapshot || {},
          assinaturaCasalDataUrl: assinaturaDataUrl,
          assinaturaJordanDataUrl: c.jordan_assinatura_dataurl || null,
          signatario: { nome: nome, cpf: cpf, email: email },
          assinadoEm: assinadoEm,
        });
      } else {
        pdfBytes = await gerarContratoPdf({
          snapshot: c.snapshot || {},
          assinaturaCasalDataUrl: assinaturaDataUrl,
          assinaturaJordanDataUrl: c.jordan_assinatura_dataurl || null,
          signatario: { nome: nome, cpf: cpf, email: email },
          assinadoEm: assinadoEm,
        });
      }
      const doc_sha256 = await sha256hex(pdfBytes);
      const pdfBase64 = Buffer.from(pdfBytes).toString("base64");

      await rest("contratos?token=eq." + token, {
        method: "PATCH",
        body: {
          status: "assinado",
          assinado_em: agora,
          verificado_em: agora,
          /* o fator de verificação é a posse do link: token de 32 bytes aleatórios
             entregue ao casal pelo WhatsApp. Sem OTP por e-mail (decisão de
             2026-07-25: o estúdio não tem domínio, o Resend não entrega ao casal) */
          verificacao_metodo: "link-tokenizado",
          aceite_texto: ACEITE_TEXTO,
          aceite_em: agora,
          signatario_nome: nome,
          signatario_cpf: cpf,
          signatario_email: email,
          assinante_ip: ip,
          assinante_ua: textoCurto(req.headers.get("user-agent"), 400),
          doc_sha256: doc_sha256,
          pdf_base64: pdfBase64,
        },
      });

      /* via assinada pras duas partes, em envios SEPARADOS: num "to" só, o Resend
         recusa a requisição inteira se um dos destinatários for barrado, e nem o
         fotógrafo receberia. Best-effort: falha aqui não desfaz a assinatura. */
      const corpoEmail = {
        subject: "Contrato assinado — " + nome,
        text: "O contrato foi assinado eletronicamente.\n\n" +
          "Signatário: " + nome + (cpf ? " (CPF " + cpf + ")" : "") + "\n" +
          "Data/hora: " + agora + "\n" +
          "Verificação: link de assinatura exclusivo, entregue ao contratante\n" +
          "Impressão digital do documento (SHA-256): " + doc_sha256 + "\n\n" +
          "A via assinada está em anexo.",
        attachments: [{ filename: "Contrato assinado.pdf", content: pdfBase64 }],
      };
      const destinatarios: string[] = [DESTINO_JORDAN];
      if (email && email.toLowerCase() !== DESTINO_JORDAN) destinatarios.push(email);
      destinatarios.forEach((para) => {
        enviarEmail({ to: para, ...corpoEmail })
          .catch((e: unknown) => { console.error("email contrato assinado falhou para", para, (e as Error).message); });
      });

      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ erro: "ação desconhecida" }, { status: 400 });
  } catch (e) {
    console.error("assinatura falhou:", (e as Error).message);
    return NextResponse.json({ erro: "algo falhou, tente de novo" }, { status: 502 });
  }
}

/* O original respondia 405 com JSON pra qualquer método fora GET/POST (depois
   da checagem do Supabase). O App Router só devolve 405 sozinho, sem corpo;
   isto mantém a resposta igual. */
function metodoNaoPermitido() {
  if (!supabaseConfigurado()) {
    return NextResponse.json({ erro: "indisponível no momento" }, { status: 503 });
  }
  return NextResponse.json({ erro: "método não permitido" }, { status: 405 });
}
export const PUT = metodoNaoPermitido;
export const PATCH = metodoNaoPermitido;
export const DELETE = metodoNaoPermitido;

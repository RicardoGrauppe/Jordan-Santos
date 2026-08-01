/*
  Assinatura eletrônica do contrato pelo casal (PÚBLICO — sem sessão; o token do link
  é a credencial). O Jordan gera o contrato no /estudio (api/estudio.js "gerar-contrato");
  o casal abre /assinar?token=… e assina.

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
  vetorial (api/_lib/contrato-pdf/), sempre igual, ~240 KB.

  Validade jurídica: assinatura eletrônica simples entre as partes (MP 2.200-2/2001
  art. 10 §2º; CC arts. 107 e 219). A trilha (aceite expresso, nome+CPF, IP, UA,
  timestamp do servidor, hash SHA-256) é o que sustenta autoria/integridade.

  NÃO há mais código por e-mail (OTP): removido em 2026-07-25 porque o estúdio não
  tem domínio verificado no Resend e o código nunca chegaria ao casal. O fator de
  verificação passou a ser a POSSE DO LINK (token de 32 bytes aleatórios, entregue
  pelo Jordan no WhatsApp do casal). Foi descartada a ideia de mandar o código junto
  na mensagem: quem entrega passaria a conhecer o código, então ele não provaria
  autoria nenhuma e a página de auditoria estaria afirmando algo falso.
*/

import { rest, supabaseConfigurado } from "./_lib/supabase.js";
import { normalizarCpf } from "./_lib/sessao.js";
import { enviarEmail, DESTINO_JORDAN } from "./_lib/email.js";
import { textoCurto, ipDe } from "./_lib/util.js";
import { gerarContratoPdf } from "./_lib/contrato-pdf/gerar.js";

/* mesmo teto que api/estudio.js usa pra assinatura do Jordan */
const LIMITE_ASSINATURA_DATAURL = 500_000;
const ACEITE_TEXTO =
  "Declaro que li e concordo com os termos deste contrato e reconheço a validade da " +
  "minha assinatura eletrônica realizada por este meio (MP 2.200-2/2001, art. 10, §2º).";

/* throttle best-effort por IP na ação de assinar */
const janela = new Map();
function estourou(chave, max) {
  const agora = Date.now();
  const t = janela.get(chave) || { n: 0, desde: agora };
  if (agora - t.desde > 15 * 60_000) { t.n = 0; t.desde = agora; }
  t.n++;
  janela.set(chave, t);
  return t.n > max;
}

function tokenValido(t) {
  return typeof t === "string" && /^[A-Za-z0-9_-]{20,64}$/.test(t);
}

/* Hash dos BYTES do PDF (2026-07-31). Antes era o hash da string base64, o que
   nunca batia com um `sha256sum` no arquivo baixado — agora bate, e qualquer
   perito confere a integridade da via sem depender do nosso código. Contratos
   assinados antes desta data guardam a semântica antiga; nada recomputa nem
   compara hash, o valor só é gravado e mandado no e-mail. */
async function sha256hex(bytes) {
  const buf = await crypto.subtle.digest("SHA-256", bytes);
  return Array.prototype.map.call(new Uint8Array(buf),
    function (b) { return b.toString(16).padStart(2, "0"); }).join("");
}

function expirado(c) { return new Date(c.expira_em) < new Date(); }

function emailDoContrato(c) {
  return (c.snapshot && c.snapshot.email) || (c.clientes && c.clientes.email) || null;
}

/* Assinatura padrão do Jordan (tabela config). A página que a editava
   (/configuracoes) saiu em 2026-07-28; isto é só fallback pra contrato sem a
   assinatura própria da revisão. Nada escreve mais nesta chave. */
async function preferenciasEstudio() {
  try {
    const linhas = await rest("config?chave=eq.assinatura_jordan&select=valor&limit=1");
    return { assinatura_jordan: (linhas && linhas[0] && linhas[0].valor) || null };
  } catch (_) {
    return { assinatura_jordan: null };
  }
}

export default async function handler(req, res) {
  if (!supabaseConfigurado()) {
    return res.status(503).json({ erro: "indisponível no momento" });
  }

  /* ---------- GET ?pdf=1: baixar a via assinada ---------- */
  if (req.method === "GET" && req.query.pdf) {
    const token = req.query.token;
    if (!tokenValido(token)) return res.status(400).json({ erro: "link inválido" });
    /* select explícito e só aqui: o blob nunca vem junto nas outras leituras */
    const linhas = await rest(
      "contratos?token=eq." + token + "&select=status,pdf_base64,snapshot&limit=1"
    );
    const c = linhas && linhas[0];
    if (!c) return res.status(404).json({ erro: "contrato não encontrado" });
    if (c.status !== "assinado" || !c.pdf_base64) {
      return res.status(404).json({ erro: "este contrato ainda não foi assinado" });
    }
    /* o nome do arquivo sai daqui porque quem volta depois de assinado não
       recebe mais o snapshot na tela (o GET normal devolve só o status) */
    const s = c.snapshot || {};
    const casal = [s.noivo, s.noiva].filter(Boolean).join(" e ");
    return res.status(200).json({
      pdf: c.pdf_base64,
      arquivo: "Contrato assinado" + (casal ? " - " + casal : "") + ".pdf"
    });
  }

  /* ---------- GET: obter o contrato p/ renderizar ---------- */
  if (req.method === "GET") {
    const token = req.query.token;
    if (!tokenValido(token)) return res.status(400).json({ erro: "link inválido" });
    const linhas = await rest(
      "contratos?token=eq." + token +
      "&select=status,expira_em,snapshot,jordan_assinatura_dataurl&limit=1"
    );
    const c = linhas && linhas[0];
    if (!c) return res.status(404).json({ erro: "contrato não encontrado" });
    if (c.status === "cancelado") return res.status(410).json({ erro: "este contrato foi cancelado" });
    if (c.status === "rascunho") return res.status(404).json({ erro: "este contrato ainda não foi liberado pelo Jordan" });
    if (expirado(c)) return res.status(410).json({ erro: "este link expirou, peça um novo ao Jordan" });
    if (c.status === "assinado") return res.status(200).json({ status: "assinado" });
    if (c.status === "enviado") {
      try {
        await rest("contratos?token=eq." + token, {
          method: "PATCH",
          body: { status: "visualizado", visualizado_em: new Date().toISOString() }
        });
      } catch (_) { /* não bloqueia a leitura */ }
    }
    /* preferências do estúdio (assinatura padrão do Jordan), pro contrato renderizar
       igual em qualquer dispositivo — best-effort, não bloqueia a leitura. A assinatura
       deste contrato específico (feita na revisão) tem prioridade sobre a padrão. */
    const estudio = await preferenciasEstudio();
    return res.status(200).json({
      status: "pronto",
      contrato: c.snapshot || {},
      estudio: estudio,
      jordanAssinatura: c.jordan_assinatura_dataurl || null
    });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ erro: "método não permitido" });
  }

  const ip = ipDe(req);
  const { acao, token } = req.body || {};
  if (!tokenValido(token)) return res.status(400).json({ erro: "link inválido" });

  const linhas = await rest(
    "contratos?token=eq." + token + "&select=*,clientes(email)&limit=1"
  );
  const c = linhas && linhas[0];
  if (!c) return res.status(404).json({ erro: "contrato não encontrado" });
  if (c.status === "cancelado") return res.status(410).json({ erro: "este contrato foi cancelado" });
  if (c.status === "rascunho") return res.status(404).json({ erro: "este contrato ainda não foi liberado pelo Jordan" });
  if (expirado(c)) return res.status(410).json({ erro: "este link expirou, peça um novo ao Jordan" });

  try {
    /* ---------- assinar ---------- */
    if (acao === "assinar") {
      if (c.status === "assinado") return res.status(409).json({ erro: "contrato já assinado" });
      if (estourou("assinar:" + (ip || "sem-ip"), 10)) return res.status(429).json({ erro: "muitas tentativas, aguarde" });

      const { aceite, assinaturaDataUrl, nomeSignatario, cpfSignatario } = req.body;
      if (aceite !== true) return res.status(400).json({ erro: "é preciso aceitar os termos para assinar" });

      if (typeof assinaturaDataUrl !== "string" || !/^data:image\/png;base64,/.test(assinaturaDataUrl)) {
        return res.status(400).json({ erro: "assinatura ausente" });
      }
      if (assinaturaDataUrl.length > LIMITE_ASSINATURA_DATAURL) {
        return res.status(413).json({ erro: "assinatura grande demais" });
      }

      const nome = textoCurto(nomeSignatario, 120);
      const cpf = normalizarCpf(cpfSignatario || "");
      if (!nome || cpf.length !== 11) return res.status(400).json({ erro: "preencha nome e CPF válidos" });

      const email = emailDoContrato(c);
      const assinadoEm = new Date();
      const agora = assinadoEm.toISOString();

      /* monta o PDF ANTES do PATCH: se a geração falhar, o contrato continua
         não-assinado e o casal pode tentar de novo, em vez de ficar marcado
         como assinado sem via nenhuma guardada */
      const pdfBytes = await gerarContratoPdf({
        snapshot: c.snapshot || {},
        assinaturaCasalDataUrl: assinaturaDataUrl,
        assinaturaJordanDataUrl: c.jordan_assinatura_dataurl || null,
        signatario: { nome: nome, cpf: cpf, email: email },
        assinadoEm: assinadoEm
      });
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
          assinante_ua: textoCurto(req.headers["user-agent"], 400),
          doc_sha256: doc_sha256,
          pdf_base64: pdfBase64
        }
      });

      /* via assinada pras duas partes, em envios SEPARADOS: num "to" só, o Resend
         recusa a requisição inteira se um dos destinatários for barrado, e nem o
         Jordan receberia. Best-effort: falha aqui não desfaz a assinatura. */
      const corpo = {
        subject: "Contrato assinado — " + nome,
        text: "O contrato foi assinado eletronicamente.\n\n" +
          "Signatário: " + nome + " (CPF " + cpf + ")\n" +
          "Data/hora: " + agora + "\n" +
          "Verificação: link de assinatura exclusivo, entregue ao contratante\n" +
          "Impressão digital do documento (SHA-256): " + doc_sha256 + "\n\n" +
          "A via assinada está em anexo.",
        attachments: [{ filename: "Contrato assinado.pdf", content: pdfBase64 }]
      };
      const destinatarios = [DESTINO_JORDAN];
      if (email && email.toLowerCase() !== DESTINO_JORDAN) destinatarios.push(email);
      destinatarios.forEach(function (para) {
        enviarEmail(Object.assign({ to: para }, corpo))
          .catch(function (e) { console.error("email contrato assinado falhou para", para, e.message); });
      });

      return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ erro: "ação desconhecida" });
  } catch (e) {
    console.error("assinatura falhou:", e.message);
    return res.status(502).json({ erro: "algo falhou, tente de novo" });
  }
}

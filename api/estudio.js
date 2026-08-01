/*
  Painel do Jordan (role "admin").

  GET  ?lista=1            → linhas resumidas de todos os clientes (+ status do contrato)
  GET  ?id=<uuid>          → cliente completo (+ último contrato)
  POST {acao:"criar", cliente:{...}}          → insere, devolve a linha
  POST {acao:"atualizar", id, cliente:{...}}  → PATCH dos campos enviados
  POST {acao:"arquivar", id}                  → status = arquivado (o "excluir" da UI)
  POST {acao:"excluir", id}                   → hard delete da linha
  POST {acao:"gerar-contrato", id}            → cria/reaproveita um contrato (status "rascunho",
                                                já salvo sem depender de assinatura nenhuma),
                                                devolve {link} da página de revisão do Jordan
  POST {acao:"confirmar-contrato", id, tipoAssinatura, assinaturaDataUrl, nomeAssinatura}
                                               → grava a "assinatura" do Jordan no rascunho ativo
                                                (não muda o status; só libera o envio ao casal)
  POST {acao:"liberar-contrato-cliente", id}  → libera o contrato pro casal (marca "enviado") e
                                                devolve {link, mensagem, telefone} pro Jordan mandar
                                                pelo WhatsApp (só com um rascunho já confirmado)
  POST {acao:"cancelar-contrato", id}         → cancela o contrato ativo do cliente
*/

import { rest } from "./_lib/supabase.js";
import { sessaoDe, normalizarCpf } from "./_lib/sessao.js";
import { filtrarCampos, textoCurto } from "./_lib/util.js";

/* campos que a UI pode gravar (whitelist contra colunas inesperadas) */
const CAMPOS = [
  "status", "noivo", "cpf_noivo", "noiva", "cpf_noiva", "tel_noivo", "tel_noiva",
  "email", "cep", "endereco", "numero", "complemento", "bairro", "cidade", "estado",
  "data_evento", "horario", "local_evento", "itens", "total", "entrada",
  "origem", "observacoes"
];

/* campos do cliente que viram o snapshot congelado do contrato */
const CAMPOS_SNAPSHOT = [
  "noivo", "cpf_noivo", "noiva", "cpf_noiva", "tel_noivo", "tel_noiva", "email",
  "cep", "endereco", "numero", "complemento", "bairro", "cidade", "estado",
  "data_evento", "horario", "local_evento", "itens", "total", "entrada"
];

/* Endereços que NÃO são a internet pública: servidor de dev, seja pelo localhost
   ou pelo IP da rede local (testar no celular usa o segundo). Antes só
   "localhost" contava, então acessando por http://192.168.1.183:8020 o link
   saía como https://192.168.1.183:8020 — e o Safari não abre HTTPS num servidor
   que só fala HTTP. Era o "link que o Safari não consegue abrir". */
function ehHostLocal(host) {
  const semPorta = String(host || "").split(":")[0];
  return (
    semPorta === "localhost" ||
    semPorta === "127.0.0.1" ||
    semPorta === "0.0.0.0" ||
    semPorta.endsWith(".local") ||
    /^10\./.test(semPorta) ||
    /^192\.168\./.test(semPorta) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(semPorta)
  );
}

function baseUrlDe(req) {
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  const encaminhado = (req.headers["x-forwarded-proto"] || "").split(",")[0].trim();
  /* na Vercel o x-forwarded-proto manda; sem ele, http só em rede local */
  const proto = encaminhado || (ehHostLocal(host) ? "http" : "https");
  return proto + "://" + host;
}

/* token forte (32 bytes → base64url), credencial do link de assinatura */
function tokenForte() {
  const b = new Uint8Array(32);
  crypto.getRandomValues(b);
  let bin = "";
  for (let i = 0; i < b.length; i++) bin += String.fromCharCode(b[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/* último contrato do cliente (best-effort: se a tabela não existir, ignora) */
async function ultimoContrato(clienteId) {
  try {
    const linhas = await rest(
      "contratos?cliente_id=eq." + clienteId +
      "&select=id,token,status,criado_em,enviado_em,visualizado_em,assinado_em,expira_em,snapshot," +
      "jordan_confirmado_em,jordan_assinatura_tipo,jordan_assinatura_dataurl,jordan_assinatura_nome," +
      /* trilha de auditoria da assinatura do casal — é o que o contrato diz
         que "fica preservado no sistema do fotógrafo", então o Jordan precisa
         conseguir ver isso no /estudio, não só via SQL no Supabase.
         pdf_base64 fica de fora de propósito (blob grande; o schema avisa). */
      "signatario_nome,signatario_cpf,signatario_email,assinante_ip,assinante_ua," +
      "doc_sha256,aceite_texto,aceite_em,verificado_em,verificacao_metodo" +
      "&order=criado_em.desc&limit=1"
    );
    return (linhas && linhas[0]) || null;
  } catch (_) {
    return null;
  }
}

const limparCliente = (c) => filtrarCampos(CAMPOS, c, function (limpo) {
  if (limpo.cpf_noivo) limpo.cpf_noivo = normalizarCpf(limpo.cpf_noivo);
  if (limpo.cpf_noiva) limpo.cpf_noiva = normalizarCpf(limpo.cpf_noiva);
});

export default async function handler(req, res) {
  const sessao = await sessaoDe(req, "admin");
  if (!sessao) return res.status(401).json({ erro: "sessão inválida" });

  try {
    if (req.method === "GET") {
      if (req.query.id) {
        const linhas = await rest("clientes?id=eq." + req.query.id + "&select=*");
        if (!linhas || !linhas.length) return res.status(404).json({ erro: "cliente não encontrado" });
        const contrato = await ultimoContrato(req.query.id);
        return res.status(200).json({ cliente: linhas[0], contrato: contrato });
      }
      const lista = await rest(
        "clientes?select=id,noivo,noiva,data_evento,status,total,tel_noivo,origem,local_evento" +
        "&order=data_evento.asc.nullslast"
      );
      /* status do contrato por cliente (best-effort, uma consulta só) */
      let porCliente = {};
      try {
        const cs = await rest(
          "contratos?select=cliente_id,status,assinado_em&order=criado_em.desc"
        );
        (cs || []).forEach(function (c) {
          if (!porCliente[c.cliente_id]) porCliente[c.cliente_id] = c; /* o mais recente */
        });
      } catch (_) { porCliente = {}; }
      (lista || []).forEach(function (c) {
        c.contrato_status = porCliente[c.id] ? porCliente[c.id].status : null;
      });
      return res.status(200).json({ clientes: lista || [] });
    }

    if (req.method !== "POST") {
      return res.status(405).json({ erro: "método não permitido" });
    }

    const { acao, id } = req.body || {};

    if (acao === "criar") {
      const linha = await rest("clientes", {
        method: "POST",
        body: limparCliente(req.body.cliente || {}),
        prefer: "return=representation"
      });
      return res.status(200).json({ ok: true, cliente: linha[0] });
    }

    if (!id) return res.status(400).json({ erro: "id obrigatório" });

    if (acao === "atualizar") {
      const limpo = limparCliente(req.body.cliente || {});
      const contrato = await ultimoContrato(id);
      const travado = !!(contrato && contrato.jordan_confirmado_em);
      /* depois que o Jordan confirma a assinatura dele, o snapshot do contrato
         já foi gerado (ver "gerar-contrato" e "confirmar-contrato") — aceitar
         mudança de itens/total/entrada aqui criaria uma divergência silenciosa
         entre a ficha do cliente e o documento que já saiu pra assinatura.
         Reforça em código o que a UI já trava visualmente. */
      if (travado) {
        delete limpo.itens;
        delete limpo.total;
        delete limpo.entrada;
      }

      await rest("clientes?id=eq." + id, { method: "PATCH", body: limpo });

      /* enquanto ainda é rascunho não confirmado, mantém o snapshot do
         contrato em dia com o que o Jordan for ajustando — sem isso ele
         assinaria (e o casal receberia) um valor que já ficou pra trás */
      const mudouValores = "itens" in limpo || "total" in limpo || "entrada" in limpo;
      if (!travado && contrato && contrato.status === "rascunho" && mudouValores) {
        const linhas = await rest("clientes?id=eq." + id + "&select=*");
        const clienteAtual = linhas && linhas[0];
        if (clienteAtual) {
          const snapshot = {};
          CAMPOS_SNAPSHOT.forEach(function (k) { snapshot[k] = clienteAtual[k]; });
          await rest("contratos?id=eq." + contrato.id, {
            method: "PATCH",
            body: { snapshot: snapshot }
          });
        }
      }

      return res.status(200).json({ ok: true });
    }

    if (acao === "arquivar") {
      await rest("clientes?id=eq." + id, {
        method: "PATCH", body: { status: "arquivado" }
      });
      return res.status(200).json({ ok: true });
    }

    if (acao === "excluir") {
      /* se veio de conversão, o prospecto ainda referencia este cliente (FK):
         desvincula antes, senão o DELETE é bloqueado (23503). O contrato tem
         ON DELETE CASCADE, então some junto. */
      await rest("prospectos?cliente_id=eq." + id, {
        method: "PATCH", body: { cliente_id: null }
      });
      await rest("clientes?id=eq." + id, { method: "DELETE" });
      return res.status(200).json({ ok: true });
    }

    if (acao === "gerar-contrato") {
      const linhas = await rest("clientes?id=eq." + id + "&select=*");
      const cliente = linhas && linhas[0];
      if (!cliente) return res.status(404).json({ erro: "cliente não encontrado" });

      const base = baseUrlDe(req);

      /* reaproveita um rascunho ainda não enviado ao casal (mesmo já confirmado
         pelo Jordan) ou um contrato já enviado/visualizado não expirado */
      const ativos = await rest(
        "contratos?cliente_id=eq." + id +
        "&status=in.(rascunho,enviado,visualizado)&select=id,expira_em&order=criado_em.desc&limit=1"
      );
      if (!(ativos && ativos.length && new Date(ativos[0].expira_em) > new Date())) {
        const snapshot = {};
        CAMPOS_SNAPSHOT.forEach(function (k) { snapshot[k] = cliente[k]; });
        await rest("contratos", {
          method: "POST",
          body: {
            cliente_id: id,
            token: tokenForte(),
            status: "rascunho",
            expira_em: new Date(Date.now() + 30 * 86400000).toISOString(),
            snapshot: snapshot
          }
        });
      }

      const link = base + "/revisar-contrato?id=" + id;
      return res.status(200).json({ ok: true, link: link });
    }

    if (acao === "confirmar-contrato") {
      const { tipoAssinatura, assinaturaDataUrl, nomeAssinatura } = req.body || {};
      if (tipoAssinatura !== "cursiva" && tipoAssinatura !== "manual") {
        return res.status(400).json({ erro: "tipo de assinatura inválido" });
      }
      if (typeof assinaturaDataUrl !== "string" || assinaturaDataUrl.length < 100) {
        return res.status(400).json({ erro: "assinatura ausente" });
      }
      if (assinaturaDataUrl.length > 500_000) {
        return res.status(413).json({ erro: "assinatura grande demais" });
      }
      const ativos = await rest(
        "contratos?cliente_id=eq." + id +
        "&status=eq.rascunho&select=id,jordan_confirmado_em&order=criado_em.desc&limit=1"
      );
      const contrato = ativos && ativos[0];
      if (!contrato) return res.status(404).json({ erro: "gere o contrato antes de confirmar" });
      /* UMA assinatura do Jordan por contrato. Trocar a assinatura depois de
         assinado mudaria o documento que a trilha de auditoria já registra —
         pra assinar de novo, cancele o contrato e gere outro. (A trava
         equivalente do casal vive em api/assinatura.js: 409 "contrato já
         assinado".) */
      if (contrato.jordan_confirmado_em) {
        return res.status(409).json({ erro: "este contrato já foi assinado por você" });
      }

      await rest("contratos?id=eq." + contrato.id, {
        method: "PATCH",
        body: {
          jordan_confirmado_em: new Date().toISOString(),
          jordan_assinatura_tipo: tipoAssinatura,
          jordan_assinatura_dataurl: assinaturaDataUrl,
          jordan_assinatura_nome: textoCurto(nomeAssinatura, 120) || "Jordan Santos"
        }
      });
      return res.status(200).json({ ok: true });
    }

    if (acao === "liberar-contrato-cliente") {
      const linhas = await rest("clientes?id=eq." + id + "&select=noivo,noiva,tel_noivo,tel_noiva");
      const cliente = linhas && linhas[0];
      if (!cliente) return res.status(404).json({ erro: "cliente não encontrado" });

      /* aceita rascunho (1ª vez) e também já enviado/visualizado, pra o Jordan
         conseguir recuperar o link e reenviar sem gerar contrato novo */
      const ativos = await rest(
        "contratos?cliente_id=eq." + id +
        "&status=in.(rascunho,enviado,visualizado)" +
        "&select=id,token,status,jordan_confirmado_em&order=criado_em.desc&limit=1"
      );
      const contrato = ativos && ativos[0];
      if (!contrato) return res.status(404).json({ erro: "nenhum contrato pronto pra enviar" });
      if (!contrato.jordan_confirmado_em) {
        return res.status(409).json({ erro: "confirme (assine) o contrato antes de enviar ao cliente" });
      }

      /* o link vai pelo WhatsApp, na mão do Jordan (decisão de 2026-07-25: o domínio
         do estúdio não existe, então o Resend não entrega pra ninguém além dele) */
      const link = baseUrlDe(req) + "/assinar?token=" + contrato.token;
      const primeiroNome = String(cliente.noivo || "").trim().split(/\s+/)[0] || "";
      const mensagem =
        "Oi" + (primeiroNome ? ", " + primeiroNome : "") + "! Aqui é o Jordan. Segue o contrato " +
        "pra você revisar e assinar direto pelo link (dá pra fazer pelo celular, leva 1 minutinho):\n" +
        link + "\nQualquer dúvida, é só me chamar por aqui.";

      /* só marca na primeira liberação: pegar o link de novo não pode regredir um
         contrato já "visualizado" nem reescrever a data real do primeiro envio */
      if (contrato.status === "rascunho") {
        await rest("contratos?id=eq." + contrato.id, {
          method: "PATCH", body: { status: "enviado", enviado_em: new Date().toISOString() }
        });
      }
      return res.status(200).json({
        ok: true, link: link, mensagem: mensagem,
        telefone: String(cliente.tel_noivo || cliente.tel_noiva || "").replace(/\D/g, "")
      });
    }

    if (acao === "cancelar-contrato") {
      await rest(
        "contratos?cliente_id=eq." + id + "&status=in.(rascunho,enviado,visualizado)",
        { method: "PATCH", body: { status: "cancelado" } }
      );
      return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ erro: "ação desconhecida" });
  } catch (e) {
    console.error("estudio falhou:", e.message);
    return res.status(502).json({ erro: "banco indisponível, tente de novo" });
  }
}

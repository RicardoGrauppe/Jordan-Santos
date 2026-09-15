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
      "&select=id,token,status,versao,criado_em,enviado_em,visualizado_em,assinado_em,expira_em,snapshot," +
      "jordan_confirmado_em,jordan_assinatura_tipo,jordan_assinatura_dataurl,jordan_assinatura_nome," +
      /* trilha de auditoria da assinatura do casal — é o que o contrato diz
         que "fica preservado no sistema do fotógrafo", então o Jordan precisa
         conseguir ver isso no /estudio, não só via SQL no Supabase.
         pdf_base64 fica de fora de propósito (blob grande; o schema avisa). */
      "signatario_nome,signatario_cpf,signatario_email,assinante_ip,assinante_ua," +
      "doc_sha256,aceite_texto,aceite_em,verificado_em,verificacao_metodo," +
      "template_id,template_nome,template_html_snapshot" +
      "&order=criado_em.desc&limit=1"
    );
    const contrato = (linhas && linhas[0]) || null;
    if (contrato) {
      /* prefere o snapshot congelado (editar o modelo depois não afeta este
         contrato); só cai no join do modelo vivo pra contratos antigos gerados
         antes do snapshot existir. */
      if (contrato.template_html_snapshot) {
        contrato.template_html = contrato.template_html_snapshot;
      } else if (contrato.template_id) {
        try {
          const tpl = await rest(
            "contrato_templates?id=eq." + contrato.template_id + "&select=conteudo_html&limit=1"
          );
          contrato.template_html = (tpl && tpl[0] && tpl[0].conteudo_html) || null;
        } catch (_) { contrato.template_html = null; }
      } else {
        contrato.template_html = null;
      }
    }
    return contrato;
  } catch (_) {
    return null;
  }
}

/* modelo padrão no momento (ou null) — usado só na geração de um contrato
   novo, pra CONGELAR o texto dele no próprio contrato. Como os modelos são
   editáveis in place em /configuracoes, guardar só o template_id não bastava:
   editar o modelo depois mudaria retroativamente contratos já gerados/assinados.
   Por isso a geração grava um snapshot (html + json + nome) no contrato. */
async function modeloPadrao() {
  try {
    const linhas = await rest(
      "contrato_templates?ativo=eq.true&select=id,nome,conteudo_html,conteudo_json&limit=1"
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
      /* Só `status = "assinado"` trava de vez (2026-09-01): antes disso a
         ficha é editável a qualquer momento, mesmo depois de confirmado ou já
         enviado ao casal — se a noiva desiste de um item no meio do processo,
         o Jordan corrige aqui em vez de cancelar o contrato inteiro. */
      const assinado = !!(contrato && contrato.status === "assinado");
      if (assinado) {
        delete limpo.itens;
        delete limpo.total;
        delete limpo.entrada;
      }

      await rest("clientes?id=eq." + id, { method: "PATCH", body: limpo });

      /* QUALQUER campo do snapshot (não só itens/total/entrada, como era antes
         de 2026-09-01 — quando só o valor travava, o resto do formulário nunca
         precisou sincronizar pós-geração). Agora nome/CPF/endereço/data também
         editam depois de gerado, então precisam entrar na mesma sincronização
         — senão o cliente muda e o documento revisado continua com o dado
         velho, exatamente o bug que a edição inline expôs. */
      const mudouSnapshot = CAMPOS_SNAPSHOT.some(function (k) { return k in limpo; });
      if (!assinado && contrato && mudouSnapshot) {
        const linhas = await rest("clientes?id=eq." + id + "&select=*");
        const clienteAtual = linhas && linhas[0];
        if (!clienteAtual) return res.status(200).json({ ok: true });

        const snapshot = {};
        CAMPOS_SNAPSHOT.forEach(function (k) { snapshot[k] = clienteAtual[k]; });

        /* Contrato ainda rascunho E ninguém confirmou nada: ninguém viu esse
           conteúdo ainda, então só atualiza o snapshot em dia, sem versionar
           (não há o que preservar como "versão anterior"). */
        if (contrato.status === "rascunho" && !contrato.jordan_confirmado_em) {
          await rest("contratos?id=eq." + contrato.id, {
            method: "PATCH",
            body: { snapshot: snapshot }
          });
        } else {
          /* Já foi confirmado pelo Jordan e/ou enviado ao casal: preserva o
             que estava valendo até agora em contrato_versoes, sobe a versão,
             e limpa a confirmação do Jordan — a assinatura dele valia pro
             conteúdo antigo, precisa reconfirmar sobre o novo antes de
             liberar de novo (ver "confirmar-contrato" mais abaixo). */
          await rest("contrato_versoes", {
            method: "POST",
            body: {
              contrato_id: contrato.id,
              versao: contrato.versao || 1,
              snapshot: contrato.snapshot,
              jordan_assinatura_tipo: contrato.jordan_assinatura_tipo,
              jordan_assinatura_dataurl: contrato.jordan_assinatura_dataurl,
              jordan_assinatura_nome: contrato.jordan_assinatura_nome,
              jordan_confirmado_em: contrato.jordan_confirmado_em
            }
          });
          await rest("contratos?id=eq." + contrato.id, {
            method: "PATCH",
            body: {
              snapshot: snapshot,
              versao: (contrato.versao || 1) + 1,
              jordan_confirmado_em: null,
              jordan_assinatura_tipo: null,
              jordan_assinatura_dataurl: null,
              jordan_assinatura_nome: null
            }
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

      /* Nada de validação de completude aqui (decisão de 2026-08-08): o Jordan
         gera o contrato com o que tem em mãos e completa depois, e nenhum
         campo da ficha é necessário pro fluxo funcionar — quem assina digita o
         próprio nome e CPF em /assinar, e o e-mail do casal só serve pra
         enviar o PDF depois, sendo opcional lá também. O /estudio mostra o que
         está faltando na confirmação, como aviso. */
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
        /* fixa pra sempre qual versão do TEXTO do contrato este contrato usa —
           editar o modelo depois (em /configuracoes) não muda isto, porque
           gravamos o snapshot do html/json/nome aqui. template_id fica de
           referência (qual modelo deu origem), mas as telas leem o snapshot.
           Sem nenhum modelo padrão ainda, tudo fica null e as telas caem de
           volta pro CONTRATO_TEMPLATE.html({modo}) fixo de sempre. */
        const modelo = await modeloPadrao();
        await rest("contratos", {
          method: "POST",
          body: {
            cliente_id: id,
            token: tokenForte(),
            status: "rascunho",
            expira_em: new Date(Date.now() + 30 * 86400000).toISOString(),
            snapshot: snapshot,
            template_id: modelo ? modelo.id : null,
            template_nome: modelo ? modelo.nome : null,
            template_html_snapshot: modelo ? modelo.conteudo_html : null,
            template_json_snapshot: modelo ? modelo.conteudo_json : null
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
        "&status=in.(rascunho,enviado,visualizado)" +
        "&select=id,jordan_confirmado_em&order=criado_em.desc&limit=1"
      );
      const contrato = ativos && ativos[0];
      if (!contrato) return res.status(404).json({ erro: "gere o contrato antes de confirmar" });
      /* Reconfirmar é o fluxo normal depois de uma edição da ficha que subiu a
         versão do contrato (ver "atualizar" acima, que limpa
         jordan_confirmado_em nesse caso) — a trava de "já assinado" é só a do
         casal, em api/assinatura.js (409 "contrato já assinado"). */

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

      /* aceita rascunho (1ª vez), enviado/visualizado (recuperar o link sem
         gerar contrato novo) e também ASSINADO: depois de assinado o mesmo
         link abre a tela com o botão de baixar a via, então é por ele que o
         casal pede a segunda via. */
      const ativos = await rest(
        "contratos?cliente_id=eq." + id +
        "&status=in.(rascunho,enviado,visualizado,assinado)" +
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
      /* cai pra noiva quando o contrato é só dela — senão a mensagem sairia
         como "Oi! Aqui é o Jordan", sem nome */
      const primeiroNome = String(cliente.noivo || cliente.noiva || "").trim().split(/\s+/)[0] || "";
      const jaAssinado = contrato.status === "assinado";
      const saudacao = "Oi" + (primeiroNome ? ", " + primeiroNome : "") + "! Aqui é o Jordan. ";
      const mensagem = jaAssinado
        ? saudacao + "Segue o link da via assinada do contrato — é só abrir e " +
          "baixar o PDF, fica sempre disponível aí:\n" +
          link + "\nQualquer coisa, me chama por aqui."
        : saudacao + "Segue o contrato pra você revisar e assinar direto pelo " +
          "link (dá pra fazer pelo celular, leva 1 minutinho):\n" +
          link + "\nQualquer dúvida, é só me chamar por aqui.";

      /* só marca na primeira liberação: pegar o link de novo não pode regredir um
         contrato já "visualizado" nem reescrever a data real do primeiro envio */
      if (contrato.status === "rascunho") {
        await rest("contratos?id=eq." + contrato.id, {
          method: "PATCH", body: { status: "enviado", enviado_em: new Date().toISOString() }
        });
      }
      return res.status(200).json({
        ok: true, link: link, mensagem: mensagem, assinado: jaAssinado,
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

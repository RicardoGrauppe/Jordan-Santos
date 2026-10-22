/*
  Painel do fotógrafo (role "admin"). Portado de `api/estudio.js` do estúdio
  do Jordan.

  GET  ?lista=1            → linhas resumidas de todos os clientes (+ status do contrato)
  GET  ?id=<uuid>          → cliente completo (+ último contrato)
  POST {acao:"criar", cliente:{...}}          → insere, devolve a linha
  POST {acao:"atualizar", id, cliente:{...}}  → PATCH dos campos enviados
  POST {acao:"arquivar", id}                  → status = arquivado (o "excluir" da UI)
  POST {acao:"excluir", id}                   → hard delete da linha
  POST {acao:"gerar-contrato", id}            → cria/reaproveita um contrato (status "rascunho",
                                                já salvo sem depender de assinatura nenhuma),
                                                devolve {link} da página de revisão do fotógrafo
  POST {acao:"confirmar-contrato", id, tipoAssinatura, assinaturaDataUrl, nomeAssinatura}
                                               → grava a "assinatura" do fotógrafo no rascunho ativo
                                                (não muda o status; só libera o envio ao casal)
  POST {acao:"liberar-contrato-cliente", id}  → libera o contrato pro casal (marca "enviado") e
                                                devolve {link, mensagem, telefone} pro fotógrafo mandar
                                                pelo WhatsApp (só com um rascunho já confirmado)
  POST {acao:"cancelar-contrato", id}         → cancela o contrato ativo do cliente
*/
import { NextResponse } from "next/server";
import { rest } from "@/lib/supabase";
import { sessaoAtual } from "@/lib/sessao";
import { filtrarCampos, normalizarCpf, textoCurto } from "@/lib/util";
import { apagarDocumento as apagarDocumentoAutentique, configurada as autentiqueConfigurada } from "@/lib/autentique";
import { enviarParaAssinatura, sincronizarContrato } from "@/lib/contrato-autentique";

/* campos que a UI pode gravar (whitelist contra colunas inesperadas) */
const CAMPOS = [
  "status", "noivo", "cpf_noivo", "noiva", "cpf_noiva", "tel_noivo", "tel_noiva",
  "email", "cep", "endereco", "numero", "complemento", "bairro", "cidade", "estado",
  "data_evento", "horario", "local_evento", "itens", "total", "entrada",
  "origem", "observacoes",
] as const;

/* campos do cliente que viram o snapshot congelado do contrato */
const CAMPOS_SNAPSHOT = [
  "noivo", "cpf_noivo", "noiva", "cpf_noiva", "tel_noivo", "tel_noiva", "email",
  "cep", "endereco", "numero", "complemento", "bairro", "cidade", "estado",
  "data_evento", "horario", "local_evento", "itens", "total", "entrada",
] as const;

/* ---------- tipos das linhas que cada leitura pede ao PostgREST ---------- */

/** `select=*` do cliente: colunas conforme o banco, sem whitelist aqui. */
type LinhaCliente = Record<string, unknown>;

type LinhaClienteResumo = {
  id: string;
  noivo: string | null;
  noiva: string | null;
  data_evento: string | null;
  status: string | null;
  total: number | null;
  tel_noivo: string | null;
  origem: string | null;
  local_evento: string | null;
  criado_em: string | null;
  /* preenchidos aqui, a partir do contrato mais recente */
  contrato_status?: string | null;
  /* quando o contrato ENTROU no estado atual: é o relógio que põe o aviso
     do sino no lugar certo da ordem de chegada */
  contrato_em?: string | null;
};

type LinhaContratoStatus = {
  cliente_id: string; status: string | null; criado_em: string | null;
  enviado_em: string | null; visualizado_em: string | null; assinado_em: string | null;
};

type LinhaContrato = {
  id: string;
  token: string;
  status: string | null;
  versao: number | null;
  criado_em: string | null;
  enviado_em: string | null;
  visualizado_em: string | null;
  assinado_em: string | null;
  expira_em: string | null;
  snapshot: Record<string, unknown> | null;
  jordan_confirmado_em: string | null;
  jordan_assinatura_tipo: string | null;
  jordan_assinatura_dataurl: string | null;
  jordan_assinatura_nome: string | null;
  signatario_nome: string | null;
  signatario_cpf: string | null;
  signatario_email: string | null;
  assinante_ip: string | null;
  assinante_ua: string | null;
  doc_sha256: string | null;
  autentique_id?: string | null;
  autentique_link?: string | null;
  recusado_em?: string | null;
  aceite_texto: string | null;
  aceite_em: string | null;
  verificado_em: string | null;
  verificacao_metodo: string | null;
  template_id: string | null;
  template_nome: string | null;
  template_html_snapshot: string | null;
};
/** O que `ultimoContrato` devolve: a linha mais o html do template resolvido. */
type ContratoComTemplate = LinhaContrato & { template_html: string | null };

type LinhaTemplateHtml = { conteudo_html: string | null };
type LinhaModeloPadrao = { id: string; nome: string | null; conteudo_html: string | null; conteudo_json: unknown };
type LinhaContratoAtivo = { id: string; expira_em: string | null };
type LinhaContratoConfirmar = { id: string; jordan_confirmado_em: string | null };
/* o que o envio pra Autentique precisa ler do contrato: estado, vínculo com o
   documento de lá e o material do PDF (snapshot + modelo + assinatura do
   fotógrafo). `status` não é nulo na tabela, o tipo só não dizia. */
type LinhaContratoLiberar = {
  id: string; token: string; status: string; jordan_confirmado_em: string | null;
  autentique_id: string | null; autentique_link: string | null;
  visualizado_em: string | null; assinado_em: string | null;
  snapshot: Record<string, unknown> | null;
  template_id: string | null; template_json_snapshot: unknown;
  jordan_assinatura_dataurl: string | null;
};
type LinhaClienteContato = {
  noivo: string | null; noiva: string | null;
  tel_noivo: string | null; tel_noiva: string | null; email: string | null;
};

/** Objeto do corpo, ou {} quando veio outra coisa (o original lia `req.body || {}`). */
function objeto(valor: unknown): Record<string, unknown> {
  return valor && typeof valor === "object" ? (valor as Record<string, unknown>) : {};
}

/* Endereços que NÃO são a internet pública: servidor de dev, seja pelo localhost
   ou pelo IP da rede local (testar no celular usa o segundo). Antes só
   "localhost" contava, então acessando por http://192.168.1.183:8020 o link
   saía como https://192.168.1.183:8020 — e o Safari não abre HTTPS num servidor
   que só fala HTTP. Era o "link que o Safari não consegue abrir". */
function ehHostLocal(host: string | null): boolean {
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

function baseUrlDe(req: Request): string {
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
  const encaminhado = (req.headers.get("x-forwarded-proto") || "").split(",")[0].trim();
  /* na Vercel o x-forwarded-proto manda; sem ele, http só em rede local */
  const proto = encaminhado || (ehHostLocal(host) ? "http" : "https");
  return proto + "://" + host;
}

/* token forte (32 bytes → base64url), credencial do link de assinatura */
function tokenForte(): string {
  const b = new Uint8Array(32);
  crypto.getRandomValues(b);
  let bin = "";
  for (let i = 0; i < b.length; i++) bin += String.fromCharCode(b[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/* último contrato do cliente (best-effort: se a tabela não existir, ignora) */
async function ultimoContrato(clienteId: string): Promise<ContratoComTemplate | null> {
  try {
    const linhas = await rest<LinhaContrato[]>(
      "contratos?cliente_id=eq." + clienteId +
      "&select=id,token,status,versao,criado_em,enviado_em,visualizado_em,assinado_em,expira_em,snapshot," +
      "jordan_confirmado_em,jordan_assinatura_tipo,jordan_assinatura_dataurl,jordan_assinatura_nome," +
      /* trilha de auditoria da assinatura do casal — é o que o contrato diz
         que "fica preservado no sistema do fotógrafo", então o fotógrafo precisa
         conseguir ver isso no painel, não só via SQL no Supabase.
         pdf_base64 fica de fora de propósito (blob grande; o schema avisa). */
      "signatario_nome,signatario_cpf,signatario_email,assinante_ip,assinante_ua," +
      "doc_sha256,aceite_texto,aceite_em,verificado_em,verificacao_metodo," +
      "template_id,template_nome,template_html_snapshot," +
      /* vínculo com o documento lá: é o que acende o "Abrir na Autentique" */
      "autentique_id,autentique_link,recusado_em" +
      "&order=criado_em.desc&limit=1",
    );
    const linha = (linhas && linhas[0]) || null;
    if (!linha) return null;
    const contrato: ContratoComTemplate = { ...linha, template_html: null };
    /* prefere o snapshot congelado (editar o modelo depois não afeta este
       contrato); só cai no join do modelo vivo pra contratos antigos gerados
       antes do snapshot existir. */
    if (contrato.template_html_snapshot) {
      contrato.template_html = contrato.template_html_snapshot;
    } else if (contrato.template_id) {
      try {
        const tpl = await rest<LinhaTemplateHtml[]>(
          "contrato_templates?id=eq." + contrato.template_id + "&select=conteudo_html&limit=1",
        );
        contrato.template_html = (tpl && tpl[0] && tpl[0].conteudo_html) || null;
      } catch { contrato.template_html = null; }
    } else {
      contrato.template_html = null;
    }
    return contrato;
  } catch {
    return null;
  }
}

/* modelo padrão no momento (ou null) — usado só na geração de um contrato
   novo, pra CONGELAR o texto dele no próprio contrato. Como os modelos são
   editáveis in place em /configuracoes, guardar só o template_id não bastava:
   editar o modelo depois mudaria retroativamente contratos já gerados/assinados.
   Por isso a geração grava um snapshot (html + json + nome) no contrato. */
async function modeloPadrao(): Promise<LinhaModeloPadrao | null> {
  try {
    const linhas = await rest<LinhaModeloPadrao[]>(
      "contrato_templates?ativo=eq.true&select=id,nome,conteudo_html,conteudo_json&limit=1",
    );
    return (linhas && linhas[0]) || null;
  } catch {
    return null;
  }
}

const limparCliente = (c: Record<string, unknown>) =>
  filtrarCampos<Record<string, unknown>>(CAMPOS, c, (limpo) => {
    if (limpo.cpf_noivo) limpo.cpf_noivo = normalizarCpf(limpo.cpf_noivo);
    if (limpo.cpf_noiva) limpo.cpf_noiva = normalizarCpf(limpo.cpf_noiva);
  });

export async function GET(req: Request) {
  const sessao = await sessaoAtual("admin");
  if (!sessao) return NextResponse.json({ erro: "sessão inválida" }, { status: 401 });

  try {
    const id = new URL(req.url).searchParams.get("id");
    if (id) {
      const linhas = await rest<LinhaCliente[]>("clientes?id=eq." + id + "&select=*");
      if (!linhas || !linhas.length) return NextResponse.json({ erro: "cliente não encontrado" }, { status: 404 });
      const contrato = await ultimoContrato(id);
      return NextResponse.json({ cliente: linhas[0], contrato: contrato });
    }
    const lista = await rest<LinhaClienteResumo[]>(
      "clientes?select=id,noivo,noiva,data_evento,status,total,tel_noivo,origem,local_evento,criado_em" +
      "&order=data_evento.asc.nullslast",
    );
    /* status do contrato por cliente (best-effort, uma consulta só) */
    let porCliente: Record<string, LinhaContratoStatus> = {};
    try {
      const cs = await rest<LinhaContratoStatus[]>(
        "contratos?select=cliente_id,status,criado_em,enviado_em,visualizado_em,assinado_em&order=criado_em.desc",
      );
      (cs || []).forEach((c) => {
        if (!porCliente[c.cliente_id]) porCliente[c.cliente_id] = c; /* o mais recente */
      });
    } catch { porCliente = {}; }
    (lista || []).forEach((c) => {
      const ct = porCliente[c.id];
      c.contrato_status = ct ? ct.status : null;
      /* do estado mais recente pro mais antigo: o primeiro que existir é o
         momento em que o contrato virou o que é hoje. Cai no `criado_em` do
         contrato porque linha antiga (e semente) tem status sem carimbo. */
      c.contrato_em = ct ? (ct.assinado_em || ct.visualizado_em || ct.enviado_em || ct.criado_em) : null;
    });
    return NextResponse.json({ clientes: lista || [] });
  } catch (e) {
    console.error("estudio falhou:", (e as Error).message);
    return NextResponse.json({ erro: "banco indisponível, tente de novo" }, { status: 502 });
  }
}

export async function POST(req: Request) {
  const sessao = await sessaoAtual("admin");
  if (!sessao) return NextResponse.json({ erro: "sessão inválida" }, { status: 401 });

  try {
    const corpo = objeto(await req.json().catch(() => ({})));
    const acao = corpo.acao;
    /* mesma checagem de falsy do original (`if (!id)`); o que passa vira
       string, que é como entra na URL do PostgREST */
    const id = corpo.id ? String(corpo.id) : "";

    if (acao === "criar") {
      const linha = await rest<LinhaCliente[]>("clientes", {
        method: "POST",
        body: limparCliente(objeto(corpo.cliente)),
        prefer: "return=representation",
      });
      /* `return=representation` sempre traz a linha; se não vier, o `!` estoura
         como o `linha[0]` do original e cai no mesmo 502 do catch */
      return NextResponse.json({ ok: true, cliente: linha![0] });
    }

    if (!id) return NextResponse.json({ erro: "id obrigatório" }, { status: 400 });

    if (acao === "atualizar") {
      const limpo = limparCliente(objeto(corpo.cliente));
      const contrato = await ultimoContrato(id);
      /* Só `status = "assinado"` trava de vez (2026-09-01): antes disso a
         ficha é editável a qualquer momento, mesmo depois de confirmado ou já
         enviado ao casal — se a noiva desiste de um item no meio do processo,
         o fotógrafo corrige aqui em vez de cancelar o contrato inteiro. */
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
      const mudouSnapshot = CAMPOS_SNAPSHOT.some((k) => k in limpo);
      if (!assinado && contrato && mudouSnapshot) {
        const linhas = await rest<LinhaCliente[]>("clientes?id=eq." + id + "&select=*");
        const clienteAtual = linhas && linhas[0];
        if (!clienteAtual) return NextResponse.json({ ok: true });

        const snapshot: Record<string, unknown> = {};
        CAMPOS_SNAPSHOT.forEach((k) => { snapshot[k] = clienteAtual[k]; });

        /* Contrato ainda rascunho E ninguém confirmou nada: ninguém viu esse
           conteúdo ainda, então só atualiza o snapshot em dia, sem versionar
           (não há o que preservar como "versão anterior"). */
        if (contrato.status === "rascunho" && !contrato.jordan_confirmado_em) {
          await rest("contratos?id=eq." + contrato.id, {
            method: "PATCH",
            body: { snapshot: snapshot },
          });
        } else {
          /* Já foi confirmado pelo fotógrafo e/ou enviado ao casal: preserva o
             que estava valendo até agora em contrato_versoes, sobe a versão,
             e limpa a confirmação do fotógrafo — a assinatura dele valia pro
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
              jordan_confirmado_em: contrato.jordan_confirmado_em,
            },
          });
          await rest("contratos?id=eq." + contrato.id, {
            method: "PATCH",
            body: {
              snapshot: snapshot,
              versao: (contrato.versao || 1) + 1,
              jordan_confirmado_em: null,
              jordan_assinatura_tipo: null,
              jordan_assinatura_dataurl: null,
              jordan_assinatura_nome: null,
            },
          });
        }
      }

      return NextResponse.json({ ok: true });
    }

    if (acao === "arquivar") {
      await rest("clientes?id=eq." + id, {
        method: "PATCH", body: { status: "arquivado" },
      });
      return NextResponse.json({ ok: true });
    }

    if (acao === "excluir") {
      /* se veio de conversão, o prospecto ainda referencia este cliente (FK):
         desvincula antes, senão o DELETE é bloqueado (23503). O contrato tem
         ON DELETE CASCADE, então some junto. */
      await rest("prospectos?cliente_id=eq." + id, {
        method: "PATCH", body: { cliente_id: null },
      });
      await rest("clientes?id=eq." + id, { method: "DELETE" });
      return NextResponse.json({ ok: true });
    }

    if (acao === "gerar-contrato") {
      const linhas = await rest<LinhaCliente[]>("clientes?id=eq." + id + "&select=*");
      const cliente = linhas && linhas[0];
      if (!cliente) return NextResponse.json({ erro: "cliente não encontrado" }, { status: 404 });

      /* Nada de validação de completude aqui (decisão de 2026-08-08): o fotógrafo
         gera o contrato com o que tem em mãos e completa depois, e nenhum
         campo da ficha é necessário pro fluxo funcionar — quem assina digita o
         próprio nome e CPF em /assinar, e o e-mail do casal só serve pra
         enviar o PDF depois, sendo opcional lá também. O painel mostra o que
         está faltando na confirmação, como aviso. */
      const base = baseUrlDe(req);

      /* reaproveita um rascunho ainda não enviado ao casal (mesmo já confirmado
         pelo fotógrafo) ou um contrato já enviado/visualizado não expirado */
      const ativos = await rest<LinhaContratoAtivo[]>(
        "contratos?cliente_id=eq." + id +
        "&status=in.(rascunho,enviado,visualizado)&select=id,expira_em&order=criado_em.desc&limit=1",
      );
      /* `new Date(null)` é a época (0), então expira_em nulo conta como
         expirado, exatamente como no original */
      if (!(ativos && ativos.length && new Date(ativos[0].expira_em ?? 0) > new Date())) {
        const snapshot: Record<string, unknown> = {};
        CAMPOS_SNAPSHOT.forEach((k) => { snapshot[k] = cliente[k]; });
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
            template_json_snapshot: modelo ? modelo.conteudo_json : null,
          },
        });
      }

      const link = base + "/revisar-contrato?id=" + id;
      return NextResponse.json({ ok: true, link: link });
    }

    if (acao === "confirmar-contrato") {
      const { tipoAssinatura, assinaturaDataUrl, nomeAssinatura } = corpo;
      if (tipoAssinatura !== "cursiva" && tipoAssinatura !== "manual") {
        return NextResponse.json({ erro: "tipo de assinatura inválido" }, { status: 400 });
      }
      if (typeof assinaturaDataUrl !== "string" || assinaturaDataUrl.length < 100) {
        return NextResponse.json({ erro: "assinatura ausente" }, { status: 400 });
      }
      if (assinaturaDataUrl.length > 500_000) {
        return NextResponse.json({ erro: "assinatura grande demais" }, { status: 413 });
      }
      const ativos = await rest<LinhaContratoConfirmar[]>(
        "contratos?cliente_id=eq." + id +
        "&status=in.(rascunho,enviado,visualizado)" +
        "&select=id,jordan_confirmado_em&order=criado_em.desc&limit=1",
      );
      const contrato = ativos && ativos[0];
      if (!contrato) return NextResponse.json({ erro: "gere o contrato antes de confirmar" }, { status: 404 });
      /* Reconfirmar é o fluxo normal depois de uma edição da ficha que subiu a
         versão do contrato (ver "atualizar" acima, que limpa
         jordan_confirmado_em nesse caso) — a trava de "já assinado" é só a do
         casal, em /api/assinatura (409 "contrato já assinado"). */

      await rest("contratos?id=eq." + contrato.id, {
        method: "PATCH",
        body: {
          jordan_confirmado_em: new Date().toISOString(),
          jordan_assinatura_tipo: tipoAssinatura,
          jordan_assinatura_dataurl: assinaturaDataUrl,
          jordan_assinatura_nome: textoCurto(nomeAssinatura, 120) || "Jordan Santos",
        },
      });
      return NextResponse.json({ ok: true });
    }

    if (acao === "liberar-contrato-cliente") {
      /* Desde 21/10/2026 quem coleta a assinatura é a AUTENTIQUE. Esta ação
         deixou de "revelar o link da nossa tela" e passou a: subir o PDF,
         assinar pelo fotógrafo e devolver o link curto do casal. O formato da
         resposta é o mesmo de antes (link + mensagem de WhatsApp + telefone),
         então o painel não mudou de contrato com o servidor. */
      /* `apenasLink` é a leitura: devolve o link se o documento já existir e
         NUNCA cria nada. É o que a tela de revisão usa ao abrir.
         Sem isso, abrir a revisão de um contrato confirmado mandaria o
         contrato pro casal sem ninguém ter clicado em nada: no fluxo antigo a
         mesma chamada só revelava um link nosso, agora ela sobe o documento e
         dispara o e-mail da Autentique. */
      const apenasLink = corpo.apenasLink === true;

      if (!apenasLink && !autentiqueConfigurada()) {
        return NextResponse.json(
          { erro: "falta a chave da Autentique (AUTENTIQUE_API_TOKEN) pra enviar o contrato" },
          { status: 503 },
        );
      }

      const linhas = await rest<LinhaClienteContato[]>(
        "clientes?id=eq." + id + "&select=noivo,noiva,tel_noivo,tel_noiva,email",
      );
      const cliente = linhas && linhas[0];
      if (!cliente) return NextResponse.json({ erro: "cliente não encontrado" }, { status: 404 });

      /* aceita rascunho (1ª vez), enviado/visualizado (pegar o link de novo) e
         também ASSINADO: o mesmo link abre a via assinada na Autentique, então
         é por ele que o casal pede a segunda via. */
      const ativos = await rest<LinhaContratoLiberar[]>(
        "contratos?cliente_id=eq." + id +
        "&status=in.(rascunho,enviado,visualizado,assinado)" +
        "&select=id,token,status,jordan_confirmado_em,autentique_id,autentique_link,visualizado_em,assinado_em," +
        "snapshot,template_id,template_json_snapshot,jordan_assinatura_dataurl&order=criado_em.desc&limit=1",
      );
      const contrato = ativos && ativos[0];
      if (!contrato) return NextResponse.json({ erro: "nenhum contrato pronto pra enviar" }, { status: 404 });

      /* leitura não cobra nada de ninguém: contrato sem documento (ou ainda
         sem a confirmação do fotógrafo) responde "não há link", e a tela
         mostra o botão de enviar */
      if (apenasLink && (!contrato.autentique_id || !contrato.jordan_confirmado_em)) {
        return NextResponse.json({ ok: true, link: null, mensagem: "" });
      }

      if (!contrato.jordan_confirmado_em) {
        return NextResponse.json({ erro: "confirme (assine) o contrato antes de enviar ao cliente" }, { status: 409 });
      }

      const nomeCasal = [cliente.noivo, cliente.noiva].filter(Boolean).join(" e ");
      const emailCasal = String(
        cliente.email || (contrato.snapshot as { email?: string } | null)?.email || "",
      ).trim();

      let link = contrato.autentique_link || null;
      try {
        if (!contrato.autentique_id) {
          /* a Autentique identifica o signatário pelo e-mail: sem ele não há
             como mandar nem como travar o link naquela pessoa */
          if (!emailCasal) {
            return NextResponse.json(
              { erro: "cadastre o e-mail do casal na ficha antes de enviar pra assinatura" },
              { status: 409 },
            );
          }
          const enviado = await enviarParaAssinatura(contrato, { nome: nomeCasal, email: emailCasal });
          link = enviado.link;
        } else {
          /* já existe documento: aproveita pra atualizar o estado de lá */
          const atual = await sincronizarContrato(contrato);
          link = atual?.link || link;
        }
      } catch (e) {
        console.error("autentique falhou:", (e as Error).message);
        return NextResponse.json(
          { erro: "não deu pra falar com a Autentique agora, tente de novo em instantes" },
          { status: 502 },
        );
      }

      if (!link) {
        return NextResponse.json(
          { erro: "a Autentique ainda não devolveu o link do casal, tente de novo em instantes" },
          { status: 502 },
        );
      }

      /* o link vai pelo WhatsApp, na mão do fotógrafo, como sempre foi (a
         Autentique também avisa por e-mail, mas o casal responde é no zap) */
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

      return NextResponse.json({
        ok: true, link: link, mensagem: mensagem, assinado: jaAssinado,
        telefone: String(cliente.tel_noivo || cliente.tel_noiva || "").replace(/\D/g, ""),
      });
    }

    if (acao === "sincronizar-contrato") {
      /* O painel chama ao abrir a ficha e a revisão: sem um endereço público
         pra receber webhook (o domínio do estúdio não existe), é assim que o
         "visto" e o "assinado" da Autentique chegam até aqui. Falha de rede
         não é erro de tela: devolve ok e o painel segue com o que tem. */
      if (!autentiqueConfigurada()) return NextResponse.json({ ok: true, sincronizado: false });
      const ativos = await rest<LinhaContratoLiberar[]>(
        "contratos?cliente_id=eq." + id +
        "&autentique_id=not.is.null&status=in.(enviado,visualizado)" +
        "&select=id,token,status,jordan_confirmado_em,autentique_id,autentique_link,visualizado_em,assinado_em," +
        "snapshot,template_id,template_json_snapshot,jordan_assinatura_dataurl&order=criado_em.desc&limit=1",
      );
      const contrato = ativos && ativos[0];
      if (!contrato) return NextResponse.json({ ok: true, sincronizado: false });
      try {
        const atual = await sincronizarContrato(contrato);
        return NextResponse.json({ ok: true, sincronizado: true, status: atual?.status ?? contrato.status });
      } catch (e) {
        console.error("sincronizar autentique falhou:", (e as Error).message);
        return NextResponse.json({ ok: true, sincronizado: false });
      }
    }

    if (acao === "cancelar-contrato") {
      /* apaga TAMBÉM na Autentique, senão o link curto segue de pé e um
         contrato cancelado aqui poderia voltar assinado de lá. Best-effort: se
         a API estiver fora, o cancelamento no painel não fica refém dela, mas
         o erro vai pro log pra alguém perceber. */
      const pendentes = await rest<{ id: string; autentique_id: string | null }[]>(
        "contratos?cliente_id=eq." + id + "&status=in.(rascunho,enviado,visualizado)&select=id,autentique_id",
      );
      for (const c of pendentes || []) {
        if (!c.autentique_id) continue;
        try { await apagarDocumentoAutentique(c.autentique_id); }
        catch (e) { console.error("autentique: não deu pra apagar o documento:", (e as Error).message); }
      }

      await rest(
        "contratos?cliente_id=eq." + id + "&status=in.(rascunho,enviado,visualizado)",
        { method: "PATCH", body: { status: "cancelado" } },
      );
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ erro: "ação desconhecida" }, { status: 400 });
  } catch (e) {
    console.error("estudio falhou:", (e as Error).message);
    return NextResponse.json({ erro: "banco indisponível, tente de novo" }, { status: 502 });
  }
}

/* O original checava a sessão e depois respondia 405 com JSON pra qualquer
   método fora GET/POST. O App Router só devolve 405 sozinho, sem corpo; isto
   mantém a resposta (e a ordem: 401 antes do 405) igual. */
async function metodoNaoPermitido() {
  const sessao = await sessaoAtual("admin");
  if (!sessao) return NextResponse.json({ erro: "sessão inválida" }, { status: 401 });
  return NextResponse.json({ erro: "método não permitido" }, { status: 405 });
}
export const PUT = metodoNaoPermitido;
export const PATCH = metodoNaoPermitido;
export const DELETE = metodoNaoPermitido;

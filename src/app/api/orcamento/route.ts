/*
  Orçamento montado no portfólio (/) → cria o CLIENTE direto, sem estágio de
  prospecção no meio (decisão de 2026-07-24: o link do site geralmente só é
  mandado DEPOIS de uma reunião, pra quem já quer fechar — então o formulário já
  pede tudo que o contrato precisa: casal, CPFs, endereço, evento). Público (sem
  sessão): escreve no Supabase com a service role. O fotógrafo recebe um e-mail
  (template com a paleta da marca) avisando do cliente novo — melhor esforço: se
  o Resend falhar, o cliente já foi salvo mesmo assim.

  Portado de `api/orcamento.js` do estúdio do Jordan.

  POST {noivo, noiva, cpfNoivo, cpfNoiva, contato, email, cep, endereco, numero,
        complemento?, bairro, cidade, estado, dataEvento, horario, local,
        itens?, totalNumero?, entradaNumero?}
    → upsert em `clientes` (status "novo", origem "Orçamento do site";
      reenvio do mesmo casal atualiza — ver a busca explícita no fim).
*/
import { NextResponse } from "next/server";
import { rest, supabaseConfigurado } from "@/lib/supabase";
import { textoCurto, criarLimite, ipDe, normalizarCpf } from "@/lib/util";
import { enviarEmail, DESTINO_JORDAN } from "@/lib/email";

const estourou = criarLimite(15 * 60_000, 20);
const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

/** Item estruturado do orçamento: pré-carrega no seletor do contrato. */
type Item = { id: string | null; nome: string | null; valor: number | null };

/** O que o template de e-mail precisa saber do cadastro. */
type DadosEmail = {
  noivo: string | null;
  noiva: string | null;
  cpfNoivoFmt: string;
  cpfNoivaFmt: string;
  contato: string;
  email: string;
  endereco: string;
  numero: string;
  complemento: string | null;
  bairro: string;
  cidade: string;
  estado: string;
  cep: string;
  dataBr: string | null;
  horario: string;
  local: string;
  itens: Item[];
  total: number | null;
};

/** Objeto do corpo, ou {} quando veio outra coisa (o original lia `req.body || {}`). */
function objeto(valor: unknown): Record<string, unknown> {
  return valor && typeof valor === "object" ? (valor as Record<string, unknown>) : {};
}

function escHtml(s: unknown): string {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function dataBr(iso: string | null): string | null {
  if (!iso) return null;
  const p = iso.split("-");
  return p[2] + "/" + p[1] + "/" + p[0];
}

function baseUrlDe(req: Request): string {
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "";
  const proto = host.includes("localhost") ? "http" : (req.headers.get("x-forwarded-proto") || "https").split(",")[0];
  return proto + "://" + host;
}

/* e-mail de "novo cliente" pro fotógrafo, no estilo visual do site/painel
   (petróleo #003646, aço #4F6278, off-white #E8E1DC) */
function templateNovoCliente(c: DadosEmail, link: string): { html: string; texto: string } {
  /* itens vem vazio SEMPRE, daqui pra frente (2026-07-31): o casal não escolhe
     mais pacote/adicional no site — quem escolhe é o fotógrafo, depois, no
     painel. Não é mais uma exceção rara, é o caso normal. O campo continua
     opcional no payload (compat com uma integração futura), então o código
     que lida com itens preenchido fica aqui, só o texto do vazio muda. */
  const linhaItens = c.itens.length
    ? c.itens.map((i) =>
        '<tr>' +
          '<td style="padding:9px 0;border-bottom:1px solid #E8E1DC;font-size:14px;color:#1D1D1B">' + escHtml(i.nome) + '</td>' +
          '<td style="padding:9px 0;border-bottom:1px solid #E8E1DC;font-size:14px;color:#4F6278;font-weight:600;text-align:right;white-space:nowrap">' +
          (i.valor != null ? brl.format(i.valor) : "") + '</td></tr>',
      ).join("")
    : '<tr><td style="padding:9px 0;font-size:14px;color:#706F6F" colspan="2">A definir com o Jordan no Estúdio.</td></tr>';

  const linhaTotal = c.total != null
    ? '<tr><td style="padding:14px 0 0;font-size:14px;font-weight:700;color:#1D1D1B">Total</td>' +
      '<td style="padding:14px 0 0;font-size:16px;font-weight:700;color:#003646;text-align:right">' + brl.format(c.total) + '</td></tr>'
    : "";

  function linha(rotulo: string, valor: string | null | undefined, href?: string): string {
    if (!valor) return "";
    const conteudo = href
      ? '<a href="' + href + '" style="color:#003646;text-decoration:none">' + escHtml(valor) + '</a>'
      : escHtml(valor);
    return '<tr><td style="padding:4px 0;font-size:13px;color:#706F6F;width:120px;vertical-align:top">' + rotulo + '</td>' +
      '<td style="padding:4px 0;font-size:14px;color:#1D1D1B">' + conteudo + '</td></tr>';
  }

  const endereco = [c.endereco, c.numero].filter(Boolean).join(", ") +
    (c.complemento ? " (" + c.complemento + ")" : "") +
    (c.bairro ? " · " + c.bairro : "") +
    (c.cidade ? " · " + c.cidade + (c.estado ? "/" + c.estado : "") : "") +
    (c.cep ? " · CEP " + c.cep : "");

  /* o contrato pode ter só uma pessoa (2026-08-08): concatenar cru deixaria
     "Ana & " no título e "123… / " na linha de CPF */
  const nomes = [c.noivo, c.noiva].filter(Boolean).join(" & ") || "(sem nome)";
  const cpfs = [c.cpfNoivoFmt, c.cpfNoivaFmt].filter(Boolean).join(" / ");
  const rotuloCpf = (c.noivo && c.noiva) ? "CPF noivo / noiva" : "CPF";

  const html =
    '<div style="background:#F6F7F9;padding:32px 16px;font-family:Georgia,\'Times New Roman\',serif">' +
      '<div style="max-width:520px;margin:0 auto;background:#FFFFFF;border-radius:14px;overflow:hidden;border:1px solid #E8E1DC">' +
        '<div style="background:#003646;padding:22px 28px">' +
          '<div style="font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:rgba(255,255,255,.65);font-family:Helvetica,Arial,sans-serif;margin-bottom:6px">Novo cliente</div>' +
          '<div style="font-size:22px;color:#FFFFFF;font-family:Georgia,\'Times New Roman\',serif">' + escHtml(nomes) + '</div>' +
        '</div>' +
        '<div style="padding:26px 28px 8px">' +
          '<table style="width:100%;border-collapse:collapse;font-family:Helvetica,Arial,sans-serif" cellpadding="0" cellspacing="0">' +
            linha("WhatsApp", c.contato, "https://wa.me/" + String(c.contato).replace(/\D/g, "")) +
            linha("E-mail", c.email, "mailto:" + c.email) +
            linha(rotuloCpf, cpfs) +
            linha("Endereço", endereco) +
            linha("Data do evento", c.dataBr) +
            linha("Horário", c.horario) +
            linha("Local", c.local) +
            linha("Origem", "Orçamento do site") +
          '</table>' +
        '</div>' +
        '<div style="padding:4px 28px 24px">' +
          '<div style="font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:#706F6F;font-family:Helvetica,Arial,sans-serif;margin:14px 0 4px">Itens do pacote</div>' +
          '<table style="width:100%;border-collapse:collapse;font-family:Helvetica,Arial,sans-serif" cellpadding="0" cellspacing="0">' +
            linhaItens + linhaTotal +
          '</table>' +
        '</div>' +
        '<div style="padding:0 28px 28px">' +
          '<a href="' + link + '" style="display:block;text-align:center;background:#003646;color:#FFFFFF;font-family:Helvetica,Arial,sans-serif;font-size:13px;font-weight:600;letter-spacing:.05em;text-transform:uppercase;text-decoration:none;padding:13px;border-radius:8px">Abrir no Estúdio</a>' +
        '</div>' +
      '</div>' +
    '</div>';

  const texto =
    "Novo cliente: " + nomes + "\n" +
    "WhatsApp: " + c.contato + "\n" +
    "E-mail: " + c.email + "\n" +
    rotuloCpf + ": " + cpfs + "\n" +
    "Endereço: " + endereco + "\n" +
    "Data do evento: " + c.dataBr + "\n" +
    "Horário: " + c.horario + "\n" +
    "Local: " + c.local + "\n" +
    "Origem: Orçamento do site\n\n" +
    (c.itens.length
      ? "Itens do pacote:\n" + c.itens.map((i) => "- " + i.nome + (i.valor != null ? " (" + brl.format(i.valor) + ")" : "")).join("\n") + "\n"
      : "Itens: a definir com o Jordan no Estúdio.\n") +
    (c.total != null ? "\nTotal: " + brl.format(c.total) + "\n" : "") +
    "\nAbrir no Estúdio: " + link;

  return { html: html, texto: texto };
}

export async function POST(req: Request) {
  const dados = objeto(await req.json().catch(() => ({})));
  const noivo = textoCurto(dados.noivo, 120);
  const noiva = textoCurto(dados.noiva, 120);
  const cpfNoivo = normalizarCpf(dados.cpfNoivo);
  const cpfNoiva = normalizarCpf(dados.cpfNoiva);
  const contato = textoCurto(dados.contato, 40);
  const email = textoCurto(dados.email, 160);
  const cep = textoCurto(String(dados.cep || "").replace(/\D/g, ""), 12);
  const endereco = textoCurto(dados.endereco, 160);
  const numero = textoCurto(dados.numero, 20);
  const complemento = textoCurto(dados.complemento, 80);
  const bairro = textoCurto(dados.bairro, 100);
  const cidade = textoCurto(dados.cidade, 100);
  const estado = textoCurto(dados.estado, 40);
  const local = textoCurto(dados.local, 160);
  const horario = typeof dados.horario === "string" && /^\d{2}:\d{2}/.test(dados.horario) ? dados.horario : null;
  const dataIso = typeof dados.dataEvento === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(dados.dataEvento) ? dados.dataEvento : null;

  /* Basta o NOME de UMA das duas pessoas: dá pra contratar só com o noivo, só
     com a noiva, ou com os dois (2026-08-08). O CPF é opcional desde
     2026-08-11 — o fotógrafo atende clientes que não têm CPF, e exigir travaria
     o cadastro deles. Quando vier, tem que estar completo: meio CPF no
     contrato é pior do que nenhum. */
  if (!noivo && !noiva) {
    return NextResponse.json({ erro: "informe o nome de pelo menos um dos contratantes" }, { status: 400 });
  }
  if ((cpfNoivo && cpfNoivo.length !== 11) || (cpfNoiva && cpfNoiva.length !== 11)) {
    return NextResponse.json({ erro: "CPF precisa ter 11 dígitos, ou pode ficar em branco" }, { status: 400 });
  }
  if ((cpfNoivo && !noivo) || (cpfNoiva && !noiva)) {
    return NextResponse.json({ erro: "informe o nome de quem tem o CPF preenchido" }, { status: 400 });
  }

  if (!contato || !email || !cep || !endereco || !numero || !bairro ||
    !cidade || !estado || !dataIso || !horario || !local) {
    return NextResponse.json({ erro: "preencha todos os campos obrigatórios" }, { status: 400 });
  }

  if (!supabaseConfigurado()) {
    return NextResponse.json({ erro: "cadastro indisponível no momento" }, { status: 503 });
  }

  const ip = ipDe(req.headers);
  if (estourou(ip || "sem-ip")) {   /* ipDe devolve null quando não há proxy */
    return NextResponse.json({ erro: "muitos envios, aguarde alguns minutos" }, { status: 429 });
  }

  /* itens estruturados: [{id,nome,valor}] — pré-carregam no seletor do contrato */
  const itens: Item[] = Array.isArray(dados.itens)
    ? dados.itens.slice(0, 30).map((i: unknown): Item => {
        const it = objeto(i);
        return {
          id: textoCurto(it.id, 40),
          nome: textoCurto(it.nome, 160),
          valor: typeof it.valor === "number" ? it.valor : null,
        };
      }).filter((i) => i.id)
    : [];
  const totalNum = typeof dados.totalNumero === "number" ? dados.totalNumero : null;
  const entradaNum = typeof dados.entradaNumero === "number" ? dados.entradaNumero : null;

  const linha = {
    status: "novo",
    noivo: noivo, noiva: noiva,
    /* null, NUNCA "" — ver o comentário do upsert abaixo */
    cpf_noivo: cpfNoivo || null, cpf_noiva: cpfNoiva || null,
    tel_noivo: contato, email: email,
    cep: cep, endereco: endereco, numero: numero, complemento: complemento || null,
    bairro: bairro, cidade: cidade, estado: estado,
    data_evento: dataIso, horario: horario, local_evento: local,
    itens: itens, total: totalNum, entrada: entradaNum,
    origem: "Orçamento do site", observacoes: null,
  };

  /* Reenviar o mesmo cadastro atualiza a ficha em vez de duplicar.

     Isto era um upsert com `on_conflict=cpf_noivo,data_evento`, apoiado no
     índice único do banco. Não serve mais desde que o CPF do noivo virou
     opcional: o índice trata "" como valor comum, então DOIS casais
     diferentes sem noivo e com a mesma data do evento colidiriam na mesma
     chave ('', data) — e o merge-duplicates faria o segundo cadastro
     sobrescrever a ficha inteira do primeiro, sem erro nenhum.

     Agora a busca é explícita, pelo CPF de quem existir (o índice continua
     no banco protegendo o caso comum). O CPF ausente vai como null, que o
     Postgres considera distinto a cada linha — dois cadastros sem noivo na
     mesma data convivem como fichas separadas, que é o certo.

     Sem CPF nenhum (que passou a ser possível em 2026-08-11) a busca cai pro
     nome de quem existir. É mais frágil — um erro de digitação no reenvio
     cria uma ficha nova em vez de atualizar —, mas duplicar é o modo de
     falhar seguro; o perigoso seria casar fichas que não são a mesma. */
  const chaveCpf = cpfNoivo || cpfNoiva;
  const filtro = chaveCpf
    ? "&or=(cpf_noivo.eq." + chaveCpf + ",cpf_noiva.eq." + chaveCpf + ")"
    : (noivo ? "&noivo=eq." : "&noiva=eq.") + encodeURIComponent(noivo || noiva || "");
  try {
    const achados = await rest<{ id: string }[]>(
      "clientes?data_evento=eq." + encodeURIComponent(dataIso) + filtro + "&select=id&limit=1",
    );
    const existente = achados && achados[0];
    if (existente) {
      await rest("clientes?id=eq." + existente.id, { method: "PATCH", body: linha });
    } else {
      await rest("clientes", { method: "POST", prefer: "return=minimal", body: linha });
    }
  } catch (e) {
    console.error("orcamento falhou:", (e as Error).message);
    return NextResponse.json({ erro: "não deu pra registrar, tente de novo" }, { status: 502 });
  }

  /* avisa o fotógrafo por e-mail, melhor esforço: o cliente já foi salvo,
     falha aqui não pode derrubar a resposta pro casal */
  try {
    const link = baseUrlDe(req) + "/estudio";
    const conteudo = templateNovoCliente({
      noivo: noivo, noiva: noiva,
      cpfNoivoFmt: cpfNoivo, cpfNoivaFmt: cpfNoiva,
      contato: contato, email: email,
      endereco: endereco, numero: numero, complemento: complemento, bairro: bairro, cidade: cidade, estado: estado, cep: cep,
      dataBr: dataBr(dataIso), horario: horario, local: local,
      itens: itens, total: totalNum,
    }, link);
    await enviarEmail({
      to: DESTINO_JORDAN,
      subject: "Novo cliente · " + ([noivo, noiva].filter(Boolean).join(" & ") || "(sem nome)"),
      html: conteudo.html,
      text: conteudo.texto,
    });
  } catch (e) {
    console.error("e-mail de novo cliente falhou:", (e as Error).message);
  }

  return NextResponse.json({ ok: true });
}

/* O original respondia 405 com JSON pra qualquer método fora POST. O App
   Router só devolve 405 sozinho, sem corpo; isto mantém a resposta igual. */
function metodoNaoPermitido() {
  return NextResponse.json({ erro: "método não permitido" }, { status: 405 });
}
export const GET = metodoNaoPermitido;
export const PUT = metodoNaoPermitido;
export const PATCH = metodoNaoPermitido;
export const DELETE = metodoNaoPermitido;

/*
  Orçamento montado no portfólio (/) → cria o CLIENTE direto, sem estágio de
  prospecção no meio (decisão de 2026-07-24: o link do site geralmente só é
  mandado DEPOIS de uma reunião, pra quem já quer fechar — então o formulário já
  pede tudo que o contrato precisa: casal, CPFs, endereço, evento). Público (sem
  sessão): escreve no Supabase com a service role. O Jordan recebe um e-mail
  (template com a paleta da marca) avisando do cliente novo — melhor esforço: se
  o Resend falhar, o cliente já foi salvo mesmo assim.

  POST {noivo, noiva, cpfNoivo, cpfNoiva, contato, email, cep, endereco, numero,
        complemento?, bairro, cidade, estado, dataEvento, horario, local,
        itens?, totalNumero?, entradaNumero?}
    → upsert em `clientes` (status "novo", origem "Orçamento do site";
      on_conflict cpf_noivo+data_evento — reenvio do mesmo casal atualiza).
*/

import { rest, supabaseConfigurado } from "./_lib/supabase.js";
import { textoCurto, criarLimite, ipDe } from "./_lib/util.js";
import { enviarEmail, DESTINO_JORDAN } from "./_lib/email.js";
import { normalizarCpf } from "./_lib/sessao.js";

const estourou = criarLimite(15 * 60_000, 20);
const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

function escHtml(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function dataBr(iso) {
  if (!iso) return null;
  var p = iso.split("-");
  return p[2] + "/" + p[1] + "/" + p[0];
}

function baseUrlDe(req) {
  var host = req.headers["x-forwarded-host"] || req.headers.host;
  var proto = host.includes("localhost") ? "http" : (req.headers["x-forwarded-proto"] || "https").split(",")[0];
  return proto + "://" + host;
}

/* e-mail de "novo cliente" pro Jordan, no estilo visual do site/painel
   (petróleo #003646, aço #4F6278, off-white #E8E1DC) */
function templateNovoCliente(c, link) {
  /* itens vem vazio SEMPRE, daqui pra frente (2026-07-31): o casal não escolhe
     mais pacote/adicional no site — quem escolhe é o Jordan, depois, no
     /estudio. Não é mais uma exceção rara, é o caso normal. O campo continua
     opcional no payload (compat com uma integração futura), então o código
     que lida com itens preenchido fica aqui, só o texto do vazio muda. */
  var linhaItens = c.itens.length
    ? c.itens.map(function (i) {
        return '<tr>' +
          '<td style="padding:9px 0;border-bottom:1px solid #E8E1DC;font-size:14px;color:#1D1D1B">' + escHtml(i.nome) + '</td>' +
          '<td style="padding:9px 0;border-bottom:1px solid #E8E1DC;font-size:14px;color:#4F6278;font-weight:600;text-align:right;white-space:nowrap">' +
          (i.valor != null ? brl.format(i.valor) : "") + '</td></tr>';
      }).join("")
    : '<tr><td style="padding:9px 0;font-size:14px;color:#706F6F" colspan="2">A definir com o Jordan no Estúdio.</td></tr>';

  var linhaTotal = c.total != null
    ? '<tr><td style="padding:14px 0 0;font-size:14px;font-weight:700;color:#1D1D1B">Total</td>' +
      '<td style="padding:14px 0 0;font-size:16px;font-weight:700;color:#003646;text-align:right">' + brl.format(c.total) + '</td></tr>'
    : "";

  function linha(rotulo, valor, href) {
    if (!valor) return "";
    var conteudo = href
      ? '<a href="' + href + '" style="color:#003646;text-decoration:none">' + escHtml(valor) + '</a>'
      : escHtml(valor);
    return '<tr><td style="padding:4px 0;font-size:13px;color:#706F6F;width:120px;vertical-align:top">' + rotulo + '</td>' +
      '<td style="padding:4px 0;font-size:14px;color:#1D1D1B">' + conteudo + '</td></tr>';
  }

  var endereco = [c.endereco, c.numero].filter(Boolean).join(", ") +
    (c.complemento ? " (" + c.complemento + ")" : "") +
    (c.bairro ? " · " + c.bairro : "") +
    (c.cidade ? " · " + c.cidade + (c.estado ? "/" + c.estado : "") : "") +
    (c.cep ? " · CEP " + c.cep : "");

  /* o contrato pode ter só uma pessoa (2026-08-08): concatenar cru deixaria
     "Ana & " no título e "123… / " na linha de CPF */
  var nomes = [c.noivo, c.noiva].filter(Boolean).join(" & ") || "(sem nome)";
  var cpfs = [c.cpfNoivoFmt, c.cpfNoivaFmt].filter(Boolean).join(" / ");
  var rotuloCpf = (c.noivo && c.noiva) ? "CPF noivo / noiva" : "CPF";

  var html =
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

  var texto =
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
      ? "Itens do pacote:\n" + c.itens.map(function (i) { return "- " + i.nome + (i.valor != null ? " (" + brl.format(i.valor) + ")" : ""); }).join("\n") + "\n"
      : "Itens: a definir com o Jordan no Estúdio.\n") +
    (c.total != null ? "\nTotal: " + brl.format(c.total) + "\n" : "") +
    "\nAbrir no Estúdio: " + link;

  return { html: html, texto: texto };
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ erro: "método não permitido" });
  }

  const dados = req.body || {};
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

  /* Basta UMA das duas pessoas (decisão de 2026-08-08): dá pra contratar só
     com o noivo, só com a noiva, ou com os dois. Quem for informado, porém,
     precisa vir COMPLETO — nome sem CPF viraria contratante sem identificação
     no documento. */
  const temNoivo = !!noivo || cpfNoivo.length > 0;
  const temNoiva = !!noiva || cpfNoiva.length > 0;
  const noivoOk = !!noivo && cpfNoivo.length === 11;
  const noivaOk = !!noiva && cpfNoiva.length === 11;

  if (!temNoivo && !temNoiva) {
    return res.status(400).json({ erro: "informe o nome e o CPF de pelo menos um dos contratantes" });
  }
  if ((temNoivo && !noivoOk) || (temNoiva && !noivaOk)) {
    return res.status(400).json({ erro: "de quem for preencher, informe nome e CPF (11 dígitos)" });
  }

  const faltando = !contato || !email || !cep || !endereco || !numero || !bairro ||
    !cidade || !estado || !dataIso || !horario || !local;
  if (faltando) {
    return res.status(400).json({ erro: "preencha todos os campos obrigatórios" });
  }

  if (!supabaseConfigurado()) {
    return res.status(503).json({ erro: "cadastro indisponível no momento" });
  }

  const ip = ipDe(req);
  if (estourou(ip || "sem-ip")) {   /* ipDe devolve null quando não há proxy */
    return res.status(429).json({ erro: "muitos envios, aguarde alguns minutos" });
  }

  /* itens estruturados: [{id,nome,valor}] — pré-carregam no seletor do contrato */
  const itens = Array.isArray(dados.itens)
    ? dados.itens.slice(0, 30).map(function (i) {
        return {
          id: textoCurto(i && i.id, 40),
          nome: textoCurto(i && i.nome, 160),
          valor: typeof (i && i.valor) === "number" ? i.valor : null
        };
      }).filter(function (i) { return i.id; })
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
    origem: "Orçamento do site", observacoes: null
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
     mesma data convivem como fichas separadas, que é o certo. */
  const chave = cpfNoivo || cpfNoiva;
  try {
    const achados = await rest(
      "clientes?data_evento=eq." + encodeURIComponent(dataIso) +
      "&or=(cpf_noivo.eq." + chave + ",cpf_noiva.eq." + chave + ")" +
      "&select=id&limit=1"
    );
    const existente = achados && achados[0];
    if (existente) {
      await rest("clientes?id=eq." + existente.id, { method: "PATCH", body: linha });
    } else {
      await rest("clientes", { method: "POST", prefer: "return=minimal", body: linha });
    }
  } catch (e) {
    console.error("orcamento falhou:", e.message);
    return res.status(502).json({ erro: "não deu pra registrar, tente de novo" });
  }

  /* avisa o Jordan por e-mail, melhor esforço: o cliente já foi salvo,
     falha aqui não pode derrubar a resposta pro casal */
  try {
    var link = baseUrlDe(req) + "/estudio";
    var conteudo = templateNovoCliente({
      noivo: noivo, noiva: noiva,
      cpfNoivoFmt: cpfNoivo, cpfNoivaFmt: cpfNoiva,
      contato: contato, email: email,
      endereco: endereco, numero: numero, complemento: complemento, bairro: bairro, cidade: cidade, estado: estado, cep: cep,
      dataBr: dataBr(dataIso), horario: horario, local: local,
      itens: itens, total: totalNum
    }, link);
    await enviarEmail({
      to: DESTINO_JORDAN,
      subject: "Novo cliente · " + ([noivo, noiva].filter(Boolean).join(" & ") || "(sem nome)"),
      html: conteudo.html,
      text: conteudo.texto
    });
  } catch (e) {
    console.error("e-mail de novo cliente falhou:", e.message);
  }

  return res.status(200).json({ ok: true });
}

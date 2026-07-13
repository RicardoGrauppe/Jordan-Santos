/*
  Recebe o questionário preenchido e dispara DOIS efeitos independentes:
  1. E-mail pro Jordan via Resend, com o contrato em PDF anexado (como sempre).
  2. Cadastro automático do casal no Supabase (upsert por cpf_noivo + data_evento),
     que alimenta o painel do estúdio (/estudio) e a área do casal (/cliente).
  Um falhar nunca bloqueia o outro; a resposta informa os dois status.

  Configuração (painel da Vercel):
  - RESEND_API_KEY. Enquanto o domínio não estiver verificado no Resend, o remetente
    precisa ser onboarding@resend.dev e o destinatário o e-mail dono da conta (o do
    Jordan). Depois de verificar jordansantosfotografia.com.br, trocar REMETENTE.
  - SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY. Sem elas o cadastro é pulado em
    silêncio (cadastroOk:false) e o e-mail continua funcionando sozinho.
*/

import {
  rest, supabaseConfigurado, criarUsuarioAuth, buscarUsuarioAuth, senhaTemporaria
} from "./_lib/supabase.js";
import { normalizarCpf } from "./_lib/sessao.js";

const DESTINO = "jordansantosfotografia@gmail.com";
const REMETENTE = "Site Jordan Santos <onboarding@resend.dev>";

/* base64 de ~5MB de PDF; acima disso o payload estoura o limite da Vercel (4.5MB no body) */
const LIMITE_PDF_BASE64 = 6_000_000;

function textoCurto(valor, max) {
  return valor && typeof valor === "string" ? valor.slice(0, max || 200) : null;
}

async function enviarEmail(dados) {
  const chave = process.env.RESEND_API_KEY;
  if (!chave) throw new Error("RESEND_API_KEY ausente");

  const texto = (rotulo, valor) =>
    valor && typeof valor === "string" ? rotulo + ": " + valor.slice(0, 200) + "\n" : "";

  const listaItens = Array.isArray(dados.itens)
    ? dados.itens.slice(0, 20).map((i) => "- " + String(i).slice(0, 200)).join("\n")
    : "";

  const corpo =
    "Um casal preencheu o questionário do contrato no site. O contrato preenchido (PDF) está em anexo.\n\n" +
    texto("Casal", [dados.noivo, dados.noiva].filter(Boolean).join(" e ")) +
    texto("Telefones", [dados.telNoivo, dados.telNoiva].filter(Boolean).join(" / ")) +
    texto("E-mail", dados.email) +
    texto("Data do casamento", dados.dataEvento) +
    texto("Local", [dados.local, dados.horario].filter(Boolean).join(", às ")) +
    (listaItens ? "\nPacote e adicionais:\n" + listaItens + "\n" : "") +
    texto("Valor total", dados.total) +
    texto("Entrada (30%)", dados.entrada) +
    texto("Como conheceram", dados.origem) +
    (dados.observacoes && typeof dados.observacoes === "string"
      ? "\nObservações do casal:\n" + dados.observacoes.slice(0, 1000) + "\n"
      : "");

  const assunto =
    "Questionário de contrato preenchido: " +
    ([dados.noivo, dados.noiva].filter(Boolean).join(" e ") || "casal não identificado");

  const resposta = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + chave,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: REMETENTE,
      to: [DESTINO],
      subject: assunto,
      text: corpo,
      attachments: [
        {
          filename: typeof dados.nomeArquivo === "string" && dados.nomeArquivo
            ? dados.nomeArquivo.slice(0, 120) : "contrato.pdf",
          content: dados.pdfBase64
        }
      ]
    })
  });

  if (!resposta.ok) {
    console.error("Falha no Resend:", resposta.status);
    throw new Error("resend " + resposta.status);
  }
}

async function salvarCliente(dados) {
  if (!supabaseConfigurado()) throw new Error("supabase não configurado");

  const cpfNoivo = normalizarCpf(dados.cpfNoivo);
  const dataIso = typeof dados.dataEventoIso === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(dados.dataEventoIso) ? dados.dataEventoIso : null;

  /* sem as chaves do upsert não há como identificar o casal depois */
  if (cpfNoivo.length !== 11 || !dataIso) throw new Error("dados de cadastro incompletos");

  const itens = Array.isArray(dados.itensDetalhados)
    ? dados.itensDetalhados.slice(0, 30).map((i) => ({
        id: textoCurto(i.id, 40),
        nome: textoCurto(i.nome, 120),
        valor: typeof i.valor === "number" ? i.valor : null
      }))
    : [];

  const linhas = await rest("clientes?on_conflict=cpf_noivo,data_evento", {
    method: "POST",
    prefer: "resolution=merge-duplicates,return=representation",
    body: {
      noivo: textoCurto(dados.noivo), cpf_noivo: cpfNoivo,
      noiva: textoCurto(dados.noiva), cpf_noiva: normalizarCpf(dados.cpfNoiva) || null,
      tel_noivo: textoCurto(dados.telNoivo, 40), tel_noiva: textoCurto(dados.telNoiva, 40),
      email: textoCurto(dados.email, 160),
      cep: textoCurto(dados.cep, 12), endereco: textoCurto(dados.endereco),
      numero: textoCurto(dados.numero, 20), complemento: textoCurto(dados.complemento),
      bairro: textoCurto(dados.bairro), cidade: textoCurto(dados.cidade),
      estado: textoCurto(dados.estado, 40),
      data_evento: dataIso,
      horario: textoCurto(dados.horario, 8),
      local_evento: textoCurto(dados.local),
      itens: itens,
      total: typeof dados.totalNumero === "number" ? dados.totalNumero : null,
      entrada: typeof dados.entradaNumero === "number" ? dados.entradaNumero : null,
      origem: textoCurto(dados.origem, 60),
      observacoes: textoCurto(dados.observacoes, 1000)
    }
  });

  /* cria o usuário do Supabase Auth do casal (senha aleatória descartada;
     o Jordan gera a senha real no /estudio na hora de enviar o link).
     Falha aqui não derruba o cadastro: é só o vínculo de login. */
  try {
    const linha = linhas && linhas[0];
    if (linha && linha.email && !linha.auth_user_id) {
      let usuario = await criarUsuarioAuth(linha.email, senhaTemporaria());
      if (!usuario) usuario = await buscarUsuarioAuth(linha.email);
      if (usuario) {
        await rest("clientes?id=eq." + linha.id, {
          method: "PATCH", body: { auth_user_id: usuario.id }
        });
      }
    }
  } catch (e) {
    console.error("vínculo de acesso falhou:", e.message);
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ erro: "método não permitido" });
  }

  const dados = req.body || {};

  if (!dados.pdfBase64 || typeof dados.pdfBase64 !== "string") {
    return res.status(400).json({ erro: "pdf ausente" });
  }
  if (dados.pdfBase64.length > LIMITE_PDF_BASE64) {
    return res.status(413).json({ erro: "pdf grande demais" });
  }

  const [emailOk, cadastroOk] = await Promise.all([
    enviarEmail(dados).then(() => true, (e) => { console.error("e-mail falhou:", e.message); return false; }),
    salvarCliente(dados).then(() => true, (e) => { console.error("cadastro falhou:", e.message); return false; })
  ]);

  const ok = emailOk || cadastroOk;
  return res.status(ok ? 200 : 502).json({ ok, emailOk, cadastroOk });
}

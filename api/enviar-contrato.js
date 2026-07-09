/*
  Envia o contrato gerado (PDF) por e-mail pro Jordan via Resend.

  Configuração necessária (uma vez, no painel da Vercel):
  - Variável de ambiente RESEND_API_KEY com a chave da conta Resend.
  - Enquanto o domínio não estiver verificado no Resend, o remetente precisa ser
    onboarding@resend.dev e o destinatário precisa ser o e-mail dono da conta Resend
    (por isso a conta deve ser criada com o e-mail do Jordan). Depois de verificar o
    domínio jordansantosfotografia.com.br, trocar REMETENTE pra algo como
    "Contratos <contrato@jordansantosfotografia.com.br>".
*/

const DESTINO = "jordansantosfotografia@gmail.com";
const REMETENTE = "Site Jordan Santos <onboarding@resend.dev>";

/* base64 de ~5MB de PDF; acima disso o payload estoura o limite da Vercel (4.5MB no body) */
const LIMITE_PDF_BASE64 = 6_000_000;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ erro: "método não permitido" });
  }

  const chave = process.env.RESEND_API_KEY;
  if (!chave) {
    return res.status(500).json({ erro: "RESEND_API_KEY não configurada na Vercel" });
  }

  const {
    pdfBase64, nomeArquivo,
    noivo, noiva, telNoivo, telNoiva, email,
    dataEvento, local, horario,
    origem, observacoes,
    itens, total, entrada
  } = req.body || {};

  if (!pdfBase64 || typeof pdfBase64 !== "string") {
    return res.status(400).json({ erro: "pdf ausente" });
  }
  if (pdfBase64.length > LIMITE_PDF_BASE64) {
    return res.status(413).json({ erro: "pdf grande demais" });
  }

  const texto = (rotulo, valor) =>
    valor && typeof valor === "string" ? rotulo + ": " + valor.slice(0, 200) + "\n" : "";

  const listaItens = Array.isArray(itens)
    ? itens.slice(0, 20).map((i) => "- " + String(i).slice(0, 200)).join("\n")
    : "";

  const corpo =
    "Um casal preencheu o questionário do contrato no site. O contrato preenchido (PDF) está em anexo.\n\n" +
    texto("Casal", [noivo, noiva].filter(Boolean).join(" e ")) +
    texto("Telefones", [telNoivo, telNoiva].filter(Boolean).join(" / ")) +
    texto("E-mail", email) +
    texto("Data do casamento", dataEvento) +
    texto("Local", [local, horario].filter(Boolean).join(", às ")) +
    (listaItens ? "\nPacote e adicionais:\n" + listaItens + "\n" : "") +
    texto("Valor total", total) +
    texto("Entrada (30%)", entrada) +
    texto("Como conheceram", origem) +
    (observacoes && typeof observacoes === "string"
      ? "\nObservações do casal:\n" + observacoes.slice(0, 1000) + "\n"
      : "");

  const assunto =
    "Questionário de contrato preenchido: " +
    ([noivo, noiva].filter(Boolean).join(" e ") || "casal não identificado");

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
          filename: typeof nomeArquivo === "string" && nomeArquivo ? nomeArquivo.slice(0, 120) : "contrato.pdf",
          content: pdfBase64
        }
      ]
    })
  });

  if (!resposta.ok) {
    const detalhe = await resposta.text();
    console.error("Falha no Resend:", resposta.status, detalhe);
    return res.status(502).json({ erro: "falha no envio do e-mail" });
  }

  return res.status(200).json({ ok: true });
}

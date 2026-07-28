/*
  Envio de e-mail via Resend, compartilhado pelas Vercel Functions.
  A chave (RESEND_API_KEY) fica só no servidor.

  ATENÇÃO: enquanto o domínio não estiver verificado no Resend, o remetente precisa
  ser onboarding@resend.dev e a entrega SÓ funciona pro e-mail dono da conta
  (jordansantosfotografia@gmail.com). Enviar pro casal (código de assinatura, via
  assinada) depende de verificar jordansantosfotografia.com.br no Resend. Ver README.
*/

const REMETENTE = "Jordan Santos <onboarding@resend.dev>";
export const DESTINO_JORDAN = "jordansantosfotografia@gmail.com";

export async function enviarEmail({ to, subject, text, html, attachments }) {
  const chave = process.env.RESEND_API_KEY;
  if (!chave) throw new Error("RESEND_API_KEY ausente");

  const corpo = {
    from: REMETENTE,
    to: Array.isArray(to) ? to : [to],
    subject: subject
  };
  if (text) corpo.text = text;
  if (html) corpo.html = html;
  if (attachments) corpo.attachments = attachments;

  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + chave,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(corpo)
  });
  if (!r.ok) {
    /* guarda o motivo do Resend: sem isso, "domínio não verificado" (403) fica
       indistinguível de uma falha temporária e o Jordan tenta de novo pra sempre */
    let detalhe = "";
    try { const j = await r.json(); detalhe = (j && j.message) || ""; } catch (_) { /* corpo não-JSON */ }
    console.error("Resend falhou:", r.status, detalhe);
    const erro = new Error("resend " + r.status);
    erro.status = r.status;
    erro.detalhe = detalhe;
    throw erro;
  }
  return true;
}

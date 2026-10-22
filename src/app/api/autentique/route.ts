/*
  Webhook da Autentique: ela avisa quando alguém vê, assina ou recusa.

  A rota não CONFIA no corpo do aviso: ela tira só o id do documento e pergunta
  o estado direto pra API. Com isso um aviso forjado não muda nada, e por isso
  mesmo a verificação de assinatura (HMAC) é exigida só quando o segredo está
  configurado.

  Enquanto o app não tiver endereço público, isto fica parado e quem atualiza é
  a ação "sincronizar-contrato", que o painel chama ao abrir a ficha. Os dois
  caminhos terminam na mesma função, então ligar o webhook depois é só cadastrar
  a URL no painel da Autentique.
*/
import { NextResponse } from "next/server";
import { idDoWebhook, webhookConfere } from "@/lib/autentique";
import { sincronizarPorDocumento } from "@/lib/contrato-autentique";

export async function POST(req: Request) {
  const corpoCru = await req.text();
  if (!webhookConfere(corpoCru, req.headers.get("x-autentique-signature") ?? undefined)) {
    return NextResponse.json({ erro: "assinatura do aviso não confere" }, { status: 401 });
  }

  let payload: unknown = null;
  try { payload = JSON.parse(corpoCru); } catch { /* corpo inválido cai no 400 abaixo */ }

  const id = idDoWebhook(payload);
  if (!id) return NextResponse.json({ erro: "aviso sem id de documento" }, { status: 400 });

  try {
    const achou = await sincronizarPorDocumento(id);
    /* documento que não é nosso também responde 200: repetir o aviso não
       resolveria nada e a Autentique ficaria reenviando pra sempre */
    return NextResponse.json({ ok: true, contrato: achou });
  } catch (e) {
    console.error("webhook autentique falhou:", (e as Error).message);
    return NextResponse.json({ erro: "falha ao sincronizar" }, { status: 500 });
  }
}

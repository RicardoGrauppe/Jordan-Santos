/*
  Entrega uma foto da abertura enviada pelo fotógrafo. Pública: é o /cadastro
  do casal que pede. Só aceita os nomes que o servidor gera (id + 750|1200),
  então não dá pra usar a rota pra ler outra coisa do Storage.

  Cache longo e imutável: o nome do arquivo muda quando a foto muda (foto
  nova = id novo), então o navegador nunca precisa perguntar de novo.
*/
import { ARQUIVO_FOTO, lerFoto } from "@/lib/formulario-fotos";

export async function GET(_req: Request, { params }: { params: Promise<{ arquivo: string }> }) {
  const { arquivo } = await params;
  if (!ARQUIVO_FOTO.test(arquivo)) return new Response("não encontrada", { status: 404 });

  const r = await lerFoto(arquivo);
  if (!r) return new Response("não encontrada", { status: 404 });
  return new Response(r.body, {
    headers: {
      "Content-Type": "image/webp",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}

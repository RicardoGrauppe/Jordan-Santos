/*
  Entrega as fotos do Ateliê pro navegador: /midia/<uuid>.jpg.

  Pública de propósito, porque é o site do fotógrafo que mostra a foto pra
  quem abre o link. O que protege é o nome: um uuid sorteado no envio, sem
  lista nenhuma exposta (a biblioteca só abre logado). Cada envio gera um
  nome novo, então o cache pode ser eterno.
*/
import { baixarArquivo } from "@/lib/storage";
import { BUCKET, CAMINHO_VALIDO } from "@/lib/atelie/midias";

export async function GET(_req: Request, { params }: { params: Promise<{ caminho: string }> }) {
  const { caminho } = await params;
  if (!CAMINHO_VALIDO.test(caminho)) return new Response("não encontrada", { status: 404 });
  try {
    const arquivo = await baixarArquivo(BUCKET, caminho);
    if (!arquivo?.body) return new Response("não encontrada", { status: 404 });
    return new Response(arquivo.body, {
      headers: {
        "Content-Type": arquivo.headers.get("content-type") ?? "application/octet-stream",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new Response("indisponível", { status: 502 });
  }
}

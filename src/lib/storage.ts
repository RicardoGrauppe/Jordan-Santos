/*
  Supabase Storage com a SERVICE ROLE KEY, só no servidor (mesmo motivo do
  `supabase.ts`: o `server-only` quebra o build se alguém importar isto de
  um Client Component).

  Os buckets são PRIVADOS. Quem entrega o arquivo pro navegador é uma rota do
  app (ex.: /midia/<caminho> no Ateliê), não a URL pública do Storage: assim o
  endereço da foto é do próprio site e funciona igual no celular da rede local
  (onde 127.0.0.1 não é o computador) e em produção.
*/
import "server-only";

const BASE = process.env.SUPABASE_URL;
const CHAVE = process.env.SUPABASE_SERVICE_ROLE_KEY;

function cabecalhos(extra?: Record<string, string>): Record<string, string> {
  return { apikey: CHAVE!, Authorization: "Bearer " + CHAVE, ...extra };
}

const criados = new Set<string>();

/**
 * Cria o bucket se ainda não existir. Uma vez por processo: depois da
 * primeira conferência a resposta fica guardada. Bucket já existente
 * responde 409 (ou 400 em versões antigas), e isso é sucesso aqui.
 */
export async function garantirBucket(
  bucket: string, opcoes: { tamanhoMax: number; tipos: string[] },
): Promise<void> {
  if (criados.has(bucket)) return;
  const r = await fetch(BASE + "/storage/v1/bucket", {
    method: "POST",
    headers: cabecalhos({ "Content-Type": "application/json" }),
    body: JSON.stringify({
      id: bucket, name: bucket, public: false,
      file_size_limit: opcoes.tamanhoMax, allowed_mime_types: opcoes.tipos,
    }),
  });
  if (!r.ok && r.status !== 409 && r.status !== 400) {
    console.error("storage bucket falhou:", r.status, bucket);
    throw new Error("storage " + r.status);
  }
  criados.add(bucket);
}

export async function enviarArquivo(bucket: string, caminho: string, dados: ArrayBuffer, tipo: string): Promise<void> {
  const r = await fetch(BASE + "/storage/v1/object/" + bucket + "/" + caminho, {
    method: "POST",
    headers: cabecalhos({ "Content-Type": tipo, "x-upsert": "false", "cache-control": "31536000" }),
    body: dados,
  });
  if (!r.ok) {
    console.error("storage envio falhou:", r.status, bucket);
    throw new Error("storage " + r.status);
  }
}

/** O arquivo como veio do Storage, ou null quando não existe. */
export async function baixarArquivo(bucket: string, caminho: string): Promise<Response | null> {
  const r = await fetch(BASE + "/storage/v1/object/" + bucket + "/" + caminho, {
    headers: cabecalhos(),
    cache: "no-store",
  });
  if (r.status === 400 || r.status === 404) return null;
  if (!r.ok) {
    console.error("storage leitura falhou:", r.status, bucket);
    throw new Error("storage " + r.status);
  }
  return r;
}

export async function apagarArquivo(bucket: string, caminho: string): Promise<void> {
  const r = await fetch(BASE + "/storage/v1/object/" + bucket, {
    method: "DELETE",
    headers: cabecalhos({ "Content-Type": "application/json" }),
    body: JSON.stringify({ prefixes: [caminho] }),
  });
  if (!r.ok) {
    console.error("storage remoção falhou:", r.status, bucket);
    throw new Error("storage " + r.status);
  }
}

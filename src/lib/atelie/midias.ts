/*
  Biblioteca de fotos do Ateliê: o arquivo no Storage (bucket `atelie`) e a
  linha em `site_midias`. Só servidor.

  O endereço que vai pro bloco é `/midia/<caminho>`, servido pela rota do app
  (ver lib/storage.ts, por que não a URL do Storage).
*/
import "server-only";
import { rest } from "@/lib/supabase";
import { apagarArquivo, enviarArquivo, garantirBucket } from "@/lib/storage";

export const BUCKET = "atelie";
export const TIPOS_DE_FOTO = ["image/jpeg", "image/png", "image/webp"] as const;
/* a foto chega reduzida pelo navegador (2560px), então 15 MB é teto de
   segurança, não o tamanho esperado */
export const TAMANHO_MAX = 15 * 1024 * 1024;

const EXTENSAO: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
export const CAMINHO_VALIDO = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$/;

export type Midia = {
  id: string;
  caminho: string;
  url: string;
  nome: string;
  tipo: string;
  tamanho: number;
  largura: number | null;
  altura: number | null;
  criado_em: string;
};

type Linha = Omit<Midia, "url">;

export const urlDaMidia = (caminho: string) => "/midia/" + caminho;

const comUrl = (l: Linha): Midia => ({ ...l, url: urlDaMidia(l.caminho) });

export async function listarMidias(): Promise<Midia[]> {
  const linhas = await rest<Linha[]>("site_midias?select=*&order=criado_em.desc");
  return (linhas ?? []).map(comUrl);
}

/** Guarda uma foto: arquivo no Storage e linha na biblioteca. */
export async function guardarMidia(arquivo: {
  dados: ArrayBuffer; tipo: string; nome: string; largura: number | null; altura: number | null;
}): Promise<Midia> {
  await garantirBucket(BUCKET, { tamanhoMax: TAMANHO_MAX, tipos: [...TIPOS_DE_FOTO] });
  const caminho = crypto.randomUUID() + "." + EXTENSAO[arquivo.tipo];
  await enviarArquivo(BUCKET, caminho, arquivo.dados, arquivo.tipo);
  const linhas = await rest<Linha[]>("site_midias", {
    method: "POST",
    body: {
      caminho, nome: arquivo.nome.slice(0, 160), tipo: arquivo.tipo, tamanho: arquivo.dados.byteLength,
      largura: arquivo.largura, altura: arquivo.altura,
    },
    prefer: "return=representation",
  });
  if (!linhas?.[0]) throw new Error("midia não registrada");
  return comUrl(linhas[0]);
}

/** Nomes dos modelos que usam a foto (no rascunho ou na versão no ar). */
export async function modelosQueUsam(caminho: string): Promise<string[]> {
  const modelos = (await rest<{ nome: string; rascunho: unknown; publicado: unknown }[]>(
    "site_modelos?select=nome,rascunho,publicado",
  )) ?? [];
  const url = urlDaMidia(caminho);
  return modelos
    .filter((m) => JSON.stringify(m.rascunho).includes(url) || JSON.stringify(m.publicado ?? null).includes(url))
    .map((m) => m.nome);
}

/**
 * Apaga uma foto da biblioteca. Foto em uso não sai: o bloco ficaria com a
 * imagem quebrada, e no modelo no ar quem veria seria o cliente.
 */
export async function apagarMidia(id: string): Promise<{ ok: true } | { emUso: string[] } | null> {
  const linhas = await rest<Linha[]>("site_midias?id=eq." + encodeURIComponent(id) + "&select=*&limit=1");
  const midia = linhas?.[0];
  if (!midia) return null;
  const emUso = await modelosQueUsam(midia.caminho);
  if (emUso.length) return { emUso };
  await apagarArquivo(BUCKET, midia.caminho);
  await rest("site_midias?id=eq." + encodeURIComponent(id), { method: "DELETE" });
  return { ok: true };
}

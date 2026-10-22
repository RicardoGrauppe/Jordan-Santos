/*
  Fotos da abertura que o fotógrafo envia pelo editor de Formulário.

  Toda foto chega do jeito que vier (JPG de câmera, PNG, foto de celular de
  vários MB) e sai daqui como dois webp, 750 e 1200px de largura, os mesmos
  tamanhos das fotos padrão em public/img/abertura/. O casal nunca baixa o
  original: foi o original passando por conversão na hora que fez as fotos
  não aparecerem no iPhone (22/10/2026).

  Guardadas no bucket privado formulario-fotos (migração 20261022220000) e
  entregues pela rota /api/formulario/fotos/<arquivo>.
*/
import "server-only";
import sharp from "sharp";
import { storage } from "@/lib/supabase";

const BUCKET = "formulario-fotos";
const LARGURAS = [750, 1200] as const;

/** Arquivo que a rota pública aceita servir: só os dois tamanhos de um id. */
export const ARQUIVO_FOTO = /^(f_[a-z0-9]{8,24})-(750|1200)\.webp$/;

function novoId(): string {
  return "f_" + crypto.randomUUID().replace(/-/g, "").slice(0, 16);
}

/** Converte e grava os dois tamanhos. Devolve o id, ou lança com a mensagem pro painel. */
export async function guardarFoto(original: Buffer): Promise<string> {
  let base: ReturnType<typeof sharp>;
  try {
    /* rotate() sem argumento aplica a orientação do EXIF: foto de celular
       deitada vira de pé antes de redimensionar */
    base = sharp(original, { failOn: "error" }).rotate();
    await base.metadata();
  } catch {
    throw new Error("Não consegui abrir essa imagem. Tente um JPG ou PNG.");
  }
  const id = novoId();
  for (const largura of LARGURAS) {
    const webp = await base.clone()
      .resize({ width: largura, withoutEnlargement: true })
      .webp({ quality: 74 })
      .toBuffer();
    const r = await storage("object/" + BUCKET + "/" + id + "-" + largura + ".webp", {
      method: "POST",
      body: new Uint8Array(webp),
      contentType: "image/webp",
      extra: { "x-upsert": "true", "cache-control": "31536000" },
    });
    if (!r.ok) {
      console.error("foto do formulário: storage recusou", r.status);
      throw new Error("Não consegui guardar a foto agora, tente de novo.");
    }
  }
  return id;
}

/** Repassa o arquivo do bucket; null quando não existe. */
export async function lerFoto(arquivo: string): Promise<Response | null> {
  const r = await storage("object/authenticated/" + BUCKET + "/" + arquivo);
  return r.ok ? r : null;
}

/** Apaga os dois tamanhos. Melhor esforço: falhar aqui só deixa um arquivo órfão. */
export async function apagarFoto(id: string): Promise<void> {
  const r = await storage("object/" + BUCKET, {
    method: "DELETE",
    body: JSON.stringify({ prefixes: LARGURAS.map((l) => id + "-" + l + ".webp") }),
    contentType: "application/json",
  });
  if (!r.ok) console.error("foto do formulário: não apagou", r.status);
}

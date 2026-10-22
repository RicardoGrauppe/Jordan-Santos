/*
  Gera as fotos da abertura do /cadastro já otimizadas (webp em 750 e 1200px
  de largura) em public/img/abertura/, a partir dos JPGs de public/img/.

  Por que arquivo pronto e não o next/image: no dev o otimizador converte o
  JPG original (até 2,5 MB) na hora da visita, uma vez por largura de tela, e
  no iPhone do Jordan as fotos não apareciam (22/10/2026). Arquivo estático
  chega igual em qualquer aparelho, no dev e em produção.

  Rodar de novo só quando trocar ou acrescentar foto:
    node tools/fotos-abertura/gerar.mjs
*/
import sharp from "sharp";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const RAIZ = path.resolve(import.meta.dirname, "../..");
const ORIGEM = path.join(RAIZ, "public/img");
const DESTINO = path.join(RAIZ, "public/img/abertura");
const FOTOS = [
  "prewedding", "casal-jardim", "entrega-1", "casal-palacio",
  "casal-campo", "noiva-retrato", "entrega-3", "entrega-2",
];
const LARGURAS = [750, 1200];

await mkdir(DESTINO, { recursive: true });
for (const nome of FOTOS) {
  for (const largura of LARGURAS) {
    const saida = path.join(DESTINO, `${nome}-${largura}.webp`);
    const info = await sharp(path.join(ORIGEM, `${nome}.jpg`))
      .resize({ width: largura, withoutEnlargement: true })
      .webp({ quality: 74 })
      .toFile(saida);
    console.log(`${nome}-${largura}.webp  ${Math.round(info.size / 1024)} KB`);
  }
}

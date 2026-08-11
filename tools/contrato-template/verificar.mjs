/*
  Avisa se os templates PDF ficaram obsoletos — ou seja, se o contrato-template.js
  mudou depois da última geração. Rode com `npm run contrato:verificar`.

  Sem isto, editar uma cláusula faria a tela de revisão mostrar o texto novo
  enquanto o PDF arquivado continuaria com o velho, em silêncio.
*/
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const DESTINO = join(RAIZ, "api", "_lib", "contrato-pdf");

const atual = createHash("sha256")
  .update(readFileSync(join(RAIZ, "contrato-template.js")))
  .digest("hex");

let mapa;
try {
  mapa = JSON.parse(readFileSync(join(DESTINO, "coords.json"), "utf8"));
} catch {
  console.error("✗ coords.json não existe — regere o template.");
  process.exit(1);
}

if ((mapa.geradoDe && mapa.geradoDe.sha256) !== atual) {
  console.error(
    "✗ o template foi gerado de outra versão do contrato-template.js\n\n" +
    "O texto do contrato mudou desde a última geração. O PDF assinado sairia\n" +
    "com o texto ANTIGO. Regere com:\n" +
    "  npm run contrato:regerar\n"
  );
  process.exit(1);
}
console.log("✓ o template bate com o contrato-template.js atual.");

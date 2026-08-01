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

let obsoleto = false;
for (const nome of ["P", "M", "G"]) {
  let mapa;
  try {
    mapa = JSON.parse(readFileSync(join(DESTINO, `coords-${nome}.json`), "utf8"));
  } catch {
    console.error(`✗ ${nome}: coords-${nome}.json não existe — regere os templates.`);
    obsoleto = true;
    continue;
  }
  const gerado = mapa.geradoDe && mapa.geradoDe.sha256;
  if (gerado !== atual) {
    console.error(`✗ ${nome}: gerado de outra versão do contrato-template.js`);
    obsoleto = true;
  } else {
    console.log(`✓ ${nome}: em dia`);
  }
}

if (obsoleto) {
  console.error(
    "\nO texto do contrato mudou desde a última geração dos templates.\n" +
    "O PDF assinado sairia com o texto ANTIGO. Regere com:\n" +
    "  node --experimental-websocket tools/contrato-template/rodar.mjs\n"
  );
  process.exit(1);
}
console.log("\nTemplates batem com o contrato-template.js atual.");

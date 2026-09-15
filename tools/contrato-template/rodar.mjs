/*
  Regera o template PDF do contrato — FERRAMENTA LOCAL, roda só na máquina.
  Precisa de Chrome instalado + Node. Ver README.md desta pasta.

  Uso:
    npm run contrato:regerar

  Saída (sobrescreve): src/lib/contrato-pdf/template.pdf + coords.json

  ESTE CAMINHO É LEGADO. Ele alimenta o `gerar.js` (pdf-lib), que só entra em
  contrato SEM modelo. Todo contrato gerado hoje carrega o snapshot de um
  modelo e sai pelo `gerar-pdfmake.js`, que monta o PDF do zero e não usa
  template nenhum. Isto continua aqui pra contrato antigo, de antes dos
  modelos, ainda poder ser reimpresso.

  DIFERENÇA PRO ORIGINAL: lá o texto do contrato era um `.js` solto que o
  gerador.html carregava com <script src>. Aqui a fonte é
  `src/lib/contrato-template.ts`, então este script compila o TypeScript com o
  `tsc` do projeto e COSTURA o resultado dentro de uma cópia do gerador.html
  (`.gerador-compilado.html`, ignorada pelo git). O arquivo costurado fica na
  MESMA pasta do gerador.html de propósito: os caminhos relativos das fontes e
  da logo continuam valendo.

  POR QUE UMA SESSÃO SÓ DO CHROME (DevTools Protocol) e não dois comandos
  `--dump-dom` + `--print-to-pdf`: as duas invocações separadas pegavam
  estados DIFERENTES da paginação, e o mapa de coordenadas saía deslocado do
  PDF impresso (campos escritos fora das lacunas). Aqui o mesmo DOM que foi
  medido é o que vai pra impressão — é o que garante o alinhamento.
*/
import { spawn, spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, rmSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { setTimeout as delay } from "node:timers/promises";

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = join(AQUI, "..", "..");
const DESTINO = join(RAIZ, "src", "lib", "contrato-pdf");
const FONTE = join(RAIZ, "src", "lib", "contrato-template.ts");
const COMPILADO = join(AQUI, ".gerador-compilado.html");

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

/* carimbo pra detectar template obsoleto: se o contrato-template.ts mudar
   (cláusula editada) sem regerar, o `npm run contrato:verificar` acusa */
function shaDoTemplate() {
  const src = readFileSync(FONTE);
  return createHash("sha256").update(src).digest("hex");
}

/* Compila a fonte TypeScript e costura o JS dentro de uma cópia do
   gerador.html, pra a página não depender de <script src> nem de módulo ES
   (que o Chrome bloqueia em file://). */
function montarGeradorCompilado() {
  const tmp = join(AQUI, ".tmp");
  rmSync(tmp, { recursive: true, force: true });
  const tsc = spawnSync(
    process.platform === "win32" ? "npx.cmd" : "npx",
    ["tsc", FONTE, "--outDir", tmp, "--target", "es2020", "--module", "es2020", "--skipLibCheck"],
    { cwd: RAIZ, encoding: "utf8" },
  );
  if (tsc.status !== 0) {
    throw new Error("tsc falhou ao compilar o contrato-template.ts:\n" + (tsc.stdout || "") + (tsc.stderr || ""));
  }
  /* tira os `export` (a página carrega como script clássico) e expõe o mesmo
     global que o gerador.html do original esperava */
  const js = readFileSync(join(tmp, "contrato-template.js"), "utf8")
    .replace(/^export\s+/gm, "")
    + "\nwindow.CONTRATO_TEMPLATE = { html: htmlContratoTemplate };\n";

  const html = readFileSync(join(AQUI, "gerador.html"), "utf8")
    .replace('<script src="../../contrato-template.js"></script>', "<script>\n" + js + "\n</script>")
    /* no original a logo vivia em /img; aqui o estático é /public/img */
    .replace(/\.\.\/\.\.\/img\//g, "../../public/img/");
  if (!html.includes("CONTRATO_TEMPLATE")) {
    throw new Error("não achei o ponto de costura do template dentro do gerador.html");
  }
  writeFileSync(COMPILADO, html);
  rmSync(tmp, { recursive: true, force: true });
}

async function gerar() {
  const porta = 9222 + Math.floor(Math.random() * 700);
  const url = pathToFileURL(COMPILADO).href;

  const chrome = spawn(CHROME, [
    "--headless=new", "--disable-gpu", "--no-first-run",
    "--remote-debugging-port=" + porta,
    "--user-data-dir=/tmp/contrato-template-" + porta,
    "about:blank"
  ], { stdio: "ignore" });

  try {
    let ok = false;
    for (let i = 0; i < 60; i++) {
      try { await (await fetch(`http://127.0.0.1:${porta}/json/list`)).json(); ok = true; break; }
      catch { await delay(200); }
    }
    if (!ok) throw new Error("o Chrome não abriu a porta de depuração");

    const aba = await (await fetch(
      `http://127.0.0.1:${porta}/json/new?` + encodeURIComponent(url), { method: "PUT" }
    )).json();

    const ws = new WebSocket(aba.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });

    let seq = 0;
    const pendentes = new Map();
    ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data);
      const p = pendentes.get(msg.id);
      if (!p) return;
      pendentes.delete(msg.id);
      msg.error ? p.reject(new Error(msg.error.message)) : p.resolve(msg.result);
    };
    const cdp = (metodo, params = {}) => new Promise((resolve, reject) => {
      const id = ++seq;
      pendentes.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method: metodo, params }));
    });

    await cdp("Page.enable");
    await cdp("Runtime.enable");

    /* o gerador.html só marca o title depois de paginar E medir */
    let pronto = false;
    for (let i = 0; i < 120; i++) {
      const r = await cdp("Runtime.evaluate", { expression: "document.title", returnByValue: true });
      if (r.result.value === "template-pronto") { pronto = true; break; }
      await delay(100);
    }
    if (!pronto) throw new Error("a paginação não terminou a tempo");

    const coords = await cdp("Runtime.evaluate", {
      expression: "document.getElementById('coords').textContent",
      returnByValue: true
    });
    const mapa = JSON.parse(coords.result.value);
    mapa.geradoDe = { arquivo: "src/lib/contrato-template.ts", sha256: shaDoTemplate() };
    writeFileSync(join(DESTINO, "coords.json"), JSON.stringify(mapa, null, 2));

    /* preferCSSPageSize respeita o @page{size:A4;margin:0} do gerador */
    const pdf = await cdp("Page.printToPDF", {
      printBackground: true,
      preferCSSPageSize: true,
      displayHeaderFooter: false,
      marginTop: 0, marginBottom: 0, marginLeft: 0, marginRight: 0
    });
    writeFileSync(join(DESTINO, "template.pdf"), Buffer.from(pdf.data, "base64"));

    console.log(`  ${mapa.paginas} páginas, ${mapa.campos.length} campos, ${mapa.boxes.length} caixas`);
  } finally {
    chrome.kill();
  }
}

console.log("Compilando o contrato-template.ts…");
montarGeradorCompilado();
console.log("Regerando o template a partir de src/lib/contrato-template.ts…");
await gerar();
console.log("Pronto. Arquivos em src/lib/contrato-pdf/ — confira um PDF preenchido antes de commitar.");

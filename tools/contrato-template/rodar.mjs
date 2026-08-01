/*
  Regera os templates PDF do contrato — FERRAMENTA LOCAL, nunca roda na Vercel.
  Precisa de Chrome instalado + Node. Ver README.md desta pasta.

  Uso:
    node --experimental-websocket tools/contrato-template/rodar.mjs        (as três)
    node --experimental-websocket tools/contrato-template/rodar.mjs M      (só uma)

  Saída (sobrescreve): api/_lib/contrato-pdf/template-{P,M,G}.pdf + coords-{P,M,G}.json

  POR QUE UMA SESSÃO SÓ DO CHROME (DevTools Protocol) e não dois comandos
  `--dump-dom` + `--print-to-pdf`: as duas invocações separadas pegavam
  estados DIFERENTES da paginação, e o mapa de coordenadas saía deslocado do
  PDF impresso (campos escritos fora das lacunas). Aqui o mesmo DOM que foi
  medido é o que vai pra impressão — é o que garante o alinhamento.
*/
import { spawn } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { setTimeout as delay } from "node:timers/promises";

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = join(AQUI, "..", "..");
const DESTINO = join(RAIZ, "api", "_lib", "contrato-pdf");

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

/* Faixas de quantidade de itens -> altura reservada (px) pra tabela.
   O catálogo tem 9 itens no total (catalogo.js), então G cobre o pior caso. */
const VARIANTES = {
  P: { boxTabela: 170, ate: 3 },
  M: { boxTabela: 260, ate: 6 },
  G: { boxTabela: 360, ate: 9 }
};

/* carimbo pra detectar template obsoleto: se o contrato-template.js mudar
   (cláusula editada) sem regerar, o `npm run contrato:verificar` acusa */
function shaDoTemplate() {
  const src = readFileSync(join(RAIZ, "contrato-template.js"));
  return createHash("sha256").update(src).digest("hex");
}

async function gerar(nome) {
  const { boxTabela } = VARIANTES[nome];
  const porta = 9222 + Math.floor(Math.random() * 700);
  const url =
    pathToFileURL(join(AQUI, "gerador.html")).href + "?boxTabela=" + boxTabela;

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
    mapa.variante = nome;
    mapa.geradoDe = { arquivo: "contrato-template.js", sha256: shaDoTemplate() };
    writeFileSync(join(DESTINO, `coords-${nome}.json`), JSON.stringify(mapa, null, 2));

    /* preferCSSPageSize respeita o @page{size:A4;margin:0} do gerador */
    const pdf = await cdp("Page.printToPDF", {
      printBackground: true,
      preferCSSPageSize: true,
      displayHeaderFooter: false,
      marginTop: 0, marginBottom: 0, marginLeft: 0, marginRight: 0
    });
    writeFileSync(join(DESTINO, `template-${nome}.pdf`), Buffer.from(pdf.data, "base64"));

    console.log(`  ${nome}: ${mapa.paginas} páginas, ${mapa.campos.length} campos, ${mapa.boxes.length} caixas`);
  } finally {
    chrome.kill();
  }
}

const pedidas = process.argv.slice(2).map((v) => v.toUpperCase());
const alvos = pedidas.length ? pedidas : Object.keys(VARIANTES);
for (const nome of alvos) {
  if (!VARIANTES[nome]) throw new Error(`variante desconhecida: ${nome} (use P, M ou G)`);
}

console.log("Regerando templates a partir de contrato-template.js…");
for (const nome of alvos) await gerar(nome);
console.log(`Pronto. Arquivos em api/_lib/contrato-pdf/ — confira um PDF preenchido antes de commitar.`);

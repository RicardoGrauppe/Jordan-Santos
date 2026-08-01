/*
  Utilitários compartilhados pelas Vercel Functions (sem estado, sem PII em log).
  Centraliza o que antes estava copiado em orcamento.js / assinatura.js / sessao.js.
*/

/* Corta e limpa uma string; devolve null se não for string útil. */
export function textoCurto(valor, max) {
  return valor && typeof valor === "string" ? valor.slice(0, max || 200).trim() : null;
}

/* Throttle best-effort em memória (zera em cold start, e tudo bem).
   Uso: const limite = criarLimite(15 * 60_000, 20); if (limite(ip)) ... */
export function criarLimite(janelaMs, max) {
  const tentativas = new Map();
  return function estourou(chave) {
    const agora = Date.now();
    const t = tentativas.get(chave) || { n: 0, desde: agora };
    if (agora - t.desde > janelaMs) { t.n = 0; t.desde = agora; }
    t.n++;
    tentativas.set(chave, t);
    return t.n > max;
  };
}

/* IP do cliente a partir dos cabeçalhos de proxy. A Vercel manda os dois;
   o x-real-ip é a rede de segurança se o x-forwarded-for faltar.

   Devolve null (não "?") quando não dá pra saber — é o caso do dev-server
   local, que não é proxy nenhum. Isso importa porque o IP entra na trilha de
   auditoria da assinatura, e o contrato afirma que ele fica registrado:
   coluna vazia é honesta, um "?" gravado finge ser um valor que ninguém tem.
   Quem usa isto como chave de throttle precisa tratar o null. */
export function ipDe(req) {
  const encaminhado = (req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  return encaminhado || (req.headers["x-real-ip"] || "").trim() || null;
}

/* Mantém só as colunas da whitelist; "" vira null. `ajustar` (opcional) recebe o
   objeto limpo pra normalizações finais (ex.: CPF). */
export function filtrarCampos(campos, origem, ajustar) {
  const limpo = {};
  campos.forEach(function (c) {
    if (origem[c] !== undefined) limpo[c] = origem[c] === "" ? null : origem[c];
  });
  if (typeof ajustar === "function") ajustar(limpo);
  return limpo;
}

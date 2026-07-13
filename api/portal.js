/*
  Dados do hub do casal. GET com sessão de role "cliente".
  Nunca devolve CPF nem endereço: o hub não precisa deles.
  Fotos saem como URLs assinadas de 1 hora; expirou, a página refaz o GET.
*/

import { rest, listarFotos, assinarFotos } from "./_lib/supabase.js";
import { sessaoDe } from "./_lib/sessao.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ erro: "método não permitido" });
  }

  const sessao = await sessaoDe(req, "cliente");
  if (!sessao) return res.status(401).json({ erro: "sessão inválida" });

  try {
    const linhas = await rest(
      "clientes?id=eq." + sessao.sub + "&status=neq.arquivado" +
      "&select=noivo,noiva,data_evento,horario,local_evento,itens,total,entrada,status"
    );
    if (!linhas || !linhas.length) {
      return res.status(401).json({ erro: "sessão inválida" });
    }

    const nomes = (await listarFotos(sessao.sub)).map(function (f) { return f.name; });
    const fotos = await assinarFotos(sessao.sub, nomes, 3600);

    return res.status(200).json({ cliente: linhas[0], fotos: fotos });
  } catch (_) {
    return res.status(502).json({ erro: "banco indisponível, tente de novo" });
  }
}

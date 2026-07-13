/*
  Painel do Jordan (role "admin").

  GET  ?lista=1            → linhas resumidas de todos os clientes
  GET  ?id=<uuid>          → cliente completo + fotos (URLs assinadas de 1h)
  POST {acao:"criar", cliente:{...}}          → insere, devolve a linha
  POST {acao:"atualizar", id, cliente:{...}}  → PATCH dos campos enviados
  POST {acao:"arquivar", id}                  → status = arquivado (o "excluir" da UI)
  POST {acao:"excluir", id}                   → hard delete: linha + fotos do bucket
  POST {acao:"upload-urls", id, arquivos:[{nome}]} → signed upload URLs (2h)
  POST {acao:"excluir-foto", id, nome}        → apaga um arquivo do bucket
*/

import {
  rest, storage, listarFotos, assinarFotos, urlStorage, BUCKET,
  criarUsuarioAuth, buscarUsuarioAuth, definirSenhaAuth, senhaTemporaria
} from "./_lib/supabase.js";
import { sessaoDe, normalizarCpf } from "./_lib/sessao.js";

/* campos que a UI pode gravar (whitelist contra colunas inesperadas) */
const CAMPOS = [
  "status", "noivo", "cpf_noivo", "noiva", "cpf_noiva", "tel_noivo", "tel_noiva",
  "email", "cep", "endereco", "numero", "complemento", "bairro", "cidade", "estado",
  "data_evento", "horario", "local_evento", "itens", "total", "entrada",
  "origem", "observacoes"
];

function filtrarCampos(cliente) {
  const limpo = {};
  CAMPOS.forEach(function (c) {
    if (cliente[c] !== undefined) limpo[c] = cliente[c] === "" ? null : cliente[c];
  });
  if (limpo.cpf_noivo) limpo.cpf_noivo = normalizarCpf(limpo.cpf_noivo);
  if (limpo.cpf_noiva) limpo.cpf_noiva = normalizarCpf(limpo.cpf_noiva);
  return limpo;
}

function nomeSeguro(nome) {
  return String(nome || "arquivo")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .slice(0, 120);
}

export default async function handler(req, res) {
  const sessao = await sessaoDe(req, "admin");
  if (!sessao) return res.status(401).json({ erro: "sessão inválida" });

  try {
    if (req.method === "GET") {
      if (req.query.id) {
        const linhas = await rest("clientes?id=eq." + req.query.id + "&select=*");
        if (!linhas || !linhas.length) return res.status(404).json({ erro: "cliente não encontrado" });
        const nomes = (await listarFotos(req.query.id)).map(function (f) { return f.name; });
        const fotos = await assinarFotos(req.query.id, nomes, 3600);
        return res.status(200).json({ cliente: linhas[0], fotos: fotos });
      }
      const lista = await rest(
        "clientes?select=id,noivo,noiva,data_evento,status,total" +
        "&order=data_evento.asc.nullslast"
      );
      return res.status(200).json({ clientes: lista || [] });
    }

    if (req.method !== "POST") {
      return res.status(405).json({ erro: "método não permitido" });
    }

    const { acao, id } = req.body || {};

    if (acao === "criar") {
      const linha = await rest("clientes", {
        method: "POST",
        body: filtrarCampos(req.body.cliente || {}),
        prefer: "return=representation"
      });
      return res.status(200).json({ ok: true, cliente: linha[0] });
    }

    if (!id) return res.status(400).json({ erro: "id obrigatório" });

    if (acao === "atualizar") {
      await rest("clientes?id=eq." + id, {
        method: "PATCH",
        body: filtrarCampos(req.body.cliente || {})
      });
      return res.status(200).json({ ok: true });
    }

    if (acao === "arquivar") {
      await rest("clientes?id=eq." + id, {
        method: "PATCH", body: { status: "arquivado" }
      });
      return res.status(200).json({ ok: true });
    }

    if (acao === "excluir") {
      const nomes = (await listarFotos(id)).map(function (f) { return f.name; });
      if (nomes.length) {
        await storage("object/" + BUCKET, {
          method: "DELETE",
          body: { prefixes: nomes.map(function (n) { return id + "/" + n; }) }
        });
      }
      await rest("clientes?id=eq." + id, { method: "DELETE" });
      return res.status(200).json({ ok: true });
    }

    if (acao === "upload-urls") {
      const arquivos = Array.isArray(req.body.arquivos) ? req.body.arquivos.slice(0, 200) : [];
      const urls = [];
      for (const a of arquivos) {
        const nome = nomeSeguro(a.nome);
        const assinada = await storage(
          "object/upload/sign/" + BUCKET + "/" + id + "/" + nome, { method: "POST" }
        );
        urls.push({ nome: nome, url: urlStorage(assinada.url) });
      }
      return res.status(200).json({ ok: true, urls: urls });
    }

    /* cria (ou reseta) o acesso do casal: usuário no Supabase Auth + senha
       temporária, mostrada UMA vez pro Jordan repassar no WhatsApp */
    if (acao === "acesso-casal") {
      const linhas = await rest("clientes?id=eq." + id + "&select=email,auth_user_id&limit=1");
      const cliente = linhas && linhas[0];
      if (!cliente) return res.status(404).json({ erro: "cliente não encontrado" });
      if (!cliente.email) {
        return res.status(400).json({ erro: "cadastre o e-mail do casal antes de gerar o acesso" });
      }

      const senha = senhaTemporaria();
      let userId = cliente.auth_user_id;

      if (userId) {
        await definirSenhaAuth(userId, senha);
      } else {
        const criado = await criarUsuarioAuth(cliente.email, senha);
        if (criado) {
          userId = criado.id;
        } else {
          /* e-mail já existe no Auth (ex.: recadastro): reaproveita o usuário */
          const existente = await buscarUsuarioAuth(cliente.email);
          if (!existente) {
            return res.status(409).json({ erro: "e-mail já usado por outro acesso, confira o cadastro" });
          }
          userId = existente.id;
          await definirSenhaAuth(userId, senha);
        }
        await rest("clientes?id=eq." + id, {
          method: "PATCH", body: { auth_user_id: userId }
        });
      }

      return res.status(200).json({ ok: true, email: cliente.email, senha: senha });
    }

    if (acao === "excluir-foto") {
      const nome = nomeSeguro(req.body.nome);
      await storage("object/" + BUCKET + "/" + id + "/" + nome, { method: "DELETE" });
      return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ erro: "ação desconhecida" });
  } catch (e) {
    console.error("estudio falhou:", e.message);
    return res.status(502).json({ erro: "banco indisponível, tente de novo" });
  }
}

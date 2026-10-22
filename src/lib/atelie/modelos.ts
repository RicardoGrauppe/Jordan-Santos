/*
  Acesso aos modelos do Ateliê (tabela `site_modelos` + chave `site_ativo` em
  `config`). Só servidor: usa a service role.

  O site público nunca pode cair por causa do banco: qualquer falha de leitura,
  modelo ativo apagado ou nunca publicado cai no MODELO_INICIAL, que é a
  proposta de sempre.
*/
import "server-only";
import { cache } from "react";
import { rest } from "@/lib/supabase";
import type { DadosSite } from "./blocos";
import { MODELO_INICIAL, NOME_MODELO_INICIAL } from "./modelo-inicial";

export const CHAVE_SITE_ATIVO = "site_ativo";

export type ResumoModelo = {
  id: string;
  nome: string;
  atualizado_em: string;
  publicado_em: string | null;
};

type LinhaConfig = { valor: string | null };

/** Id do modelo que está no ar, ou null. */
export async function idDoSiteAtivo(): Promise<string | null> {
  const linhas = await rest<LinhaConfig[]>(
    "config?chave=eq." + CHAVE_SITE_ATIVO + "&select=valor&limit=1",
  );
  return linhas?.[0]?.valor || null;
}

/** O que o público vê: a versão publicada do modelo ativo. `cache` porque a
    página e o título dela pedem a mesma coisa no mesmo request. */
export const siteNoAr = cache(async (): Promise<DadosSite> => {
  try {
    const id = await idDoSiteAtivo();
    if (!id) return MODELO_INICIAL;
    const linhas = await rest<{ publicado: DadosSite | null }[]>(
      "site_modelos?id=eq." + encodeURIComponent(id) + "&select=publicado&limit=1",
    );
    return linhas?.[0]?.publicado ?? MODELO_INICIAL;
  } catch {
    return MODELO_INICIAL;
  }
});

/** Lista dos modelos, do mais recente pro mais antigo. */
export async function listarModelos(): Promise<ResumoModelo[]> {
  return (await rest<ResumoModelo[]>(
    "site_modelos?select=id,nome,atualizado_em,publicado_em&order=atualizado_em.desc",
  )) ?? [];
}

/**
 * Na primeira vez que o Ateliê abre, o banco está vazio: cria o modelo da
 * proposta, já publicado e no ar. Assim o site continua igual e o fotógrafo
 * tem por onde começar.
 */
export async function garantirModeloInicial(): Promise<void> {
  const existentes = await rest<{ id: string }[]>("site_modelos?select=id&limit=1");
  if (existentes && existentes.length > 0) return;
  const agora = new Date().toISOString();
  const criados = await rest<{ id: string }[]>("site_modelos", {
    method: "POST",
    body: { nome: NOME_MODELO_INICIAL, rascunho: MODELO_INICIAL, publicado: MODELO_INICIAL, publicado_em: agora },
    prefer: "return=representation",
  });
  const id = criados?.[0]?.id;
  if (!id) return;
  await rest("config", {
    method: "POST",
    body: { chave: CHAVE_SITE_ATIVO, valor: id, atualizado_em: agora },
    prefer: "resolution=merge-duplicates",
  });
}

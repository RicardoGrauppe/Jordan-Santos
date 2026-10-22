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
import type { DadosSite, RaizProps } from "./blocos";
import { MODELO_INICIAL, NOME_MODELO_INICIAL } from "./modelo-inicial";
import { modeloGuiado, temTextoDeExemplo } from "./modelo-guiado";
import { TIPOS_DE_BLOCO } from "./tipos";

export const CHAVE_SITE_ATIVO = "site_ativo";

export type ResumoModelo = {
  id: string;
  nome: string;
  atualizado_em: string;
  publicado_em: string | null;
  /** quantos blocos o modelo tem (no rascunho) */
  blocos: number;
  /** o rascunho tem mudança que ainda não foi publicada */
  pendente: boolean;
  /** ainda sobrou texto de exemplo do modelo guiado no rascunho */
  exemplo: boolean;
};

type LinhaModelo = {
  id: string;
  nome: string;
  atualizado_em: string;
  publicado_em: string | null;
  rascunho: DadosSite;
  publicado: DadosSite | null;
};

const NOME_MAX = 80;

/** Nome limpo, ou null quando não sobra nada. */
export function nomeValido(nome: unknown): string | null {
  const limpo = typeof nome === "string" ? nome.trim().slice(0, NOME_MAX) : "";
  return limpo || null;
}

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

/** Lista dos modelos, do mais recente pro mais antigo. Traz o conteúdo pra
    contar blocos e comparar rascunho com publicado: são poucos modelos, e o
    jsonb do Postgres devolve as chaves sempre na mesma ordem, então comparar
    o texto basta. */
export async function listarModelos(): Promise<ResumoModelo[]> {
  const linhas = (await rest<LinhaModelo[]>(
    "site_modelos?select=id,nome,atualizado_em,publicado_em,rascunho,publicado&order=atualizado_em.desc",
  )) ?? [];
  return linhas.map((l) => ({
    id: l.id,
    nome: l.nome,
    atualizado_em: l.atualizado_em,
    publicado_em: l.publicado_em,
    blocos: l.rascunho?.content?.length ?? 0,
    pendente: !l.publicado || JSON.stringify(l.rascunho) !== JSON.stringify(l.publicado),
    exemplo: temTextoDeExemplo(l.rascunho),
  }));
}

async function lerModelo(id: string): Promise<LinhaModelo | null> {
  const linhas = await rest<LinhaModelo[]>(
    "site_modelos?id=eq." + encodeURIComponent(id) + "&select=*&limit=1",
  );
  return linhas?.[0] ?? null;
}

async function inserir(nome: string, rascunho: DadosSite): Promise<string> {
  const criados = await rest<{ id: string }[]>("site_modelos", {
    method: "POST",
    body: { nome, rascunho },
    prefer: "return=representation",
  });
  const id = criados?.[0]?.id;
  if (!id) throw new Error("modelo não criado");
  return id;
}

async function gravarSiteAtivo(id: string): Promise<void> {
  await rest("config", {
    method: "POST",
    body: { chave: CHAVE_SITE_ATIVO, valor: id, atualizado_em: new Date().toISOString() },
    prefer: "resolution=merge-duplicates",
  });
}

/** Modelo novo: nasce do modelo guiado (blocos que explicam como funcionam,
    ver modelo-guiado.ts) com o contato do site que está no ar, pra ninguém
    ter de redigitar telefone e e-mail a cada modelo novo. */
export async function criarModeloNovo(nome: string): Promise<string> {
  const noAr = await siteNoAr();
  const contato = { ...MODELO_INICIAL.root.props, ...noAr.root.props } as RaizProps;
  return inserir(nome, modeloGuiado(contato));
}

/** Cópia do rascunho de um modelo, fora do ar e nunca publicada. */
export async function duplicarModelo(id: string): Promise<string | null> {
  const original = await lerModelo(id);
  if (!original) return null;
  return inserir(nomeValido(original.nome + " (cópia)") ?? original.nome, original.rascunho);
}

export async function renomearModelo(id: string, nome: string): Promise<void> {
  await rest("site_modelos?id=eq." + encodeURIComponent(id), {
    method: "PATCH",
    body: { nome, atualizado_em: new Date().toISOString() },
  });
}

/**
 * Põe o modelo no ar do jeito que ele está: o rascunho vira a versão
 * publicada e o modelo vira o site ativo. Modelo sem bloco nenhum não vai pro
 * ar, porque deixaria o site em branco pra quem abrir o link.
 */
export async function porNoAr(id: string): Promise<"ok" | "nao-existe" | "vazio"> {
  const modelo = await lerModelo(id);
  if (!modelo) return "nao-existe";
  if (!modelo.rascunho?.content?.length) return "vazio";
  const agora = new Date().toISOString();
  await rest("site_modelos?id=eq." + encodeURIComponent(id), {
    method: "PATCH",
    body: { publicado: modelo.rascunho, publicado_em: agora },
  });
  await gravarSiteAtivo(id);
  await guardarVersao(id, modelo.rascunho, agora);
  return "ok";
}

/* ---------- versões publicadas ---------- */

const VERSOES_MAX = 30;

export type ResumoVersao = { id: string; publicado_em: string; blocos: number };

/** Guarda o que acabou de ir pro ar e apaga as mais antigas que as 30 últimas. */
async function guardarVersao(modeloId: string, dados: DadosSite, quando: string): Promise<void> {
  await rest("site_versoes", { method: "POST", body: { modelo_id: modeloId, dados, publicado_em: quando } });
  const sobrando = (await rest<{ id: string }[]>(
    "site_versoes?modelo_id=eq." + encodeURIComponent(modeloId) +
    "&select=id&order=publicado_em.desc&offset=" + VERSOES_MAX,
  )) ?? [];
  if (sobrando.length) {
    await rest("site_versoes?id=in.(" + sobrando.map((v) => v.id).join(",") + ")", { method: "DELETE" });
  }
}

export async function listarVersoes(modeloId: string): Promise<ResumoVersao[]> {
  const linhas = (await rest<{ id: string; publicado_em: string; dados: DadosSite }[]>(
    "site_versoes?modelo_id=eq." + encodeURIComponent(modeloId) + "&select=id,publicado_em,dados&order=publicado_em.desc",
  )) ?? [];
  return linhas.map((v) => ({ id: v.id, publicado_em: v.publicado_em, blocos: v.dados?.content?.length ?? 0 }));
}

/** Uma versão publicada, só se for mesmo daquele modelo. */
export async function versaoDe(modeloId: string, versaoId: string): Promise<{ dados: DadosSite; publicado_em: string } | null> {
  const linhas = await rest<{ dados: DadosSite; publicado_em: string }[]>(
    "site_versoes?id=eq." + encodeURIComponent(versaoId) + "&modelo_id=eq." + encodeURIComponent(modeloId) +
    "&select=dados,publicado_em&limit=1",
  );
  return linhas?.[0] ?? null;
}

/**
 * Leva uma versão publicada pro rascunho. Não publica: o fotógrafo vê no
 * editor como ficou e publica quando quiser.
 */
export async function restaurarVersao(modeloId: string, versaoId: string): Promise<boolean> {
  const versao = await versaoDe(modeloId, versaoId);
  if (!versao) return false;
  return salvarRascunho(modeloId, versao.dados);
}

/** Joga fora o que foi editado desde a última publicação: o rascunho volta a
    ser a versão no ar. Modelo nunca publicado não tem pra onde voltar. */
export async function descartarMudancas(id: string): Promise<"ok" | "nao-existe" | "nunca-publicado"> {
  const modelo = await lerModelo(id);
  if (!modelo) return "nao-existe";
  if (!modelo.publicado) return "nunca-publicado";
  await salvarRascunho(id, modelo.publicado);
  return "ok";
}

/** Apaga um modelo. O que está no ar não se apaga: o site ficaria sem nada. */
export async function apagarModelo(id: string): Promise<"ok" | "no-ar"> {
  if ((await idDoSiteAtivo()) === id) return "no-ar";
  await rest("site_modelos?id=eq." + encodeURIComponent(id), { method: "DELETE" });
  return "ok";
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
  await gravarSiteAtivo(id);
  await guardarVersao(id, MODELO_INICIAL, agora);
}

/** Rascunho de um modelo, pra prévia do fotógrafo. null quando não existe. */
export async function rascunhoDe(id: string): Promise<{ nome: string; rascunho: DadosSite } | null> {
  const linhas = await rest<{ nome: string; rascunho: DadosSite }[]>(
    "site_modelos?id=eq." + encodeURIComponent(id) + "&select=nome,rascunho&limit=1",
  );
  return linhas?.[0] ?? null;
}

/* ---------- editor ---------- */

export type ModeloParaEditar = {
  id: string;
  nome: string;
  rascunho: DadosSite;
  publicado_em: string | null;
  noAr: boolean;
  pendente: boolean;
};

/** Tudo que o editor precisa pra abrir um modelo. null quando não existe. */
export async function modeloParaEditar(id: string): Promise<ModeloParaEditar | null> {
  const [modelo, ativo] = await Promise.all([lerModelo(id), idDoSiteAtivo()]);
  if (!modelo) return null;
  return {
    id: modelo.id,
    nome: modelo.nome,
    rascunho: modelo.rascunho,
    publicado_em: modelo.publicado_em,
    noAr: ativo === modelo.id,
    pendente: !modelo.publicado || JSON.stringify(modelo.rascunho) !== JSON.stringify(modelo.publicado),
  };
}

/* Teto do rascunho: o conteúdo é texto e endereço de foto (a foto em si mora
   no Storage), então 1 MB é folga de sobra e barra lixo. */
const RASCUNHO_MAX = 1_000_000;

/**
 * Confere a forma do que o editor manda antes de gravar: raiz com props,
 * lista de blocos de tipos conhecidos, cada um com id. Não confere campo por
 * campo: quem desenha é o bloco, e campo faltando cai no valor padrão dele.
 */
export function rascunhoValido(dados: unknown): DadosSite | null {
  if (!dados || typeof dados !== "object") return null;
  const d = dados as { root?: unknown; content?: unknown; zones?: unknown };
  if (JSON.stringify(d).length > RASCUNHO_MAX) return null;
  const raiz = d.root as { props?: unknown } | undefined;
  if (!raiz || typeof raiz !== "object" || (raiz.props !== undefined && typeof raiz.props !== "object")) return null;
  if (!Array.isArray(d.content)) return null;
  const tipos: readonly string[] = TIPOS_DE_BLOCO;
  for (const bloco of d.content) {
    const b = bloco as { type?: unknown; props?: { id?: unknown } } | null;
    if (!b || typeof b.type !== "string" || !tipos.includes(b.type)) return null;
    if (!b.props || typeof b.props !== "object" || typeof b.props.id !== "string") return null;
  }
  return { root: raiz as DadosSite["root"], content: d.content as DadosSite["content"], zones: {} };
}

export async function salvarRascunho(id: string, rascunho: DadosSite): Promise<boolean> {
  const linhas = await rest<{ id: string }[]>("site_modelos?id=eq." + encodeURIComponent(id), {
    method: "PATCH",
    body: { rascunho, atualizado_em: new Date().toISOString() },
    prefer: "return=representation",
  });
  return Boolean(linhas?.length);
}

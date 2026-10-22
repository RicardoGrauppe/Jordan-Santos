/*
  Leitura e gravação dos formulários de cadastro (tabela `config`, JSON em
  texto como as outras chaves).

  Desde 22/10/2026 (pedido do Ricardo) o formulário é um TIPO DE MODELO do
  Ateliê: o fotógrafo pode ter vários, e um deles está em uso (é o que o
  /cadastro mostra). Duas chaves:
  - "formulario_modelos": a lista [{ id, nome, atualizado_em, formulario }];
  - "formulario_ativo": o id do que está em uso.
  Ficou em `config` e não em tabela nova de propósito: não pede migração, e
  o banco de produção já tem tudo pra rodar.

  A chave de antes ("formulario_cadastro", um formulário só) vira o primeiro
  modelo, "Formulário padrão", na primeira vez que o painel lista os
  modelos. Até lá, e sempre que algo faltar, o /cadastro continua lendo a
  chave antiga e, sem ela, o formulário padrão do código.

  Ler nunca falha: banco fora do ar ou chave ausente devolvem o formulário
  padrão. O casal não pode ficar sem formulário porque a config não carregou.
*/
import "server-only";
import { randomUUID } from "node:crypto";
import { rest } from "@/lib/supabase";
import { formularioPadrao, normalizarFormulario, type FotoAbertura, type Formulario } from "@/lib/formulario";

const CHAVE_ANTIGA = "formulario_cadastro";
const CHAVE_MODELOS = "formulario_modelos";
const CHAVE_ATIVO = "formulario_ativo";
export const NOME_PADRAO = "Formulário padrão";

export type ModeloFormulario = { id: string; nome: string; atualizado_em: string; formulario: Formulario };
export type ResumoFormulario = {
  id: string; nome: string; atualizado_em: string; perguntas: number;
  /** primeira foto da abertura, pra capa do cartão no Ateliê */
  capa: Pick<FotoAbertura, "id" | "origem"> | null;
};

async function lerChave(chave: string): Promise<string | null> {
  const linhas = await rest<{ valor: string | null }[]>(
    "config?chave=eq." + chave + "&select=valor&limit=1",
  );
  return linhas?.[0]?.valor ?? null;
}

async function gravarChave(chave: string, valor: string): Promise<void> {
  await rest("config", {
    method: "POST",
    body: { chave, valor, atualizado_em: new Date().toISOString() },
    prefer: "resolution=merge-duplicates",
  });
}

function modelosDe(bruto: string | null): ModeloFormulario[] | null {
  if (!bruto) return null;
  try {
    const lista = JSON.parse(bruto) as unknown;
    if (!Array.isArray(lista)) return null;
    return lista
      .filter((m): m is ModeloFormulario => !!m && typeof m === "object" && typeof (m as ModeloFormulario).id === "string")
      .map((m) => ({
        id: m.id,
        nome: String(m.nome || NOME_PADRAO).slice(0, 80),
        atualizado_em: String(m.atualizado_em || new Date().toISOString()),
        formulario: normalizarFormulario(m.formulario),
      }));
  } catch {
    return null;
  }
}

async function lerAntigo(): Promise<Formulario> {
  const bruto = await lerChave(CHAVE_ANTIGA);
  return bruto ? normalizarFormulario(JSON.parse(bruto)) : formularioPadrao();
}

/** O que o /cadastro mostra: o modelo em uso. Nunca falha. */
export async function lerFormulario(): Promise<Formulario> {
  try {
    const [modelos, ativo] = await Promise.all([lerChave(CHAVE_MODELOS).then(modelosDe), lerChave(CHAVE_ATIVO)]);
    const emUso = modelos?.find((m) => m.id === ativo) ?? modelos?.[0];
    if (emUso) return emUso.formulario;
    return await lerAntigo();
  } catch (e) {
    console.error("formulário: leitura falhou, usando o padrão:", (e as Error).message);
    return formularioPadrao();
  }
}

/** A lista inteira e o id em uso. Na primeira vez, o formulário de antes vira
 *  o "Formulário padrão" (e fica em uso). */
export async function lerModelos(): Promise<{ modelos: ModeloFormulario[]; ativo: string }> {
  const [modelos, ativo] = await Promise.all([lerChave(CHAVE_MODELOS).then(modelosDe), lerChave(CHAVE_ATIVO)]);
  if (modelos && modelos.length) {
    const emUso = modelos.some((m) => m.id === ativo) ? ativo! : modelos[0].id;
    return { modelos, ativo: emUso };
  }
  const primeiro: ModeloFormulario = {
    id: randomUUID(), nome: NOME_PADRAO, atualizado_em: new Date().toISOString(), formulario: await lerAntigo(),
  };
  await gravarChave(CHAVE_MODELOS, JSON.stringify([primeiro]));
  await gravarChave(CHAVE_ATIVO, primeiro.id);
  return { modelos: [primeiro], ativo: primeiro.id };
}

export function resumo(m: ModeloFormulario): ResumoFormulario {
  return {
    id: m.id, nome: m.nome, atualizado_em: m.atualizado_em,
    perguntas: m.formulario.perguntas.filter((p) => p.visivel).length,
    capa: m.formulario.fotos[0] ? { id: m.formulario.fotos[0].id, origem: m.formulario.fotos[0].origem } : null,
  };
}

async function gravarModelos(modelos: ModeloFormulario[]): Promise<void> {
  await gravarChave(CHAVE_MODELOS, JSON.stringify(modelos));
}

/** Grava o formulário de um modelo, já normalizado, e devolve o de antes
 *  (pra quem chama apagar as fotos que saíram). */
export async function gravarFormulario(id: string, bruto: unknown): Promise<{ antes: Formulario; depois: Formulario }> {
  const { modelos } = await lerModelos();
  const alvo = modelos.find((m) => m.id === id);
  if (!alvo) throw new Error("modelo não encontrado");
  const depois = normalizarFormulario(bruto);
  const antes = alvo.formulario;
  alvo.formulario = depois;
  alvo.atualizado_em = new Date().toISOString();
  await gravarModelos(modelos);
  return { antes, depois };
}

/** Fotos enviadas que nenhum modelo usa mais (duplicar copia as referências,
 *  então uma foto só pode ir embora quando ninguém aponta pra ela). */
export async function fotosSemDono(candidatas: string[]): Promise<string[]> {
  if (!candidatas.length) return [];
  const { modelos } = await lerModelos();
  const usadas = new Set(modelos.flatMap((m) => m.formulario.fotos.map((f) => f.id)));
  return candidatas.filter((id) => !usadas.has(id));
}

export async function criarModelo(nome: string): Promise<string> {
  const { modelos } = await lerModelos();
  const novo: ModeloFormulario = {
    id: randomUUID(), nome: nome.trim().slice(0, 80) || "Formulário sem título",
    atualizado_em: new Date().toISOString(), formulario: formularioPadrao(),
  };
  await gravarModelos([...modelos, novo]);
  return novo.id;
}

export async function duplicarModelo(id: string): Promise<string> {
  const { modelos } = await lerModelos();
  const base = modelos.find((m) => m.id === id);
  if (!base) throw new Error("modelo não encontrado");
  const copia: ModeloFormulario = {
    id: randomUUID(), nome: (base.nome + " (cópia)").slice(0, 80),
    atualizado_em: new Date().toISOString(), formulario: structuredClone(base.formulario),
  };
  await gravarModelos([...modelos, copia]);
  return copia.id;
}

export async function renomearModelo(id: string, nome: string): Promise<void> {
  const { modelos } = await lerModelos();
  const alvo = modelos.find((m) => m.id === id);
  if (!alvo) throw new Error("modelo não encontrado");
  alvo.nome = nome.trim().slice(0, 80) || alvo.nome;
  await gravarModelos(modelos);
}

export async function usarModelo(id: string): Promise<void> {
  const { modelos } = await lerModelos();
  if (!modelos.some((m) => m.id === id)) throw new Error("modelo não encontrado");
  await gravarChave(CHAVE_ATIVO, id);
}

/** Apaga um modelo que NÃO está em uso; devolve as fotos dele que ficaram sem dono. */
export async function apagarModelo(id: string): Promise<string[]> {
  const { modelos, ativo } = await lerModelos();
  if (id === ativo) throw new Error("em uso");
  const alvo = modelos.find((m) => m.id === id);
  if (!alvo) return [];
  const restantes = modelos.filter((m) => m.id !== id);
  await gravarModelos(restantes);
  const usadas = new Set(restantes.flatMap((m) => m.formulario.fotos.map((f) => f.id)));
  return alvo.formulario.fotos.filter((f) => f.origem === "enviada" && !usadas.has(f.id)).map((f) => f.id);
}

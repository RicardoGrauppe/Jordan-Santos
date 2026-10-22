/*
  Leitura e gravação da config do formulário de cadastro (tabela `config`,
  chave "formulario_cadastro", JSON em texto como as outras chaves).

  Ler nunca falha: banco fora do ar ou chave ausente devolvem o formulário
  padrão, que é exatamente o /cadastro de antes da tela de edição existir. O
  casal não pode ficar sem formulário porque a config não carregou.
*/
import "server-only";
import { rest } from "@/lib/supabase";
import { formularioPadrao, normalizarFormulario, type Formulario } from "@/lib/formulario";

const CHAVE = "formulario_cadastro";

export async function lerFormulario(): Promise<Formulario> {
  try {
    const linhas = await rest<{ valor: string | null }[]>(
      "config?chave=eq." + CHAVE + "&select=valor&limit=1",
    );
    const bruto = linhas?.[0]?.valor;
    if (!bruto) return formularioPadrao();
    return normalizarFormulario(JSON.parse(bruto));
  } catch (e) {
    console.error("formulário: leitura falhou, usando o padrão:", (e as Error).message);
    return formularioPadrao();
  }
}

/** Grava já normalizado e devolve o que ficou gravado. */
export async function gravarFormulario(bruto: unknown): Promise<Formulario> {
  const formulario = normalizarFormulario(bruto);
  await rest("config", {
    method: "POST",
    body: { chave: CHAVE, valor: JSON.stringify(formulario), atualizado_em: new Date().toISOString() },
    prefer: "resolution=merge-duplicates",
  });
  return formulario;
}

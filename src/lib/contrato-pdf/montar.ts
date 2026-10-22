import "server-only";
/*
  Monta o PDF de um contrato a partir da linha dele no banco, escolhendo o
  gerador certo. Estava escrito dentro de /api/assinatura, que era o único
  lugar que precisava; desde 21/10/2026 o envio pra Autentique precisa do mesmo
  PDF, e duas cópias dessa escolha seria pedir pra elas divergirem.

  Qual gerador:
  - contrato COM modelo (texto editado em /configuracoes) monta do zero pelo
    pdfmake, a partir do JSON do Tiptap;
  - contrato SEM modelo (o texto fixo de sempre) usa o template.pdf
    pré-paginado, que é vetorial e pesa um quinto.
  Prefere o snapshot do modelo congelado na geração do contrato; só cai no
  modelo vivo pra contratos antigos, feitos antes do snapshot existir.
*/
import { rest } from "@/lib/supabase";
import { gerarContratoPdf } from "@/lib/contrato-pdf/gerar";
import { gerarContratoPdfDinamico } from "@/lib/contrato-pdf/gerar-pdfmake";
import type { SnapshotContrato } from "@/lib/contrato-pdf/gerar";

export type LinhaParaPdf = {
  snapshot?: SnapshotContrato | null;
  template_id?: string | null;
  template_json_snapshot?: unknown;
  jordan_assinatura_dataurl?: string | null;
};

type LinhaTemplateJson = { conteudo_json: unknown };

export async function montarPdfDoContrato(
  c: LinhaParaPdf,
  opcoes: {
    /** assinatura do casal, quando existir (só o fluxo antigo tinha) */
    assinaturaCasalDataUrl?: string | null;
    signatario: { nome: string; cpf?: string; email?: string };
    assinadoEm: Date;
    /** true no PDF que vai PRA Autentique: o comprovante passa a ser o dela */
    semComprovante?: boolean;
  },
): Promise<Uint8Array> {
  const comum = {
    snapshot: c.snapshot || {},
    assinaturaCasalDataUrl: opcoes.assinaturaCasalDataUrl ?? null,
    assinaturaJordanDataUrl: c.jordan_assinatura_dataurl || null,
    signatario: opcoes.signatario,
    assinadoEm: opcoes.assinadoEm,
    semComprovante: opcoes.semComprovante,
  };

  if (c.template_json_snapshot || c.template_id) {
    let templateJson: unknown = c.template_json_snapshot || null;
    if (!templateJson && c.template_id) {
      const linhas = await rest<LinhaTemplateJson[]>(
        "contrato_templates?id=eq." + c.template_id + "&select=conteudo_json&limit=1",
      );
      templateJson = linhas && linhas[0] && linhas[0].conteudo_json;
    }
    return await gerarContratoPdfDinamico({ ...comum, templateJson });
  }

  return await gerarContratoPdf(comum);
}

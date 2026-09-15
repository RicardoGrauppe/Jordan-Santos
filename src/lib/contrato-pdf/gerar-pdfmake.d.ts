import type { SnapshotContrato, Signatario } from "./gerar";

/** Monta o PDF do zero a partir do JSON do Tiptap, para contrato com modelo
 *  editável (o gerar.js só serve pro texto fixo, que tem PDF pré-paginado). */
export function gerarContratoPdfDinamico(args: {
  templateJson: unknown;
  snapshot: SnapshotContrato;
  assinaturaCasalDataUrl?: string | null;
  assinaturaJordanDataUrl?: string | null;
  signatario: Signatario;
  assinadoEm: Date;
}): Promise<Buffer>;

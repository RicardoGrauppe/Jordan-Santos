/*
  Tipos dos dois geradores de PDF.

  Os .js foram COPIADOS do estúdio do Jordan em vez de reescritos em
  TypeScript, de propósito: é o código que produz o documento assinado, com
  coordenadas conferidas contra um PDF real. Reescrever pra ganhar tipagem
  arriscaria o contrato pra ganhar estética. Os tipos ficam aqui por fora.

  O nome do arquivo importa: o TypeScript só casa uma declaração com o .js de
  MESMO nome (`gerar.d.ts` ↔ `gerar.js`). Com outro nome ele ignora isto e
  infere os tipos do JS, e aí `import "@/lib/contrato-pdf/gerar"` vê `any`.
*/

export type ItemContrato = { id?: string; nome?: string } & Record<string, unknown>;

export type SnapshotContrato = {
  noivo?: string | null; noiva?: string | null;
  cpf_noivo?: string | null; cpf_noiva?: string | null;
  tel_noivo?: string | null; tel_noiva?: string | null;
  endereco?: string | null; numero?: string | null; bairro?: string | null;
  cidade?: string | null; complemento?: string | null; estado?: string | null; cep?: string | null;
  data_evento?: string | null; local_evento?: string | null; horario?: string | null;
  itens?: ItemContrato[]; total?: number | null; entrada?: number | null;
} & Record<string, unknown>;

export type Signatario = { nome: string; cpf?: string | null; email?: string | null };

export const PACOTES: Set<string>;
export function ehPacote(item: ItemContrato): boolean;
export function moeda(v: number | null | undefined): string;
export function cpfFormatado(v: string | null | undefined): string;
export function cepFormatado(v: string | null | undefined): string;
export function dataExtenso(d: Date): string;
export function dataEventoExtenso(iso: string | null | undefined): string;

export function gerarContratoPdf(args: {
  snapshot: SnapshotContrato;
  assinaturaCasalDataUrl?: string | null;
  assinaturaJordanDataUrl?: string | null;
  signatario: Signatario;
  assinadoEm: Date;
  [k: string]: unknown;
}): Promise<Uint8Array>; /* é o `doc.save()` do pdf-lib, que devolve Uint8Array, não Buffer */

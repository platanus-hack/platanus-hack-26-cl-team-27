export type ClaimRole = 'afirma' | 'usa';

export interface Claim {
  readonly subject: string;
  readonly attribute: string;
  readonly value: number | string;
  readonly unit: string | null;
  readonly role: ClaimRole;
  readonly locator: string;
}

export type ChunkKind =
  'fila' | 'anotacion' | 'acuerdo' | 'mensaje' | 'parametro' | 'texto';

export interface Chunk {
  readonly locator: string;
  readonly kind: ChunkKind;
  readonly text?: string;
  readonly claims?: readonly Claim[];
}

export type SourceKind =
  | 'plano'
  | 'eett'
  | 'presupuesto'
  | 'gantt'
  | 'cotizacion'
  | 'acta'
  | 'whatsapp'
  | 'libro';

export interface RawFile {
  readonly folder: string;
  readonly spaceId: string;
  readonly name: string;
  readonly relativePath: string;
  readonly kind: SourceKind;
  readonly pointer: string;
  readonly text: string;
  readonly sha256: string;
}

export interface Revision {
  readonly documentId: string;
  readonly label: string;
  readonly spaceId: string;
  readonly authorId: string;
  readonly pointer: string;
  readonly contentHash: string;
  readonly chunks: readonly Chunk[];
}

export interface Extracted {
  readonly file: RawFile;
  readonly revision: Revision;
}

export interface RevisionRef {
  readonly documentId: string;
  readonly label: string;
}

export class ParseError extends Error {
  constructor(file: string, message: string) {
    super(`${file}: ${message}`);
    this.name = 'ParseError';
  }
}

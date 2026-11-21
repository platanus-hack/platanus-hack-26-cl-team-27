import { HttpException, HttpStatus } from '@nestjs/common';
import { CHUNK_KINDS, chunksFromClaims } from '@team27/context-lake';
import type { ChunkKind, ClaimDraft } from '@team27/context-lake';
import { z } from 'zod';

import type {
  DocumentDef,
  ProjectCatalog,
} from '../project/project-catalog.ts';
import { fail } from './http-errors.ts';

const claimBody = z.object({
  subject: z.string().min(1).max(64),
  attribute: z.string().min(1).max(64),
  value: z.union([z.number().finite(), z.string().min(1).max(200)]),
  unit: z.string().min(1).max(16).nullable(),
  role: z.enum(['afirma', 'usa']),
  locator: z.string().min(1).max(200),
});

const chunkClaimBody = z.object({
  subject: z.string().min(1).max(64),
  attribute: z.string().min(1).max(64),
  value: z.union([z.number().finite(), z.string().min(1).max(200)]),
  unit: z.string().min(1).max(16).nullable(),
  role: z.enum(['afirma', 'usa']),
  locator: z.string().min(1).max(200).optional(),
  confidence: z.number().min(0).max(1).nullish(),
});

const chunkBody = z
  .object({
    locator: z.string().trim().min(1).max(200),
    kind: z.enum(CHUNK_KINDS),
    text: z.string().trim().min(1).max(4000).optional(),
    claims: z.array(chunkClaimBody).max(200).optional(),
  })
  .refine((chunk) => chunk.text !== undefined || chunk.claims !== undefined, {
    message: 'El fragmento necesita texto o hechos',
    path: ['text'],
  });

const baseFields = {
  documentId: z.string().min(1).max(64),
  label: z.string().trim().min(1).max(64),
  spaceId: z.string().min(1).max(64),
  pointer: z.string().min(1).max(400),
  contentHash: z
    .string()
    .regex(/^[0-9a-f]{64}$/)
    .optional(),
};

const claims = z.array(claimBody).max(500);

const chunks = z.array(chunkBody).max(500);

const hasContent = (body: { chunks?: unknown[]; claims?: unknown[] }) =>
  (body.chunks?.length ?? 0) + (body.claims?.length ?? 0) > 0;

export const revisionBody = z
  .object({
    ...baseFields,
    chunks: chunks.optional(),
    claims: claims.optional(),
  })
  .refine(hasContent, {
    message: 'La revisión necesita al menos un fragmento',
    path: ['chunks'],
  });

export const seedBody = z.object({
  revisions: z
    .array(
      z.object({
        ...baseFields,
        authorId: z.string().min(1).max(64),
        chunks: chunks.optional(),
        claims: claims.optional(),
      }),
    )
    .min(1)
    .max(200),
});

export type RevisionInput = z.output<typeof revisionBody>;

export type SeedInput = z.output<typeof seedBody>;

export const knownDocument = (
  project: ProjectCatalog,
  documentId: string,
): DocumentDef => {
  const found = project.documentDef(documentId);
  if (!found) {
    throw fail(
      HttpStatus.NOT_FOUND,
      'unknown_document',
      `El proyecto no tiene el documento ${documentId}`,
    );
  }
  return found;
};

export interface RawChunk {
  readonly locator: string;
  readonly kind: ChunkKind;
  readonly text?: string | undefined;
  readonly claims?: readonly ClaimDraft[] | undefined;
}

export const rawChunksOf = (
  input: Pick<RevisionInput, 'chunks' | 'claims'>,
): RawChunk[] => [
  ...(input.chunks ?? []).map((chunk): RawChunk => ({
    locator: chunk.locator,
    kind: chunk.kind,
    text: chunk.text,
    claims: chunk.claims?.map((claim) => ({
      subject: claim.subject,
      attribute: claim.attribute,
      value: claim.value,
      unit: claim.unit,
      role: claim.role,
      locator: chunk.locator,
      confidence: claim.confidence ?? null,
    })),
  })),
  ...chunksFromClaims((input.claims ?? []).map((claim) => ({ ...claim }))).map(
    (chunk): RawChunk => ({
      locator: chunk.locator,
      kind: chunk.kind,
      claims: chunk.claims,
    }),
  ),
];

export const checkRevision = (
  project: ProjectCatalog,
  input: Pick<RevisionInput, 'spaceId' | 'chunks' | 'claims'>,
  document: DocumentDef,
): RawChunk[] => {
  const issues: string[] = [];
  if (input.spaceId !== document.spaceId) {
    issues.push(
      `${document.name} vive en el espacio ${document.spaceId}, no en ${input.spaceId}`,
    );
  }
  const chunks = rawChunksOf(input);
  chunks.forEach((chunk, index) => {
    (chunk.claims ?? []).forEach((claim) => {
      if (!project.hasSubject(claim.subject)) {
        issues.push(`chunks[${index}]: no existe el sujeto ${claim.subject}`);
      }
      if (!project.hasAttribute(claim.attribute)) {
        issues.push(
          `chunks[${index}]: no existe el atributo ${claim.attribute}`,
        );
      }
    });
  });
  if (issues.length > 0) {
    throw new HttpException(
      {
        code: 'invalid_claims',
        message: 'La revisión trae hechos que el proyecto no reconoce',
        issues,
      },
      HttpStatus.UNPROCESSABLE_ENTITY,
    );
  }
  return chunks;
};

export const checkAuthor = (
  project: ProjectCatalog,
  authorId: string,
): void => {
  if (!project.castMember(authorId)) {
    throw fail(
      HttpStatus.UNPROCESSABLE_ENTITY,
      'invalid_author',
      `No existe el asiento ${authorId}`,
    );
  }
};

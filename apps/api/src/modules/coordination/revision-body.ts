import { HttpException, HttpStatus } from '@nestjs/common';
import type { ClaimDraft } from '@team27/context-lake';
import { z } from 'zod';

import {
  ATTRIBUTES,
  type DocumentDef,
  SUBJECTS,
} from '../../scenario/documents.ts';
import { fail } from './http-errors.ts';
import { castMember, documentDef } from './lookup.ts';

const claimBody = z.object({
  subject: z.string().min(1).max(64),
  attribute: z.string().min(1).max(64),
  value: z.union([z.number().finite(), z.string().min(1).max(200)]),
  unit: z.string().min(1).max(16).nullable(),
  role: z.enum(['afirma', 'usa']),
  locator: z.string().min(1).max(200),
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

export const revisionBody = z.object({
  ...baseFields,
  claims: claims.min(1),
});

export const seedBody = z.object({
  revisions: z
    .array(
      z.object({
        ...baseFields,
        authorId: z.string().min(1).max(64),
        claims,
      }),
    )
    .min(1)
    .max(200),
});

export type RevisionInput = z.output<typeof revisionBody>;

export type SeedInput = z.output<typeof seedBody>;

const subjectIds = new Set(SUBJECTS.map((subject) => subject.id));

const attributeKeys = new Set(ATTRIBUTES.map((attribute) => attribute.key));

export const knownDocument = (documentId: string): DocumentDef => {
  const found = documentDef(documentId);
  if (!found) {
    throw fail(
      HttpStatus.NOT_FOUND,
      'unknown_document',
      `El proyecto no tiene el documento ${documentId}`,
    );
  }
  return found;
};

export const checkRevision = (
  input: Pick<RevisionInput, 'spaceId' | 'claims'>,
  document: DocumentDef,
): ClaimDraft[] => {
  const issues: string[] = [];
  if (input.spaceId !== document.spaceId) {
    issues.push(
      `${document.name} vive en el espacio ${document.spaceId}, no en ${input.spaceId}`,
    );
  }
  input.claims.forEach((claim, index) => {
    if (!subjectIds.has(claim.subject)) {
      issues.push(`claims[${index}]: no existe el sujeto ${claim.subject}`);
    }
    if (!attributeKeys.has(claim.attribute)) {
      issues.push(`claims[${index}]: no existe el atributo ${claim.attribute}`);
    }
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
  return input.claims.map((claim) => ({ ...claim }));
};

export const checkAuthor = (authorId: string): void => {
  if (!castMember(authorId)) {
    throw fail(
      HttpStatus.UNPROCESSABLE_ENTITY,
      'invalid_author',
      `No existe el asiento ${authorId}`,
    );
  }
};

import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import {
  ExtractClaims,
  InferenceUnavailableError,
  type TextSource,
} from '@team27/context-impact';
import type { ChunkDraft } from '@team27/context-lake';

import { buildVocabulary } from '../impact/vocabulary.ts';
import type {
  DocumentDef,
  ProjectCatalog,
} from '../project/project-catalog.ts';
import { fail } from './http-errors.ts';
import type { RawChunk } from './revision-body.ts';

const sourceOf = (document: DocumentDef): TextSource =>
  document.kind === 'mensaje'
    ? 'mensaje'
    : document.kind === 'libro_obra'
      ? 'libro_obra'
      : 'documento';

@Injectable()
export class ChunkReader {
  private readonly extractClaims: ExtractClaims;

  constructor(@Inject(ExtractClaims) extractClaims: ExtractClaims) {
    this.extractClaims = extractClaims;
  }

  async read(
    project: ProjectCatalog,
    document: DocumentDef,
    label: string,
    chunks: readonly RawChunk[],
  ): Promise<ChunkDraft[]> {
    const drafts: ChunkDraft[] = [];
    for (const chunk of chunks) {
      if (chunk.claims !== undefined || chunk.text === undefined) {
        drafts.push({
          locator: chunk.locator,
          kind: chunk.kind,
          text: chunk.text ?? null,
          claims: chunk.claims ?? [],
          rejected: [],
        });
        continue;
      }
      drafts.push(
        await this.readText(project, document, label, chunk, chunk.text),
      );
    }
    return drafts;
  }

  private async readText(
    project: ProjectCatalog,
    document: DocumentDef,
    label: string,
    chunk: RawChunk,
    text: string,
  ): Promise<ChunkDraft> {
    try {
      const screened = await this.extractClaims.execute({
        evidence: {
          kind: 'text',
          source: sourceOf(document),
          title: `${document.name} ${label}`,
          text,
        },
        vocabulary: buildVocabulary(project),
      });
      return {
        locator: chunk.locator,
        kind: chunk.kind,
        text,
        claims: screened.accepted.map((candidate) => ({
          subject: candidate.subject,
          attribute: candidate.attribute,
          value: candidate.value,
          unit: candidate.unit,
          role: candidate.role,
          locator: chunk.locator,
          confidence: candidate.confidence,
        })),
        rejected: screened.rejected.map(({ candidate, reason }) => ({
          subject: candidate.subject,
          attribute: candidate.attribute,
          value: candidate.value,
          unit: candidate.unit,
          role: candidate.role,
          confidence: candidate.confidence,
          reason,
        })),
      };
    } catch (error) {
      if (error instanceof InferenceUnavailableError) {
        throw fail(
          HttpStatus.SERVICE_UNAVAILABLE,
          'inference_unavailable',
          `No pudimos leer el texto del fragmento ${chunk.locator}: ${error.message}`,
        );
      }
      throw error;
    }
  }
}

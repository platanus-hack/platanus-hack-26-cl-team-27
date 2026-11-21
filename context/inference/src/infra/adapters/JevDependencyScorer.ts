import {
  noul,
  TypeSafeError,
  type JsonValue,
  type NoulQuestion,
  type TypeSafeClient,
} from '@typesafe-ai/sdk';
import { InferenceUnavailableError } from '../../application/errors.ts';
import type { AffectedQuery } from '../../application/ports/AffectedEstimator.ts';
import type { DependencyScorer } from '../../application/ports/DependencyScorer.ts';
import type { DependencyScore } from '../../domain/DependencyScore.ts';
import { findAttribute } from '../../domain/Vocabulary.ts';

export const JEV_MODEL = 'jev-latest';

export interface JevOptions {
  readonly model?: string;
}

const NOUL_CRITERIA = {
  true: 'Su trabajo usa ese valor o se apoya en él, y tendría que revisar o actualizar algo',
  false: 'El cambio no toca su trabajo',
};

export const jevState = (
  query: AffectedQuery,
): { [key: string]: JsonValue } => {
  const { change, vocabulary } = query;
  const subject = vocabulary.subjects.find(
    (candidate) => candidate.id === change.subjectId,
  );
  const attribute = findAttribute(
    vocabulary,
    change.subjectId,
    change.attribute,
  );
  return {
    proyecto: vocabulary.project,
    cambio: {
      elemento: subject?.label ?? change.subjectId,
      atributo: attribute?.label ?? change.attribute,
      antes: change.before,
      despues: change.after,
      unidad: change.unit,
      resumen: change.summary,
    },
    evidencia: query.evidence
      .filter((item) => item.kind === 'text')
      .map((item) => ({
        titulo: item.title,
        fuente: item.source,
        texto: item.text,
      })),
  };
};

export const jevQuestions = (
  query: AffectedQuery,
): Record<string, NoulQuestion> =>
  Object.fromEntries(
    query.candidates.map((candidate, index) => [
      `p${index}`,
      noul(
        `¿El trabajo de ${candidate.name} (${candidate.role}) depende de \`cambio\` aunque las reglas del proyecto no le hayan avisado? Considera \`evidencia\`.`,
        NOUL_CRITERIA,
      ),
    ]),
  );

export class JevDependencyScorer implements DependencyScorer {
  private readonly client: TypeSafeClient;
  private readonly model: string;

  constructor(client: TypeSafeClient, options: JevOptions = {}) {
    this.client = client;
    this.model = options.model ?? JEV_MODEL;
  }

  async score(query: AffectedQuery): Promise<DependencyScore[]> {
    if (query.candidates.length === 0) return [];
    let answers;
    try {
      ({ answers } = await this.client.systemOne({
        model: this.model,
        state: jevState(query),
        questions: jevQuestions(query),
      }));
    } catch (error) {
      if (error instanceof TypeSafeError) {
        throw new InferenceUnavailableError(
          `Jev no respondió: ${error.message}`,
          { cause: error },
        );
      }
      throw error;
    }
    return query.candidates.flatMap((candidate, index) => {
      const answer = answers[`p${index}`];
      return answer
        ? [{ stakeholderId: candidate.id, probability: answer.noul }]
        : [];
    });
  }
}

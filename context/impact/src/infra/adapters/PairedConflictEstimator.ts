import type {
  ConflictEstimator,
  ConflictQuery,
} from '../../application/ports/ConflictEstimator.ts';
import type { ConflictEstimate } from '../../domain/ConflictSuggestion.ts';

interface PairVerdict {
  readonly probability: number;
  readonly reason: string;
  readonly question: string;
}

const pairKey = (a: string, b: string): string =>
  a < b ? `${a}|${b}` : `${b}|${a}`;

export class PairedConflictEstimator implements ConflictEstimator {
  private readonly inner: ConflictEstimator;
  private readonly pairs = new Map<string, PairVerdict>();

  constructor(inner: ConflictEstimator) {
    this.inner = inner;
  }

  async estimate(query: ConflictQuery): Promise<ConflictEstimate[]> {
    const id = query.change.id;
    const known = query.others.filter((other) =>
      this.pairs.has(pairKey(id, other.id)),
    );
    const unknown = query.others.filter(
      (other) => !this.pairs.has(pairKey(id, other.id)),
    );
    if (unknown.length > 0) {
      const unknownIds = new Set(unknown.map((other) => other.id));
      const fresh = await this.inner.estimate({ ...query, others: unknown });
      for (const estimate of fresh) {
        if (!unknownIds.has(estimate.otherChangeId)) continue;
        const key = pairKey(id, estimate.otherChangeId);
        const previous = this.pairs.get(key);
        if (previous && previous.probability >= estimate.probability) continue;
        this.pairs.set(key, {
          probability: estimate.probability,
          reason: estimate.reason,
          question: estimate.question,
        });
      }
    }
    return [...known, ...unknown].flatMap((other) => {
      const verdict = this.pairs.get(pairKey(id, other.id));
      return verdict ? [{ otherChangeId: other.id, ...verdict }] : [];
    });
  }
}

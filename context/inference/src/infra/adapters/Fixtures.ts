import type {
  AffectedEstimator,
  AffectedQuery,
} from '../../application/ports/AffectedEstimator.ts';
import type {
  ClaimQuery,
  ClaimReader,
} from '../../application/ports/ClaimReader.ts';
import type { DependencyScorer } from '../../application/ports/DependencyScorer.ts';
import type { AffectedEstimate } from '../../domain/AffectedSuggestion.ts';
import type { DependencyScore } from '../../domain/DependencyScore.ts';
import type { ClaimCandidate } from '../../domain/ExtractedClaim.ts';

export interface AffectedFixture {
  readonly subjectId: string;
  readonly attribute: string;
  readonly estimates: readonly AffectedEstimate[];
}

export interface ClaimFixture {
  readonly title: string;
  readonly claims: readonly ClaimCandidate[];
}

export class FixtureAffectedEstimator implements AffectedEstimator {
  private readonly fixtures: readonly AffectedFixture[];

  constructor(fixtures: readonly AffectedFixture[]) {
    this.fixtures = fixtures;
  }

  estimate(query: AffectedQuery): Promise<AffectedEstimate[]> {
    return Promise.resolve(
      this.fixtures
        .filter(
          (fixture) =>
            fixture.subjectId === query.change.subjectId &&
            fixture.attribute === query.change.attribute,
        )
        .flatMap((fixture) => fixture.estimates),
    );
  }
}

export class FixtureClaimReader implements ClaimReader {
  private readonly fixtures: readonly ClaimFixture[];

  constructor(fixtures: readonly ClaimFixture[]) {
    this.fixtures = fixtures;
  }

  read(query: ClaimQuery): Promise<ClaimCandidate[]> {
    const fixture = this.fixtures.find(
      (candidate) => candidate.title === query.evidence.title,
    );
    return Promise.resolve(fixture ? [...fixture.claims] : []);
  }
}

export interface ScoreFixture {
  readonly subjectId: string;
  readonly attribute: string;
  readonly scores: readonly DependencyScore[];
}

export class FixtureDependencyScorer implements DependencyScorer {
  private readonly fixtures: readonly ScoreFixture[];

  constructor(fixtures: readonly ScoreFixture[]) {
    this.fixtures = fixtures;
  }

  score(query: AffectedQuery): Promise<DependencyScore[]> {
    return Promise.resolve(
      this.fixtures
        .filter(
          (fixture) =>
            fixture.subjectId === query.change.subjectId &&
            fixture.attribute === query.change.attribute,
        )
        .flatMap((fixture) => fixture.scores),
    );
  }
}

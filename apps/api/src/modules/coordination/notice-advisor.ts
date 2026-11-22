import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  type AffectedSuggestion,
  ExplainNotices,
  SuggestAffected,
} from '@team27/context-impact';
import type { NoticeSuggestion } from '@team27/context-notification';
import type { PrismaClient } from '@team27/data-main';

import type { Env } from '../../config/index.ts';
import { PRISMA_CLIENT } from '../database/database.module.ts';
import { buildVocabulary } from '../impact/vocabulary.ts';
import { buildLake } from '../lake/lake.module.ts';
import { buildNotification } from '../notification/notification.module.ts';
import type { ProjectCatalog } from '../project/project-catalog.ts';
import { briefOf } from './conflicts.ts';
import { reasonsFor } from './notices.ts';
import { suggestForChange } from './suggestions.ts';

export const ADVICE_TIMEOUT_MS = 9_000;

export interface AdvisedProposal {
  readonly changeId: string | null;
  readonly authorId: string | null;
}

export interface Advice {
  readonly reasons: number;
  readonly added: readonly string[];
}

const NO_ADVICE: Advice = { reasons: 0, added: [] };

export const modelName = (anthropicKey: string | undefined): string =>
  anthropicKey !== undefined && anthropicKey.trim() !== ''
    ? 'Claude'
    : 'Gemini';

export const withinTime = <T>(
  work: Promise<T>,
  ms: number,
  fallback: T,
): Promise<T> =>
  Promise.race([
    work.catch(() => fallback),
    new Promise<T>((resolve) => {
      const timer = setTimeout(() => resolve(fallback), ms);
      timer.unref();
    }),
  ]);

export const suggestionFindings = (
  suggestions: readonly AffectedSuggestion[],
  title: string,
  model: string,
) =>
  suggestions.map((item) => ({
    stakeholderId: item.stakeholderId,
    topic: 'dependency' as const,
    summary: `${model} cree que ${title} te afecta`,
    details: [item.reason, ...(item.evidence.trim() ? [item.evidence] : [])],
    action: item.question,
  }));

export const suggestedBy = (
  suggestions: readonly AffectedSuggestion[],
  model: string,
): Record<string, NoticeSuggestion> =>
  Object.fromEntries(
    suggestions.map((item) => [
      item.stakeholderId,
      {
        probability: item.probability,
        reason: item.reason,
        evidence: item.evidence,
        model,
      },
    ]),
  );

@Injectable()
export class NoticeAdvisor {
  private readonly logger = new Logger('Avisos con IA');
  private readonly prisma: PrismaClient;
  private readonly suggest: SuggestAffected;
  private readonly explain: ExplainNotices;
  private readonly model: string;

  constructor(
    @Inject(PRISMA_CLIENT) prisma: PrismaClient,
    @Inject(SuggestAffected) suggest: SuggestAffected,
    @Inject(ExplainNotices) explain: ExplainNotices,
    @Inject(ConfigService) config: ConfigService<Env, true>,
  ) {
    this.prisma = prisma;
    this.suggest = suggest;
    this.explain = explain;
    this.model = modelName(config.get('ANTHROPIC_API_KEY', { infer: true }));
  }

  async adviseAll(
    project: ProjectCatalog,
    proposals: readonly AdvisedProposal[],
  ): Promise<Advice[]> {
    return Promise.all(
      proposals.map((proposal) =>
        this.advise(project, proposal).catch((error: unknown) => {
          this.logger.warn(
            `No pude consultar al modelo: ${error instanceof Error ? error.message : String(error)}`,
          );
          return NO_ADVICE;
        }),
      ),
    );
  }

  async advise(
    project: ProjectCatalog,
    proposal: AdvisedProposal,
  ): Promise<Advice> {
    if (proposal.changeId === null) return NO_ADVICE;
    const change = await buildLake(this.prisma, project).getChange.execute(
      proposal.changeId,
    );
    if (!change) return NO_ADVICE;
    const notification = buildNotification(this.prisma, project);
    const notified = (
      await notification.listNotifications.execute({
        changeIds: [change.id],
        kind: 'change',
      })
    ).filter((item) => item.changeId === change.id);
    const [reasons, split] = await Promise.all([
      withinTime(
        reasonsFor(this.explain, briefOf(change), project, notified),
        ADVICE_TIMEOUT_MS,
        { reasons: [], inference: 'unavailable' as const },
      ),
      withinTime(
        suggestForChange(this.suggest, {
          change,
          vocabulary: buildVocabulary(project),
          notifiedIds: notified.map((item) => item.stakeholderId),
          authorId: proposal.authorId,
        }),
        ADVICE_TIMEOUT_MS,
        { ask: [], watch: [] },
      ),
    ]);
    const attached = await notification.attachReasons.execute({
      changeId: change.id,
      reasons: reasons.reasons.map((reason) => ({
        stakeholderId: reason.stakeholderId,
        why: reason.why,
        whyBy: this.model,
      })),
    });
    const notifiedIds = new Set(notified.map((item) => item.stakeholderId));
    const extra = split.ask.filter(
      (item) =>
        !notifiedIds.has(item.stakeholderId) &&
        item.stakeholderId !== proposal.authorId,
    );
    const title = change.element.name;
    const added =
      extra.length === 0
        ? []
        : await notification.notifyStakeholders.execute({
            projectId: project.id,
            changeId: change.id,
            title: notified[0]?.title ?? `${title} · ${change.summary}`,
            findings: suggestionFindings(extra, title, this.model),
            impact: notified[0]?.context?.impact ?? null,
            diffs: notified[0]?.context?.diffs ?? [],
            suggested: suggestedBy(extra, this.model),
          });
    if (attached + added.length > 0) {
      this.logger.log(
        `${this.model}: ${attached} porqués y ${added.length} afectados más en ${change.id}`,
      );
    }
    return {
      reasons: attached,
      added: added.map((item) => item.stakeholderId),
    };
  }
}

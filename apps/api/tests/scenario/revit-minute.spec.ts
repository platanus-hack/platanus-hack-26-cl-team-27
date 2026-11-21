import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { diffSnapshots } from '@team27/context-capture';
import { analyzeChange } from '@team27/context-impact';
import { IngestRevision, OpenProposal, SeedLake } from '@team27/context-lake';
import { InlineFactExtractor } from '@team27/context-lake/adapters';

import { elementsFromBaseline } from '../../src/modules/coordination/elements-from-baseline.ts';
import {
  mapMinute,
  revitMinuteBody,
} from '../../src/modules/coordination/revit-minute.ts';
import { seededRevisions } from '../../src/scenario/documents.ts';
import { LOS_AROMOS } from '../../src/scenario/los-aromos.ts';
import {
  InMemoryAcknowledgements,
  InMemoryBaseline,
  InMemoryClaims,
  InMemoryDiscrepancies,
  InMemoryProposals,
  InMemoryRevisions,
} from './inMemoryLake.ts';

const example = revitMinuteBody.parse(
  JSON.parse(
    readFileSync(
      resolve(
        dirname(fileURLToPath(import.meta.url)),
        '../../../../tool-use-case/revit/contract/minuta.example.json',
      ),
      'utf8',
    ),
  ),
);

describe('minuta de Revit sobre el lago', () => {
  it('el ejemplo abre la losa y las ventanas con las mismas cifras del catálogo', async () => {
    const revisions = new InMemoryRevisions();
    const claims = new InMemoryClaims();
    const baseline = new InMemoryBaseline();
    const proposals = new InMemoryProposals();
    const discrepancies = new InMemoryDiscrepancies();
    const acknowledgements = new InMemoryAcknowledgements();
    await new SeedLake(
      revisions,
      claims,
      baseline,
      proposals,
      discrepancies,
      acknowledgements,
    ).execute({ revisions: seededRevisions() });

    const mapped = mapMinute(example, 'fernanda-lagos');
    const ingest = new IngestRevision(
      revisions,
      claims,
      baseline,
      proposals,
      discrepancies,
      new InlineFactExtractor(mapped.claims),
    );
    const open = new OpenProposal(proposals, baseline);
    const ingested = await ingest.execute(mapped.revision);

    expect(ingested.outcomes.map((outcome) => outcome.kind)).toEqual([
      'change',
      'change',
    ]);
    expect(ingested.drafts).toHaveLength(2);

    const opened = [];
    for (const draft of ingested.drafts) {
      const entries = await baseline.list();
      const base = elementsFromBaseline(LOS_AROMOS.model, entries).filter(
        (element) => element.id === draft.subject,
      );
      const next = elementsFromBaseline(LOS_AROMOS.model, entries, {
        [draft.subject]: draft.after,
      }).filter((element) => element.id === draft.subject);
      const [change] = diffSnapshots(base, next, draft.sourceRevisionId);
      if (!change) throw new Error(`Sin cambio para ${draft.subject}`);
      const impact = analyzeChange(
        {
          id: `change-${draft.subject}`,
          elementId: change.element.id,
          elementName: change.element.name,
          category: change.element.category,
          changedKeys: change.diffs.map((diff) => diff.key),
          before: change.before,
          after: change.after,
        },
        LOS_AROMOS.graph,
      );
      const { proposal } = await open.execute({
        draft,
        changeId: impact.changeId,
        reviewerIds: [
          ...new Set(impact.findings.map((finding) => finding.stakeholderId)),
        ],
        filtered: impact.filtered.map((item) => ({
          id: item.stakeholderId,
          reason: item.reason,
        })),
      });
      opened.push({ proposal, impact });
    }

    const slab = opened.find((item) => item.proposal.subject === 'losa-n3');
    const windows = opened.find(
      (item) => item.proposal.subject === 'ventanas-norte',
    );
    expect(slab?.impact.costDelta).toBe(3_636_500);
    expect(slab?.impact.delayDays).toBe(1);
    expect(
      slab?.proposal.reviews.map((item) => item.reviewerId).sort(),
    ).toEqual([
      'daniela-soto',
      'javier-munoz',
      'marcos-fuentes',
      'paula-rojas',
    ]);
    expect(windows?.impact.costDelta).toBe(1_998_000);
    expect(windows?.impact.delayDays).toBe(0);
    expect(
      windows?.proposal.reviews.map((item) => item.reviewerId).sort(),
    ).toEqual([
      'daniela-soto',
      'paula-rojas',
      'tomas-reyes',
      'ventanas-quillay',
    ]);
    expect(windows?.proposal.filtered.map((item) => item.id)).toEqual([
      'marcos-fuentes',
    ]);
  });
});

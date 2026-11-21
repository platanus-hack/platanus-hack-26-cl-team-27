import { Icon } from '@/components/common/Icon';
import { formatValue } from '@/lib/format';
import type { ProposalDiff } from '@/lib/proposals-api';

export function FactDiff({
  diffs,
  large = false,
}: {
  readonly diffs: readonly ProposalDiff[];
  readonly large?: boolean;
}) {
  return (
    <ul className="flex flex-col gap-2">
      {diffs.map((diff) => (
        <li
          key={diff.label}
          className={`flex flex-wrap items-center gap-x-3 gap-y-1 ${large ? 'text-xl' : 'text-sm'}`}
        >
          <span className="text-ink-2">{diff.label}</span>
          <span className="font-semibold tabular-nums text-ink">
            {diff.before === null
              ? 'Sin dato'
              : formatValue(diff.before, diff.unit)}
          </span>
          <Icon name="arrow" className="text-ink-3" />
          <span className="font-semibold tabular-nums text-ink">
            {diff.after === null
              ? 'Se elimina'
              : formatValue(diff.after, diff.unit)}
          </span>
        </li>
      ))}
    </ul>
  );
}

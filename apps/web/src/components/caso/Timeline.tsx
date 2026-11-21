import { cx } from '@team27/ui';

import { Icon, type IconName } from '@/components/common/Icon';
import type { StepState, TimelineStep } from '@/lib/case-view';

const MARK: Record<StepState, { icon: IconName; tone: string }> = {
  done: { icon: 'check', tone: 'text-good' },
  current: { icon: 'hourglass', tone: 'text-warning' },
  pending: { icon: 'dot', tone: 'text-ink-3' },
  problem: { icon: 'alert', tone: 'text-critical' },
};

export function Timeline({
  steps,
}: {
  readonly steps: readonly TimelineStep[];
}) {
  return (
    <ol aria-label="Línea de tiempo" className="flex flex-col gap-3">
      {steps.map((step) => (
        <li key={step.id} className="flex items-start gap-3">
          <span
            className={cx(
              'mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-surface-2',
              MARK[step.state].tone,
            )}
          >
            <Icon name={MARK[step.state].icon} className="size-4" />
          </span>
          <span
            className={cx(
              'text-base',
              step.state === 'pending' ? 'text-ink-3' : 'text-ink',
              step.state === 'current' && 'font-medium',
            )}
          >
            {step.label}
          </span>
        </li>
      ))}
    </ol>
  );
}

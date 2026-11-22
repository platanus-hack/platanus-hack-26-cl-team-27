import type { CostLine, Impact, TaskImpact } from './Impact.ts';
import type { Task } from './ProjectGraph.ts';
import { criticalPath } from './schedule.ts';

export interface CombinedImpact {
  readonly changeIds: readonly string[];
  readonly costDelta: number;
  readonly delayDays: number;
  readonly projectDaysBefore: number;
  readonly projectDaysAfter: number;
  readonly costLines: readonly CostLine[];
  readonly tasks: readonly TaskImpact[];
}

const round = (value: number): number => Math.round(value * 100) / 100;

const mergeCostLines = (impacts: readonly Impact[]): CostLine[] => {
  const byCode = new Map<string, CostLine>();
  for (const line of impacts.flatMap((impact) => impact.costLines)) {
    const previous = byCode.get(line.code);
    byCode.set(
      line.code,
      previous
        ? {
            ...previous,
            before: round(previous.before + line.before),
            after: round(previous.after + line.after),
            delta: previous.delta + line.delta,
          }
        : line,
    );
  }
  return [...byCode.values()].filter((line) => line.delta !== 0);
};

interface Stretch {
  readonly name: string;
  readonly daysBefore: number;
  readonly extraDays: number;
}

const mergeStretches = (impacts: readonly Impact[]): Map<string, Stretch> => {
  const byId = new Map<string, Stretch>();
  for (const task of impacts.flatMap((impact) => impact.tasks)) {
    const previous = byId.get(task.id);
    byId.set(task.id, {
      name: task.name,
      daysBefore: previous?.daysBefore ?? task.daysBefore,
      extraDays:
        (previous?.extraDays ?? 0) + (task.daysAfter - task.daysBefore),
    });
  }
  return byId;
};

export const combineImpacts = (
  impacts: readonly Impact[],
  tasks: readonly Task[],
): CombinedImpact => {
  const unique = [
    ...new Map(impacts.map((impact) => [impact.changeId, impact])).values(),
  ];
  const costLines = mergeCostLines(unique);
  const stretches = mergeStretches(unique);
  const planned = tasks.map((task) => {
    const stretch = stretches.get(task.id);
    const daysBefore = stretch?.daysBefore ?? task.days;
    return {
      id: task.id,
      name: task.name,
      predecessors: task.predecessors,
      daysBefore,
      daysAfter: Math.max(1, daysBefore + (stretch?.extraDays ?? 0)),
    };
  });
  const before = criticalPath(
    planned.map((task) => ({ ...task, days: task.daysBefore })),
  );
  const after = criticalPath(
    planned.map((task) => ({ ...task, days: task.daysAfter })),
  );
  return {
    changeIds: unique.map((impact) => impact.changeId),
    costDelta: unique.reduce((total, impact) => total + impact.costDelta, 0),
    delayDays: after.projectDays - before.projectDays,
    projectDaysBefore: before.projectDays,
    projectDaysAfter: after.projectDays,
    costLines,
    tasks: planned
      .filter((task) => task.daysBefore !== task.daysAfter)
      .map((task) => {
        const timing = before.timings.get(task.id);
        return {
          id: task.id,
          name: task.name,
          daysBefore: task.daysBefore,
          daysAfter: task.daysAfter,
          floatDays: timing?.floatDays ?? 0,
          critical: timing?.critical ?? false,
        };
      }),
  };
};

import type { ChangeUnderAnalysis } from './analyzeChange.ts';
import type { ProjectGraph } from './ProjectGraph.ts';
import { type Properties, quantityOf } from './quantities.ts';

export interface RuleCoverage {
  readonly key: string;
  readonly cost: boolean;
  readonly schedule: boolean;
}

const swapped = (base: Properties, key: string, other: Properties) => {
  const { [key]: dropped, ...rest } = base;
  void dropped;
  const value = other[key];
  return value === undefined ? rest : { ...rest, [key]: value };
};

const moves = (
  change: ChangeUnderAnalysis,
  key: string,
  quantity: string,
): boolean =>
  quantityOf(change.category, quantity, change.before) !==
    quantityOf(
      change.category,
      quantity,
      swapped(change.before, key, change.after),
    ) ||
  quantityOf(change.category, quantity, change.after) !==
    quantityOf(
      change.category,
      quantity,
      swapped(change.after, key, change.before),
    );

export const ruleCoverage = (
  change: ChangeUnderAnalysis,
  graph: ProjectGraph,
): RuleCoverage[] => {
  const costQuantities = graph.budgetItems
    .filter((item) => item.category === change.category)
    .map((item) => item.quantity);
  const scheduleQuantities = graph.tasks.flatMap((task) =>
    task.driver?.elementId === change.elementId ? [task.driver.quantity] : [],
  );
  return change.changedKeys.map((key) => ({
    key,
    cost: costQuantities.some((quantity) => moves(change, key, quantity)),
    schedule: scheduleQuantities.some((quantity) =>
      moves(change, key, quantity),
    ),
  }));
};

export const ruleGapMessage = (
  coverage: RuleCoverage,
  label: string,
): string | null => {
  if (coverage.cost && coverage.schedule) return null;
  if (!coverage.cost && !coverage.schedule) {
    return `No hay reglas de costo ni de plazo para ${label}.`;
  }
  return coverage.cost
    ? `No hay reglas de plazo para ${label}.`
    : `No hay reglas de costo para ${label}.`;
};

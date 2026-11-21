import {
  formatDays,
  formatMoney,
  formatNumber,
  formatSignedMoney,
  formatSignedNumber,
} from './format.ts';
import type {
  CostLine,
  Filtered,
  Finding,
  Impact,
  TaskImpact,
} from './Impact.ts';
import type { ProjectGraph, Task } from './ProjectGraph.ts';
import {
  type Properties,
  quantityDefinition,
  quantityOf,
} from './quantities.ts';
import { criticalPath } from './schedule.ts';

export interface ChangeUnderAnalysis {
  readonly id: string;
  readonly elementId: string;
  readonly elementName: string;
  readonly category: string;
  readonly changedKeys: readonly string[];
  readonly before: Properties;
  readonly after: Properties;
}

const round = (value: number): number => Math.round(value * 100) / 100;

const fill = (template: string, change: ChangeUnderAnalysis): string =>
  template.replaceAll(
    '{elemento}',
    change.elementName.charAt(0).toLowerCase() + change.elementName.slice(1),
  );

const measureLine = (
  change: ChangeUnderAnalysis,
  key: string,
): string | null => {
  const definition = quantityDefinition(change.category, key);
  if (!definition) return null;
  const before = round(definition.compute(change.before));
  const after = round(definition.compute(change.after));
  if (before === after) return null;
  return `${definition.label}: ${formatNumber(before)} → ${formatNumber(after)} ${definition.unit} (${formatSignedNumber(round(after - before))})`;
};

const dependencyFindings = (
  change: ChangeUnderAnalysis,
  graph: ProjectGraph,
): Finding[] =>
  graph.dependencies
    .filter(
      (dependency) =>
        dependency.category === change.category &&
        dependency.watches.some((key) => change.changedKeys.includes(key)),
    )
    .map((dependency) => ({
      stakeholderId: dependency.stakeholderId,
      topic: 'dependency',
      summary: fill(dependency.summary, change),
      details: dependency.measures.flatMap(
        (key) => measureLine(change, key) ?? [],
      ),
      action: fill(dependency.action, change),
    }));

const costLinesOf = (
  change: ChangeUnderAnalysis,
  graph: ProjectGraph,
): CostLine[] =>
  graph.budgetItems
    .filter((item) => item.category === change.category)
    .map((item) => {
      const before = round(
        quantityOf(change.category, item.quantity, change.before) * item.factor,
      );
      const after = round(
        quantityOf(change.category, item.quantity, change.after) * item.factor,
      );
      return {
        code: item.code,
        name: item.name,
        unit: item.unit,
        unitPrice: item.unitPrice,
        before,
        after,
        delta: Math.round((after - before) * item.unitPrice),
      };
    })
    .filter((line) => line.delta !== 0);

const costFinding = (
  graph: ProjectGraph,
  lines: readonly CostLine[],
  costDelta: number,
): Finding => ({
  stakeholderId: graph.costOwnerId,
  topic: 'cost',
  summary: `El presupuesto ${costDelta > 0 ? 'sube' : 'baja'} ${formatMoney(Math.abs(costDelta))}`,
  details: lines.map(
    (line) =>
      `${line.code} ${line.name}: ${formatNumber(line.before)} → ${formatNumber(line.after)} ${line.unit} × ${formatMoney(line.unitPrice)} = ${formatSignedMoney(line.delta)}`,
  ),
  action:
    costDelta > 0
      ? 'Actualiza el presupuesto y prepara el aumento de obra para el mandante.'
      : 'Actualiza el presupuesto y registra la disminución de obra.',
});

const durationOf = (
  task: Task,
  category: string,
  properties: Properties,
): number => {
  if (!task.driver) return task.days;
  const quantity = quantityOf(category, task.driver.quantity, properties);
  return Math.max(1, Math.ceil(round(quantity / task.driver.productivity)));
};

interface ScheduleImpact {
  readonly projectDaysBefore: number;
  readonly projectDaysAfter: number;
  readonly tasks: readonly TaskImpact[];
}

const scheduleImpactOf = (
  change: ChangeUnderAnalysis,
  graph: ProjectGraph,
): ScheduleImpact => {
  const driven = new Set(
    graph.tasks
      .filter((task) => task.driver?.elementId === change.elementId)
      .map((task) => task.id),
  );
  const plan = (properties: Properties) =>
    graph.tasks.map((task) => ({
      id: task.id,
      predecessors: task.predecessors,
      days: driven.has(task.id)
        ? durationOf(task, change.category, properties)
        : task.days,
    }));
  const before = plan(change.before);
  const after = plan(change.after);
  const beforeSchedule = criticalPath(before);
  const afterSchedule = criticalPath(after);

  const tasks = graph.tasks.flatMap((task, index): TaskImpact[] => {
    const daysBefore = before[index]?.days ?? task.days;
    const daysAfter = after[index]?.days ?? task.days;
    if (daysBefore === daysAfter) return [];
    const timing = beforeSchedule.timings.get(task.id);
    return [
      {
        id: task.id,
        name: task.name,
        daysBefore,
        daysAfter,
        floatDays: timing?.floatDays ?? 0,
        critical: timing?.critical ?? false,
      },
    ];
  });

  return {
    projectDaysBefore: beforeSchedule.projectDays,
    projectDaysAfter: afterSchedule.projectDays,
    tasks,
  };
};

const taskLine = (task: TaskImpact): string =>
  `${task.name}: ${formatDays(task.daysBefore)} → ${formatDays(task.daysAfter)}, ${
    task.critical
      ? 'en la ruta crítica'
      : `con ${formatDays(task.floatDays)} de holgura`
  }`;

const scheduleOutcome = (
  graph: ProjectGraph,
  schedule: ScheduleImpact,
  delayDays: number,
): { finding: Finding | null; filtered: Filtered | null } => {
  if (schedule.tasks.length === 0) return { finding: null, filtered: null };
  if (delayDays === 0) {
    return {
      finding: null,
      filtered: {
        stakeholderId: graph.scheduleOwnerId,
        reason: `${schedule.tasks.map(taskLine).join('; ')}: la holgura lo absorbe y la entrega no se mueve.`,
      },
    };
  }
  return {
    filtered: null,
    finding: {
      stakeholderId: graph.scheduleOwnerId,
      topic: 'schedule',
      summary:
        delayDays > 0
          ? `La entrega se corre ${formatDays(delayDays)}`
          : `La entrega se adelanta ${formatDays(-delayDays)}`,
      details: [
        ...schedule.tasks.map(taskLine),
        `Plazo total: ${formatDays(schedule.projectDaysBefore)} → ${formatDays(schedule.projectDaysAfter)}`,
      ],
      action:
        delayDays > 0
          ? 'Reprograma las faenas que siguen y confirma la nueva fecha de entrega.'
          : 'Revisa si conviene adelantar las faenas que siguen.',
    },
  };
};

export const analyzeChange = (
  change: ChangeUnderAnalysis,
  graph: ProjectGraph,
): Impact => {
  const costLines = costLinesOf(change, graph);
  const costDelta = costLines.reduce((total, line) => total + line.delta, 0);
  const schedule = scheduleImpactOf(change, graph);
  const delayDays = schedule.projectDaysAfter - schedule.projectDaysBefore;
  const outcome = scheduleOutcome(graph, schedule, delayDays);

  return {
    changeId: change.id,
    costDelta,
    delayDays,
    projectDaysBefore: schedule.projectDaysBefore,
    projectDaysAfter: schedule.projectDaysAfter,
    costLines,
    tasks: schedule.tasks,
    findings: [
      ...dependencyFindings(change, graph),
      ...(costDelta !== 0 ? [costFinding(graph, costLines, costDelta)] : []),
      ...(outcome.finding ? [outcome.finding] : []),
    ],
    filtered: outcome.filtered ? [outcome.filtered] : [],
  };
};

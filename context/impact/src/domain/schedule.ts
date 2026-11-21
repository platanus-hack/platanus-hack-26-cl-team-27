export interface PlannedTask {
  readonly id: string;
  readonly days: number;
  readonly predecessors: readonly string[];
}

export interface TaskTiming {
  readonly earlyStart: number;
  readonly earlyFinish: number;
  readonly floatDays: number;
  readonly critical: boolean;
}

export interface Schedule {
  readonly projectDays: number;
  readonly timings: ReadonlyMap<string, TaskTiming>;
}

export const criticalPath = (tasks: readonly PlannedTask[]): Schedule => {
  const byId = new Map(tasks.map((task) => [task.id, task]));
  const earlyFinish = new Map<string, number>();

  const finishOf = (id: string, visiting: Set<string>): number => {
    const known = earlyFinish.get(id);
    if (known !== undefined) return known;
    const task = byId.get(id);
    if (!task) return 0;
    if (visiting.has(id)) {
      throw new Error(`La tarea ${id} depende de sí misma`);
    }
    visiting.add(id);
    const start = Math.max(
      0,
      ...task.predecessors.map((predecessor) =>
        finishOf(predecessor, visiting),
      ),
    );
    visiting.delete(id);
    const finish = start + task.days;
    earlyFinish.set(id, finish);
    return finish;
  };

  for (const task of tasks) finishOf(task.id, new Set());
  const projectDays = Math.max(0, ...earlyFinish.values());

  const successors = new Map<string, string[]>();
  for (const task of tasks) {
    for (const predecessor of task.predecessors) {
      successors.set(predecessor, [
        ...(successors.get(predecessor) ?? []),
        task.id,
      ]);
    }
  }

  const lateFinish = new Map<string, number>();
  const lateFinishOf = (id: string): number => {
    const known = lateFinish.get(id);
    if (known !== undefined) return known;
    const next = successors.get(id) ?? [];
    const finish =
      next.length === 0
        ? projectDays
        : Math.min(
            ...next.map(
              (successor) =>
                lateFinishOf(successor) - (byId.get(successor)?.days ?? 0),
            ),
          );
    lateFinish.set(id, finish);
    return finish;
  };

  const timings = new Map<string, TaskTiming>();
  for (const task of tasks) {
    const finish = earlyFinish.get(task.id) ?? 0;
    const floatDays = lateFinishOf(task.id) - finish;
    timings.set(task.id, {
      earlyStart: finish - task.days,
      earlyFinish: finish,
      floatDays,
      critical: floatDays === 0,
    });
  }
  return { projectDays, timings };
};

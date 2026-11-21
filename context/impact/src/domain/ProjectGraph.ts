export interface BudgetItem {
  readonly code: string;
  readonly name: string;
  readonly unit: string;
  readonly unitPrice: number;
  readonly category: string;
  readonly quantity: string;
  readonly factor: number;
}

export interface TaskDriver {
  readonly elementId: string;
  readonly quantity: string;
  readonly productivity: number;
}

export interface Task {
  readonly id: string;
  readonly name: string;
  readonly days: number;
  readonly predecessors: readonly string[];
  readonly driver: TaskDriver | null;
}

export interface Dependency {
  readonly category: string;
  readonly watches: readonly string[];
  readonly stakeholderId: string;
  readonly summary: string;
  readonly action: string;
  readonly measures: readonly string[];
}

export interface ProjectGraph {
  readonly costOwnerId: string;
  readonly scheduleOwnerId: string;
  readonly budgetItems: readonly BudgetItem[];
  readonly tasks: readonly Task[];
  readonly dependencies: readonly Dependency[];
}

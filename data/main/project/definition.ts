export interface ProjectMemberDef {
  readonly id: string;
  readonly name: string;
  readonly role: string;
  readonly channel: string;
  readonly handle: string;
}

export interface ProjectSpaceDef {
  readonly id: string;
  readonly name: string;
  readonly kind: string;
  readonly ownerId: string;
}

export interface ProjectDocumentDef {
  readonly id: string;
  readonly name: string;
  readonly kind: string;
  readonly spaceId: string;
  readonly ownerId: string;
}

export interface ProjectAttributeDef {
  readonly key: string;
  readonly label: string;
}

export interface SubjectAttributeDef {
  readonly key: string;
  readonly unit: string | null;
}

export type FootprintCells =
  | { readonly kind: 'all' }
  | { readonly kind: 'axis'; readonly axis: number }
  | {
      readonly kind: 'position';
      readonly attribute: string;
      readonly axis: number;
    };

export interface SpatialRule {
  readonly kind: 'soporte' | 'ocupante';
  readonly levels: readonly string[];
  readonly cells: FootprintCells;
  readonly systems: readonly string[];
}

export interface ProjectSubjectDef {
  readonly id: string;
  readonly name: string;
  readonly section: string;
  readonly category: string;
  readonly attributes: readonly SubjectAttributeDef[];
  readonly spatial: SpatialRule | null;
}

export interface ModelPropertyDef {
  readonly key: string;
  readonly label: string;
  readonly value: number | string;
  readonly unit: string | null;
  readonly editable: boolean;
}

export interface ModelElementDef {
  readonly id: string;
  readonly name: string;
  readonly category: string;
  readonly level: number | null;
  readonly properties: readonly ModelPropertyDef[];
}

export interface BudgetItemDef {
  readonly code: string;
  readonly name: string;
  readonly unit: string;
  readonly unitPrice: number;
  readonly category: string;
  readonly quantity: string;
  readonly factor: number;
}

export interface TaskDriverDef {
  readonly elementId: string;
  readonly quantity: string;
  readonly productivity: number;
}

export interface ScheduleTaskDef {
  readonly id: string;
  readonly name: string;
  readonly days: number;
  readonly predecessors: readonly string[];
  readonly driver: TaskDriverDef | null;
}

export interface DependencyDef {
  readonly category: string;
  readonly watches: readonly string[];
  readonly stakeholderId: string;
  readonly summary: string;
  readonly action: string;
  readonly measures: readonly string[];
}

export interface LevelDef {
  readonly id: string;
  readonly label: string;
  readonly short: string;
}

export interface AxisDef {
  readonly id: string;
  readonly meters: number;
}

export interface SystemDef {
  readonly id: string;
  readonly label: string;
  readonly occupiesSpace: boolean;
}

export interface OrganizationDef {
  readonly id: string;
  readonly name: string;
}

export interface ProjectDefinition {
  readonly id: string;
  readonly organizationId: string;
  readonly name: string;
  readonly location: string;
  readonly description: string;
  readonly authorId: string;
  readonly costOwnerId: string;
  readonly scheduleOwnerId: string;
  readonly modelDocumentId: string | null;
  readonly members: readonly ProjectMemberDef[];
  readonly spaces: readonly ProjectSpaceDef[];
  readonly documents: readonly ProjectDocumentDef[];
  readonly attributes: readonly ProjectAttributeDef[];
  readonly subjects: readonly ProjectSubjectDef[];
  readonly elements: readonly ModelElementDef[];
  readonly budgetItems: readonly BudgetItemDef[];
  readonly tasks: readonly ScheduleTaskDef[];
  readonly dependencies: readonly DependencyDef[];
  readonly levels: readonly LevelDef[];
  readonly longitudinalAxes: readonly AxisDef[];
  readonly transversalAxes: readonly number[];
  readonly systems: readonly SystemDef[];
}

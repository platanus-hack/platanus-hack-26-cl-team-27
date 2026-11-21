import type { PropertyValue } from './ModelElement.ts';

export type ChangeKind = 'added' | 'modified' | 'removed';

export interface PropertyDiff {
  readonly key: string;
  readonly label: string;
  readonly unit: string | null;
  readonly before: PropertyValue | null;
  readonly after: PropertyValue | null;
}

export interface ChangedElement {
  readonly id: string;
  readonly name: string;
  readonly category: string;
}

export interface ChangeDraft {
  readonly sourceId: string;
  readonly element: ChangedElement;
  readonly kind: ChangeKind;
  readonly summary: string;
  readonly diffs: readonly PropertyDiff[];
  readonly before: Readonly<Record<string, PropertyValue>>;
  readonly after: Readonly<Record<string, PropertyValue>>;
}

export interface Change extends ChangeDraft {
  readonly id: string;
  readonly detectedAt: Date;
}

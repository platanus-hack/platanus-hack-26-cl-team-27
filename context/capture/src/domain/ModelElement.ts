export type PropertyValue = number | string;

export interface ModelProperty {
  readonly key: string;
  readonly label: string;
  readonly value: PropertyValue;
  readonly unit: string | null;
  readonly editable: boolean;
}

export interface ModelElement {
  readonly id: string;
  readonly name: string;
  readonly category: string;
  readonly level: number | null;
  readonly properties: readonly ModelProperty[];
}

export interface Snapshot {
  readonly integrationId: string;
  readonly version: number;
  readonly publishedAt: Date;
  readonly elements: readonly ModelElement[];
}

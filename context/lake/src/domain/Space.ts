export type SpaceKind =
  | 'drive'
  | 'sharepoint'
  | 'email'
  | 'whatsapp'
  | 'libro_obra';

export interface Space {
  readonly id: string;
  readonly name: string;
  readonly kind: SpaceKind;
  readonly ownerId: string;
}

import { request } from './http';
import type { FactValue } from './format';

export type ValueStatus = 'confirmed' | 'proposed' | 'disputed';

export type BaselineSectionId =
  | 'estructura'
  | 'instalaciones'
  | 'fachada'
  | 'costos'
  | 'plazo';

export interface BaselineEntry {
  readonly section: BaselineSectionId;
  readonly subjectId: string;
  readonly subjectName: string;
  readonly attribute: string;
  readonly label: string;
  readonly value: FactValue;
  readonly unit: string | null;
  readonly status: ValueStatus;
  readonly proposedValue: FactValue | null;
  readonly proposalId: string | null;
  readonly sources: number;
  readonly staleCount: number;
  readonly since: string;
}

export interface BaselineTotals {
  readonly costTotal: number;
  readonly costDelta: number;
  readonly projectDays: number;
  readonly delayDays: number;
}

export interface BaselineResponse {
  readonly version: number;
  readonly totals: BaselineTotals;
  readonly entries: readonly BaselineEntry[];
}

export const SECTION_ORDER: readonly BaselineSectionId[] = [
  'estructura',
  'instalaciones',
  'fachada',
  'costos',
  'plazo',
];

export const SECTION_LABEL: Record<BaselineSectionId, string> = {
  estructura: 'Estructura',
  instalaciones: 'Instalaciones',
  fachada: 'Fachada',
  costos: 'Costos',
  plazo: 'Plazo',
};

export const getBaseline = (
  section?: BaselineSectionId,
  signal?: AbortSignal,
): Promise<BaselineResponse> =>
  request<BaselineResponse>(
    `/api/baseline${section ? `?section=${section}` : ''}`,
    { signal },
  );

export const groupBySection = (
  entries: readonly BaselineEntry[],
): { id: BaselineSectionId; label: string; entries: BaselineEntry[] }[] =>
  SECTION_ORDER.map((id) => ({
    id,
    label: SECTION_LABEL[id],
    entries: entries.filter((entry) => entry.section === id),
  })).filter((group) => group.entries.length > 0);

import type {
  BaselineEntry,
  BaselineHistoryItem,
} from '../../domain/Baseline.ts';

export interface BaselineRepository {
  list(): Promise<BaselineEntry[]>;
  find(subject: string, attribute: string): Promise<BaselineEntry | null>;
  upsert(entry: BaselineEntry): Promise<void>;
  history(subject: string, attribute: string): Promise<BaselineHistoryItem[]>;
  clear(): Promise<void>;
}

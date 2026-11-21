import type { Revision, RevisionDraft } from '../../domain/Revision.ts';

export interface RevisionRepository {
  save(draft: RevisionDraft): Promise<Revision>;
  findByKey(documentId: string, label: string): Promise<Revision | null>;
  findById(id: string): Promise<Revision | null>;
  list(): Promise<Revision[]>;
  clear(): Promise<void>;
  deleteByDocuments(documentIds: readonly string[]): Promise<void>;
}

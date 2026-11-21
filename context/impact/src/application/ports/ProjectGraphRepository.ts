import type { ProjectGraph } from '../../domain/ProjectGraph.ts';

export interface ProjectGraphRepository {
  load(): Promise<ProjectGraph>;
}

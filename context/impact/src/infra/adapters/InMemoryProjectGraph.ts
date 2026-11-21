import type { ProjectGraphRepository } from '../../application/ports/ProjectGraphRepository.ts';
import type { ProjectGraph } from '../../domain/ProjectGraph.ts';

export class InMemoryProjectGraph implements ProjectGraphRepository {
  private readonly graph: ProjectGraph;

  constructor(graph: ProjectGraph) {
    this.graph = graph;
  }

  load(): Promise<ProjectGraph> {
    return Promise.resolve(this.graph);
  }
}

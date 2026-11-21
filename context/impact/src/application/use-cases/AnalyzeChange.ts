import {
  analyzeChange,
  type ChangeUnderAnalysis,
} from '../../domain/analyzeChange.ts';
import type { Impact } from '../../domain/Impact.ts';
import type { ImpactRepository } from '../ports/ImpactRepository.ts';
import type { ProjectGraphRepository } from '../ports/ProjectGraphRepository.ts';

export class AnalyzeChange {
  private readonly graph: ProjectGraphRepository;
  private readonly impacts: ImpactRepository;

  constructor(graph: ProjectGraphRepository, impacts: ImpactRepository) {
    this.graph = graph;
    this.impacts = impacts;
  }

  async execute(change: ChangeUnderAnalysis): Promise<Impact> {
    const impact = analyzeChange(change, await this.graph.load());
    await this.impacts.save(impact);
    return impact;
  }
}

import { createHash } from 'node:crypto';

import { type ProjectGraph, quantityOf } from '@team27/context-impact';
import type {
  AreaCell,
  ClaimValue,
  DocumentKind,
  Footprint,
  FootprintModel,
  ModelElement,
  RevisionDraft,
  Space,
  SpatialKind,
} from '@team27/context-lake';
import type { Stakeholder } from '@team27/context-notification';
import type {
  AxisDef,
  LevelDef,
  ProjectAttributeDef,
  ProjectSubjectDef,
  SpatialRule,
  SubjectAttributeDef,
  SystemDef,
} from '@team27/data-main';

import type { ValidProject } from './project-schema.ts';

export type CastMember = Stakeholder;

export interface DocumentDef {
  readonly id: string;
  readonly name: string;
  readonly kind: DocumentKind;
  readonly spaceId: string;
  readonly ownerId: string;
}

export interface ProjectInfo {
  readonly name: string;
  readonly location: string;
  readonly description: string;
}

const hashOf = (pointer: string): string =>
  createHash('sha256').update(pointer).digest('hex');

const byId = <T extends { readonly id: string }>(
  items: readonly T[],
): ReadonlyMap<string, T> => new Map(items.map((item) => [item.id, item]));

export class ProjectCatalog {
  readonly id: string;
  readonly info: ProjectInfo;
  readonly author: CastMember;
  readonly cast: readonly CastMember[];
  readonly stakeholders: readonly CastMember[];
  readonly model: readonly ModelElement[];
  readonly graph: ProjectGraph;
  readonly spaces: readonly Space[];
  readonly documents: readonly DocumentDef[];
  readonly subjects: readonly ProjectSubjectDef[];
  readonly attributes: readonly ProjectAttributeDef[];
  readonly modelDocumentId: string | null;
  readonly levels: readonly LevelDef[];
  readonly longitudinalAxes: readonly AxisDef[];
  readonly transversalAxes: readonly number[];
  readonly systems: readonly SystemDef[];
  readonly spans: readonly string[];
  readonly allCells: readonly string[];
  readonly baseCost: number;

  private readonly castById: ReadonlyMap<string, CastMember>;
  private readonly spaceById: ReadonlyMap<string, Space>;
  private readonly documentById: ReadonlyMap<string, DocumentDef>;
  private readonly subjectById: ReadonlyMap<string, ProjectSubjectDef>;
  private readonly subjectOrder: ReadonlyMap<string, number>;
  private readonly attributeByKey: ReadonlyMap<string, ProjectAttributeDef>;

  constructor(project: ValidProject) {
    this.id = project.id;
    this.info = {
      name: project.name,
      location: project.location,
      description: project.description,
    };
    this.cast = project.members;
    this.castById = byId(project.members);
    const author = this.castById.get(project.authorId);
    if (!author) {
      throw new Error(
        `El proyecto ${project.id} no tiene a su autor ${project.authorId} en el elenco`,
      );
    }
    this.author = author;
    this.stakeholders = project.members.filter(
      (member) => member.id !== project.authorId,
    );
    this.model = project.elements;
    this.graph = {
      costOwnerId: project.costOwnerId,
      scheduleOwnerId: project.scheduleOwnerId,
      budgetItems: project.budgetItems,
      tasks: project.tasks,
      dependencies: project.dependencies,
    };
    this.spaces = project.spaces;
    this.spaceById = byId(project.spaces);
    this.documents = project.documents;
    this.documentById = byId(project.documents);
    this.subjects = project.subjects;
    this.subjectById = byId(project.subjects);
    this.subjectOrder = new Map(
      project.subjects.map((subject, index) => [subject.id, index]),
    );
    this.attributes = project.attributes;
    this.attributeByKey = new Map(
      project.attributes.map((attribute) => [attribute.key, attribute]),
    );
    this.modelDocumentId = project.modelDocumentId;
    this.levels = project.levels;
    this.longitudinalAxes = project.longitudinalAxes;
    this.transversalAxes = project.transversalAxes;
    this.systems = project.systems;
    this.spans = project.longitudinalAxes
      .slice(0, -1)
      .map(
        (axis, index) =>
          `${axis.id}-${project.longitudinalAxes[index + 1]?.id ?? ''}`,
      );
    this.allCells = project.transversalAxes.flatMap((axis) =>
      this.cellsOfAxis(axis),
    );
    this.baseCost = this.computeBaseCost();
  }

  castMember(id: string): CastMember | undefined {
    return this.castById.get(id);
  }

  castName(id: string): string {
    return this.castById.get(id)?.name ?? id;
  }

  spaceOf(id: string): Space | null {
    return this.spaceById.get(id) ?? null;
  }

  spaceName(id: string): string {
    return this.spaceOf(id)?.name ?? id;
  }

  documentDef(id: string): DocumentDef | null {
    return this.documentById.get(id) ?? null;
  }

  documentOf(id: string): DocumentDef {
    const found = this.documentById.get(id);
    if (!found) throw new Error(`El catálogo no tiene el documento ${id}`);
    return found;
  }

  hasSubject(id: string): boolean {
    return this.subjectById.has(id);
  }

  hasAttribute(key: string): boolean {
    return this.attributeByKey.has(key);
  }

  subjectName(id: string): string {
    return this.subjectById.get(id)?.name ?? id;
  }

  sectionOf(id: string): string {
    return this.subjectById.get(id)?.section ?? 'costos';
  }

  subjectIndex(id: string): number {
    return this.subjectOrder.get(id) ?? -1;
  }

  subjectAttributes(id: string): readonly SubjectAttributeDef[] {
    return this.subjectById.get(id)?.attributes ?? [];
  }

  categoryOf(id: string): string {
    return this.subjectById.get(id)?.category ?? 'proyecto';
  }

  attributeLabel(key: string): string {
    return this.attributeByKey.get(key)?.label ?? key;
  }

  factLabel(subject: string, attribute: string): string {
    return `${this.subjectName(subject)} · ${this.attributeLabel(attribute)}`;
  }

  toRevisionDraft(
    documentId: string,
    label: string,
    authorId: string,
    spaceId: string,
    pointer: string,
    contentHash?: string,
  ): RevisionDraft {
    const document = this.documentOf(documentId);
    return {
      documentId,
      documentName: document.name,
      label,
      kind: document.kind,
      spaceId,
      authorId,
      contentHash: contentHash ?? hashOf(pointer),
      sourcePointer: pointer,
    };
  }

  spanOf(meters: unknown): string | null {
    if (typeof meters !== 'number' || !Number.isFinite(meters)) return null;
    const axes = this.longitudinalAxes;
    const first = axes[0]?.meters ?? 0;
    const last = axes[axes.length - 1]?.meters ?? 0;
    if (meters < first || meters > last) return null;
    const index = axes.findIndex(
      (axis, position) =>
        position < axes.length - 1 &&
        meters >= axis.meters &&
        meters < (axes[position + 1]?.meters ?? Number.POSITIVE_INFINITY),
    );
    return this.spans[index === -1 ? this.spans.length - 1 : index] ?? null;
  }

  cellsOfAxis(axis: number): string[] {
    return this.spans.map((span) => `${span}/${axis}`);
  }

  spatialKindOf(subject: string): SpatialKind {
    return this.subjectById.get(subject)?.spatial?.kind ?? 'ninguno';
  }

  readonly footprintModel: FootprintModel = (subject, values): Footprint => {
    const rule = this.subjectById.get(subject)?.spatial;
    return rule
      ? { kind: rule.kind, areas: this.areasOf(rule, values) }
      : { kind: 'ninguno', areas: [] };
  };

  levelLabel(id: string): string {
    return this.levels.find((level) => level.id === id)?.short ?? id;
  }

  systemLabel(id: string): string {
    return this.systems.find((system) => system.id === id)?.label ?? id;
  }

  areaLabel(area: AreaCell): string {
    return `${this.levelLabel(area.nivel)} · ${area.celda} · ${area.sistemas.map((system) => this.systemLabel(system)).join(' y ')}`;
  }

  private areasOf(
    rule: SpatialRule,
    values: Readonly<Record<string, ClaimValue>>,
  ): AreaCell[] {
    const cells = this.cellsOf(rule, values);
    return rule.levels.flatMap((nivel) =>
      cells.map((celda) => ({ nivel, celda, sistemas: rule.systems })),
    );
  }

  private cellsOf(
    rule: SpatialRule,
    values: Readonly<Record<string, ClaimValue>>,
  ): readonly string[] {
    const { cells } = rule;
    if (cells.kind === 'all') return this.allCells;
    if (cells.kind === 'axis') return this.cellsOfAxis(cells.axis);
    const span = this.spanOf(values[cells.attribute]);
    return span ? [`${span}/${cells.axis}`] : [];
  }

  private computeBaseCost(): number {
    return Math.round(
      this.graph.budgetItems.reduce(
        (total, item) =>
          total +
          this.model
            .filter((element) => element.category === item.category)
            .reduce((sum, element) => {
              const properties = Object.fromEntries(
                element.properties.map((property) => [
                  property.key,
                  property.value,
                ]),
              );
              return (
                sum +
                quantityOf(item.category, item.quantity, properties) *
                  item.factor *
                  item.unitPrice
              );
            }, 0),
        0,
      ),
    );
  }
}

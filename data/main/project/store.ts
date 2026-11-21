import type { Prisma, PrismaClient } from '../generated/prisma/client.ts';
import type {
  AxisDef,
  ModelPropertyDef,
  ProjectDefinition,
  SpatialRule,
  SubjectAttributeDef,
  TaskDriverDef,
} from './definition.ts';

const json = (value: unknown): Prisma.InputJsonValue =>
  value as Prisma.InputJsonValue;

const ordered = { orderBy: { position: 'asc' } } as const;

export const saveProjectDefinition = async (
  prisma: PrismaClient,
  project: ProjectDefinition,
): Promise<void> => {
  const projectId = project.id;
  const fields = {
    name: project.name,
    location: project.location,
    description: project.description,
    authorId: project.authorId,
    costOwnerId: project.costOwnerId,
    scheduleOwnerId: project.scheduleOwnerId,
    modelDocumentId: project.modelDocumentId,
    longitudinalAxes: json(project.longitudinalAxes),
    transversalAxes: [...project.transversalAxes],
  };
  await prisma.$transaction(async (tx) => {
    await tx.project.upsert({
      where: { id: projectId },
      create: { id: projectId, ...fields },
      update: fields,
    });
    const where = { where: { projectId } };
    await tx.projectMember.deleteMany(where);
    await tx.projectSpace.deleteMany(where);
    await tx.projectDocument.deleteMany(where);
    await tx.projectAttribute.deleteMany(where);
    await tx.projectSubject.deleteMany(where);
    await tx.modelElement.deleteMany(where);
    await tx.budgetItem.deleteMany(where);
    await tx.scheduleTask.deleteMany(where);
    await tx.projectDependency.deleteMany(where);
    await tx.projectLevel.deleteMany(where);
    await tx.projectSystem.deleteMany(where);
    await tx.projectMember.createMany({
      data: project.members.map((member, position) => ({
        projectId,
        position,
        ...member,
      })),
    });
    await tx.projectSpace.createMany({
      data: project.spaces.map((space, position) => ({
        projectId,
        position,
        ...space,
      })),
    });
    await tx.projectDocument.createMany({
      data: project.documents.map((document, position) => ({
        projectId,
        position,
        ...document,
      })),
    });
    await tx.projectAttribute.createMany({
      data: project.attributes.map((attribute, position) => ({
        projectId,
        position,
        ...attribute,
      })),
    });
    await tx.projectSubject.createMany({
      data: project.subjects.map((subject, position) => ({
        projectId,
        position,
        id: subject.id,
        name: subject.name,
        section: subject.section,
        category: subject.category,
        attributes: json(subject.attributes),
        ...(subject.spatial ? { spatial: json(subject.spatial) } : {}),
      })),
    });
    await tx.modelElement.createMany({
      data: project.elements.map((element, position) => ({
        projectId,
        position,
        id: element.id,
        name: element.name,
        category: element.category,
        level: element.level,
        properties: json(element.properties),
      })),
    });
    await tx.budgetItem.createMany({
      data: project.budgetItems.map((item, position) => ({
        projectId,
        position,
        ...item,
      })),
    });
    await tx.scheduleTask.createMany({
      data: project.tasks.map((task, position) => ({
        projectId,
        position,
        id: task.id,
        name: task.name,
        days: task.days,
        predecessors: [...task.predecessors],
        ...(task.driver ? { driver: json(task.driver) } : {}),
      })),
    });
    await tx.projectDependency.createMany({
      data: project.dependencies.map((dependency, position) => ({
        projectId,
        position,
        ...dependency,
        watches: [...dependency.watches],
        measures: [...dependency.measures],
      })),
    });
    await tx.projectLevel.createMany({
      data: project.levels.map((level, position) => ({
        projectId,
        position,
        ...level,
      })),
    });
    await tx.projectSystem.createMany({
      data: project.systems.map((system, position) => ({
        projectId,
        position,
        ...system,
      })),
    });
  });
};

export const listProjectIds = async (
  prisma: PrismaClient,
): Promise<string[]> => {
  const rows = await prisma.project.findMany({
    select: { id: true },
    orderBy: { createdAt: 'asc' },
  });
  return rows.map((row) => row.id);
};

export const loadProjectDefinition = async (
  prisma: PrismaClient,
  id: string,
): Promise<ProjectDefinition | null> => {
  const row = await prisma.project.findUnique({
    where: { id },
    include: {
      members: ordered,
      spaces: ordered,
      documents: ordered,
      attributes: ordered,
      subjects: ordered,
      elements: ordered,
      budgetItems: ordered,
      tasks: ordered,
      dependencies: ordered,
      levels: ordered,
      systems: ordered,
    },
  });
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    location: row.location,
    description: row.description,
    authorId: row.authorId,
    costOwnerId: row.costOwnerId,
    scheduleOwnerId: row.scheduleOwnerId,
    modelDocumentId: row.modelDocumentId,
    members: row.members.map(({ id, name, role, channel, handle }) => ({
      id,
      name,
      role,
      channel,
      handle,
    })),
    spaces: row.spaces.map(({ id, name, kind, ownerId }) => ({
      id,
      name,
      kind,
      ownerId,
    })),
    documents: row.documents.map(({ id, name, kind, spaceId, ownerId }) => ({
      id,
      name,
      kind,
      spaceId,
      ownerId,
    })),
    attributes: row.attributes.map(({ key, label }) => ({ key, label })),
    subjects: row.subjects.map((subject) => ({
      id: subject.id,
      name: subject.name,
      section: subject.section,
      category: subject.category,
      attributes: subject.attributes as unknown as SubjectAttributeDef[],
      spatial: subject.spatial as unknown as SpatialRule | null,
    })),
    elements: row.elements.map((element) => ({
      id: element.id,
      name: element.name,
      category: element.category,
      level: element.level,
      properties: element.properties as unknown as ModelPropertyDef[],
    })),
    budgetItems: row.budgetItems.map(
      ({ code, name, unit, unitPrice, category, quantity, factor }) => ({
        code,
        name,
        unit,
        unitPrice,
        category,
        quantity,
        factor,
      }),
    ),
    tasks: row.tasks.map((task) => ({
      id: task.id,
      name: task.name,
      days: task.days,
      predecessors: task.predecessors,
      driver: task.driver as unknown as TaskDriverDef | null,
    })),
    dependencies: row.dependencies.map(
      ({ category, watches, stakeholderId, summary, action, measures }) => ({
        category,
        watches,
        stakeholderId,
        summary,
        action,
        measures,
      }),
    ),
    levels: row.levels.map(({ id, label, short }) => ({ id, label, short })),
    longitudinalAxes: row.longitudinalAxes as unknown as AxisDef[],
    transversalAxes: row.transversalAxes,
    systems: row.systems.map(({ id, label, occupiesSpace }) => ({
      id,
      label,
      occupiesSpace,
    })),
  };
};

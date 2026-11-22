import type { PrismaClient } from '../generated/prisma/client.ts';
import type {
  AxisDef,
  ModelPropertyDef,
  OrganizationDef,
  ProjectDefinition,
  SpatialRule,
  SubjectAttributeDef,
  TaskDriverDef,
} from './definition.ts';

const ordered = { orderBy: { position: 'asc' } } as const;

export const saveOrganization = async (
  prisma: PrismaClient,
  organization: OrganizationDef,
): Promise<void> => {
  await prisma.organization.upsert({
    where: { id: organization.id },
    create: { id: organization.id, name: organization.name },
    update: { name: organization.name },
  });
};

export const inviteToOrganization = async (
  prisma: PrismaClient,
  invitation: {
    readonly organizationId: string;
    readonly email: string;
    readonly role: string;
  },
): Promise<void> => {
  const email = invitation.email.trim().toLowerCase();
  await prisma.invitation.upsert({
    where: {
      organizationId_email: {
        organizationId: invitation.organizationId,
        email,
      },
    },
    create: {
      organizationId: invitation.organizationId,
      email,
      role: invitation.role,
    },
    update: { role: invitation.role },
  });
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
    organizationId: row.organizationId,
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

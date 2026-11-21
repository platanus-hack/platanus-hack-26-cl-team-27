import type { ProjectVocabulary } from '@team27/context-impact';

import type { ProjectCatalog } from '../project/project-catalog.ts';

export const buildVocabulary = (
  project: ProjectCatalog,
): ProjectVocabulary => ({
  project: project.info.name,
  subjects: project.subjects.map((subject) => ({
    id: subject.id,
    label: subject.name,
    category: subject.category,
    attributes: subject.attributes.map((attribute) => ({
      key: attribute.key,
      label: project.attributeLabel(attribute.key),
      unit: attribute.unit,
    })),
  })),
  stakeholders: project.cast.map((member) => ({
    id: member.id,
    name: member.name,
    role: member.role,
  })),
});

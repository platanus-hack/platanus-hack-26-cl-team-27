import { LOS_AROMOS } from '@team27/data-main/seed';

import { ProjectCatalog } from '../src/modules/project/project-catalog.ts';
import { projectSchema } from '../src/modules/project/project-schema.ts';

export const project = new ProjectCatalog(projectSchema.parse(LOS_AROMOS));

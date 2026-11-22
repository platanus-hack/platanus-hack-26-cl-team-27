import { LOS_AROMOS } from './fixtures/los-aromos.ts';

import { ProjectCatalog } from '../src/modules/project/project-catalog.ts';
import { projectSchema } from '../src/modules/project/project-schema.ts';

export const project = new ProjectCatalog(projectSchema.parse(LOS_AROMOS));

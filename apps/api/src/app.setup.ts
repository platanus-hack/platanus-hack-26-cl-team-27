import {
  StandardSchemaValidationPipe,
  type INestApplication,
} from '@nestjs/common';

import { ErrorFilter } from './modules/coordination/http-errors.ts';

export function setupApp(app: INestApplication): INestApplication {
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new StandardSchemaValidationPipe());
  app.useGlobalFilters(new ErrorFilter());
  return app;
}

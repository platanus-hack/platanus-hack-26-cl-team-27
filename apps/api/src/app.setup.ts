import {
  StandardSchemaValidationPipe,
  type INestApplication,
  type NestApplicationOptions,
} from '@nestjs/common';

import { ErrorFilter } from './modules/coordination/http-errors.ts';

export const APP_OPTIONS = {
  rawBody: true,
} as const satisfies NestApplicationOptions;

export function setupApp(app: INestApplication): INestApplication {
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new StandardSchemaValidationPipe());
  app.useGlobalFilters(new ErrorFilter());
  return app;
}

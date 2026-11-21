import {
  StandardSchemaValidationPipe,
  type INestApplication,
} from '@nestjs/common';

export function setupApp(app: INestApplication): INestApplication {
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new StandardSchemaValidationPipe());
  return app;
}

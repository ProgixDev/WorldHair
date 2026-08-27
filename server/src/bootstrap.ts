import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { parseCorsOrigins } from './config/cors.config';
import { EnvironmentVariables } from './config/env.validation';

/**
 * Applies every cross-cutting concern to a Nest app instance.
 * Called by main.ts AND by the e2e harness, so tests hit the real stack.
 */
export function configureApp(app: INestApplication): INestApplication {
  const config = app.get(ConfigService<EnvironmentVariables, true>);

  app.use(helmet());
  app.enableCors({
    origin: parseCorsOrigins(config.get('CORS_ORIGIN', { infer: true })),
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    maxAge: 86400,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  );

  app.useGlobalFilters(new AllExceptionsFilter());

  return app;
}

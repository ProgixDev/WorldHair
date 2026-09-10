import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureApp } from './bootstrap';
import { EnvironmentVariables } from './config/env.validation';

async function bootstrap(): Promise<void> {
  // rawBody: exposes req.rawBody (the exact bytes received) alongside the
  // normal parsed req.body — needed by EmailHookController to verify
  // Supabase's Standard Webhooks signature, which is computed over the raw
  // bytes and fails against any re-serialized copy.
  const app = await NestFactory.create(AppModule, { rawBody: true });

  configureApp(app);

  const config = app.get(ConfigService<EnvironmentVariables, true>);

  await app.listen(config.get('PORT', { infer: true }));
}

void bootstrap();

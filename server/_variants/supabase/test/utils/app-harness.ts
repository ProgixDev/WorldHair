import { INestApplication, ModuleMetadata } from '@nestjs/common';
import { Test, TestingModuleBuilder } from '@nestjs/testing';
import { configureApp } from '../../src/bootstrap';
import { SupabaseService } from '../../src/database/supabase.service';
import { FakeSupabaseService } from './fakes/fake-supabase.service';
import { applyTestEnv } from './test-env';

export interface TestApp {
  app: INestApplication;
  supabase: FakeSupabaseService;
  resetDb: () => Promise<void>;
  close: () => Promise<void>;
}

export interface CreateTestAppOptions {
  /** Extra env overrides applied before the module is compiled. */
  env?: Record<string, string>;
  /** Modules mounted alongside AppModule (e2e-only fixtures). */
  extraImports?: NonNullable<ModuleMetadata['imports']>;
  /** Hook to override providers, e.g. builder.overrideProvider(SomeService). */
  customize?: (builder: TestingModuleBuilder) => TestingModuleBuilder;
}

/**
 * Boots the real `AppModule` — through `configureApp()`, the same middleware
 * stack `main.ts` uses — with `SupabaseService` replaced by
 * `FakeSupabaseService`. There's no in-memory Supabase/Postgres to run
 * against (unlike the mongodb variant's `mongodb-memory-server`), so this is
 * the full extent of "real" this harness gets — see FakeSupabaseService's
 * doc comment for exactly what that does and doesn't cover.
 */
export async function createTestApp(options: CreateTestAppOptions = {}): Promise<TestApp> {
  applyTestEnv(options.env);

  // AppModule (transitively) triggers ConfigModule.forRoot(), which validates
  // process.env synchronously at import/require time. It must be required
  // lazily, after applyTestEnv() above has set the Supabase env vars, or
  // validation fails against an empty/real env.
  const { AppModule } = await import('../../src/app.module');

  const supabase = new FakeSupabaseService();

  const builder = Test.createTestingModule({
    imports: [AppModule, ...(options.extraImports ?? [])],
  }).overrideProvider(SupabaseService).useValue(supabase);

  const moduleRef = await (options.customize?.(builder) ?? builder).compile();

  const app = moduleRef.createNestApplication({ logger: false });
  configureApp(app);
  await app.init();

  return {
    app,
    supabase,
    resetDb: async () => {
      supabase.reset();
    },
    close: async () => {
      await app.close();
    },
  };
}

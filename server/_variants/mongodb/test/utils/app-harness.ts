import { INestApplication, ModuleMetadata } from '@nestjs/common';
import { getConnectionToken } from '@nestjs/mongoose';
import { Test, TestingModuleBuilder } from '@nestjs/testing';
import { MongoMemoryServer } from 'mongodb-memory-server';
import type { Connection } from 'mongoose';
import { configureApp } from '../../src/bootstrap';
import { MailService } from '../../src/mail/mail.service';
import { applyTestEnv } from './test-env';
import { FakeMailService } from './fakes/fake-mail.service';

export interface TestApp {
  app: INestApplication;
  connection: Connection;
  mail: FakeMailService;
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
 * stack `main.ts` uses — against a REAL in-memory MongoDB (`mongodb-memory-server`,
 * not a mock). `MailService` is always replaced by `FakeMailService` so tests
 * can read the verification/reset codes it "sent" instead of guessing them.
 */
export async function createTestApp(options: CreateTestAppOptions = {}): Promise<TestApp> {
  const mongo = await MongoMemoryServer.create();
  applyTestEnv({ MONGODB_URI: mongo.getUri('server-test'), ...options.env });

  // AppModule (transitively) triggers ConfigModule.forRoot(), which validates
  // process.env synchronously at import/require time. It must be required
  // lazily, after applyTestEnv() above has set MONGODB_URI, or validation
  // fails against an empty/real env instead of this test's in-memory Mongo URI.
  const { AppModule } = await import('../../src/app.module');

  const mail = new FakeMailService();

  const builder = Test.createTestingModule({
    imports: [AppModule, ...(options.extraImports ?? [])],
  }).overrideProvider(MailService).useValue(mail);

  const moduleRef = await (options.customize?.(builder) ?? builder).compile();

  const app = moduleRef.createNestApplication({ logger: false });
  configureApp(app);
  await app.init();

  const connection = app.get<Connection>(getConnectionToken());
  await connection.syncIndexes();

  return {
    app,
    connection,
    mail,
    resetDb: async () => {
      const collections = await connection.db!.collections();
      await Promise.all(collections.map((c) => c.deleteMany({})));
      mail.reset();
    },
    close: async () => {
      await app.close();
      await mongo.stop();
    },
  };
}

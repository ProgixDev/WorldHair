import { Global, Module } from '@nestjs/common';
import { SupabaseService } from './supabase.service';

/**
 * Wraps a single server-side, service-role Supabase client (see
 * `SupabaseService`) and makes it available app-wide. `@Global()` is the
 * counterpart of the mongodb variant's per-module `MongooseModule.forFeature(...)`
 * calls — there's no per-model registration step with `@supabase/supabase-js`,
 * so every module that needs the client (auth, users, health) would otherwise
 * have to import this module individually just to inject one shared service.
 *
 * Kept as the fixed `DatabaseModule` export at this fixed file path
 * (`src/database/database.module.ts`) so `app.module.ts` — unchanged between
 * variants — never has to know which persistence layer is actually live.
 */
@Global()
@Module({
  providers: [SupabaseService],
  exports: [SupabaseService],
})
export class DatabaseModule {}

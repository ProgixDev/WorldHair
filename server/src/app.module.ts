import { Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { UserThrottlerGuard } from './common/guards/user-throttler.guard';
import { ConfigModule } from './config/config.module';
import { EnvironmentVariables } from './config/env.validation';

/**
 * No database variant selected yet — `auth/`, `users/`, `database/`, and
 * `health/` don't exist until `bun run setup:mongodb` or `bun run
 * setup:supabase` materializes one (see server/README.md). Each of those
 * scripts rewrites this file to import its own modules and wire the JWT/auth
 * guard back in as `APP_GUARD`. Until then, this is a bare skeleton: config
 * validation, per-caller rate limiting (falls back to IP — there's no
 * `req.user` without an auth module), and mail (unused until a variant that
 * sends verification/reset email is selected).
 */
@Module({
  imports: [
    ConfigModule,
    ThrottlerModule.forRootAsync({
      imports: [NestConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService<EnvironmentVariables, true>) => ({
        throttlers: [
          {
            ttl: config.get('THROTTLE_TTL', { infer: true }),
            limit: config.get('THROTTLE_LIMIT', { infer: true }),
          },
        ],
      }),
    }),
  ],
  providers: [{ provide: APP_GUARD, useClass: UserThrottlerGuard }],
})
export class AppModule {}

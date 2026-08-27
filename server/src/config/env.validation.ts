import 'reflect-metadata';
import { plainToInstance, Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
  validateSync,
} from 'class-validator';

export enum NodeEnv {
  Development = 'development',
  Test = 'test',
  Production = 'production',
}

/**
 * No database variant is selected yet — this validates only what's actually
 * wired up right now (config/throttling/mail). Run `bun run setup:mongodb` or
 * `bun run setup:supabase` first; each one replaces this file with a version
 * that also validates its own database/auth vars.
 */
export class EnvironmentVariables {
  @IsEnum(NodeEnv)
  NODE_ENV: NodeEnv = NodeEnv.Development;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(65535)
  PORT = 3000;

  /** Comma-separated allow-list. Empty means "allow any origin" (fine for local dev and for a mobile client, which sends no Origin header). */
  @IsString()
  @IsOptional()
  CORS_ORIGIN = '';

  @Type(() => Number)
  @IsInt()
  @Min(1000)
  THROTTLE_TTL = 60000;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  THROTTLE_LIMIT = 120;

  // --- Mail ---
  @IsIn(['json', 'smtp', 'relay'])
  MAIL_TRANSPORT: 'json' | 'smtp' | 'relay' = 'json';

  @IsString()
  @IsOptional()
  MAIL_HOST = '';

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(65535)
  MAIL_PORT = 587;

  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  MAIL_SECURE = false;

  @IsString()
  @IsOptional()
  MAIL_USER = '';

  @IsString()
  @IsOptional()
  MAIL_PASSWORD = '';

  /** Web app endpoint that actually sends mail via nodemailer (used when MAIL_TRANSPORT=relay). */
  @IsString()
  @IsOptional()
  MAIL_RELAY_URL = '';

  /** Shared secret sent as x-mail-relay-secret; must match the relay endpoint's own secret. */
  @IsString()
  @IsOptional()
  MAIL_RELAY_SECRET = '';

  @IsString()
  @IsNotEmpty()
  MAIL_FROM = 'App <no-reply@example.com>';

  /** Read by mail/'s rendered templates. Unused until a database variant that sends these emails is selected — kept here for schema parity with both variants. */
  @Type(() => Number)
  @IsInt()
  @Min(1)
  VERIFY_TOKEN_TTL_HOURS = 24;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  RESET_TOKEN_TTL_MINUTES = 60;
}

/**
 * Validates the merged environment at boot. Returned object becomes the
 * ConfigService source, so unknown keys are deliberately preserved.
 */
export function validateEnv(raw: Record<string, unknown>): EnvironmentVariables {
  const parsed = plainToInstance(EnvironmentVariables, raw, {
    exposeDefaultValues: true,
  });

  const errors = validateSync(parsed, {
    skipMissingProperties: false,
    forbidUnknownValues: false,
  });

  if (errors.length > 0) {
    const details = errors
      .map((e) => `  - ${e.property}: ${Object.values(e.constraints ?? {}).join('; ')}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${details}`);
  }

  return parsed;
}

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

export class EnvironmentVariables {
  @IsEnum(NodeEnv)
  NODE_ENV: NodeEnv = NodeEnv.Development;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(65535)
  PORT = 3000;

  // --- Supabase ---
  @IsString()
  @IsNotEmpty()
  SUPABASE_URL!: string;

  /** Publishable key — safe in a client. Unused server-side today (SupabaseService uses the service role key) but validated here since it's part of the standard Supabase project config a project will also hand to its mobile/web client. */
  @IsString()
  @IsNotEmpty()
  SUPABASE_ANON_KEY!: string;

  /** Privileged, RLS-bypassing key — server-only. See database/supabase.service.ts. */
  @IsString()
  @IsNotEmpty()
  SUPABASE_SERVICE_ROLE_KEY!: string;

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
  // Same schema as the mongodb variant's env.validation.ts — see
  // server/README.md ("Environment") for why: mail/ is a fixed module shared
  // by both variants, unmodified, so both variants' EnvironmentVariables must
  // supply every key it reads.
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

  /**
   * Read only by the shared mail/ module's rendered templates. Supabase's own
   * hosted Auth sends its own verification/reset email directly to the user —
   * this server never triggers that flow — so these two are unused dead
   * config under this variant unless a project wires MailService up for
   * something else. Kept for schema parity with the mongodb variant's
   * identically-named fields.
   */
  @Type(() => Number)
  @IsInt()
  @Min(1)
  VERIFY_TOKEN_TTL_HOURS = 24;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  RESET_TOKEN_TTL_MINUTES = 60;

  /** Optional — only needed if this Expo project has enhanced push security enabled. See notifications/push.service.ts. */
  @IsString()
  @IsOptional()
  EXPO_ACCESS_TOKEN = '';
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

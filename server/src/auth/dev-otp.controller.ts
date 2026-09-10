import { Controller, Get, NotFoundException, Query } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Public } from '../common/decorators/public.decorator';
import { EnvironmentVariables, NodeEnv } from '../config/env.validation';
import { DevOtpStore } from './dev-otp.store';

/**
 * Dev-only companion to `DevOtpStore` — see its doc comment. 404s outright
 * (not just an empty body) when `NODE_ENV=production`, so a production
 * server doesn't even reveal this route exists, rather than merely returning
 * nothing useful from it.
 */
@Public()
@Controller('auth/dev')
export class DevOtpController {
  constructor(
    private readonly store: DevOtpStore,
    private readonly config: ConfigService<EnvironmentVariables, true>,
  ) {}

  @Get('last-otp')
  lastOtp(@Query('email') email?: string): { token: string | null } {
    if (this.config.get('NODE_ENV', { infer: true }) === NodeEnv.Production) {
      throw new NotFoundException();
    }
    if (!email) {
      return { token: null };
    }

    return { token: this.store.take(email) };
  }
}

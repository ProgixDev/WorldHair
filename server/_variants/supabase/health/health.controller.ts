import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';
import { SupabaseService } from '../database/supabase.service';

interface ReadinessResult {
  status: 'ok';
  details: { supabase: { status: 'up' } };
}

@Public()
@Controller('health')
export class HealthController {
  constructor(private readonly supabase: SupabaseService) {}

  /** Liveness probe — no dependency I/O. */
  @Get()
  live(): { status: 'ok' } {
    return { status: 'ok' };
  }

  /**
   * Readiness probe — a trivial Postgres round-trip through the Supabase
   * client (no `@nestjs/terminus`: that package's indicators are Mongo/SQL/
   * HTTP-specific and don't ship a Supabase one, and reaching for a generic
   * indicator for one query isn't worth the dependency).
   */
  @Get('ready')
  async ready(): Promise<ReadinessResult> {
    const { error } = await this.supabase.client.from('profiles').select('id').limit(1);

    if (error) {
      throw new ServiceUnavailableException({
        status: 'error',
        details: { supabase: { status: 'down', message: error.message } },
      });
    }

    return { status: 'ok', details: { supabase: { status: 'up' } } };
  }
}

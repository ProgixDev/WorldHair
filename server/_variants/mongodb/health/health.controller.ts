import { Controller, Get } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckResult,
  HealthCheckService,
  MongooseHealthIndicator,
} from '@nestjs/terminus';
import { Public } from '../common/decorators/public.decorator';

@Public()
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly mongo: MongooseHealthIndicator,
  ) {}

  /** Liveness probe — no dependency I/O. */
  @Get()
  live(): { status: 'ok' } {
    return { status: 'ok' };
  }

  /** Readiness probe — pings MongoDB. */
  @Get('ready')
  @HealthCheck()
  ready(): Promise<HealthCheckResult> {
    // 3s — Atlas should respond well within this; a longer stall means the DB is genuinely unhealthy.
    return this.health.check([() => this.mongo.pingCheck('mongodb', { timeout: 3000 })]);
  }
}

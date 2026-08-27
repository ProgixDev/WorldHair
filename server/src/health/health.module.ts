import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';

// No TerminusModule — see health.controller.ts. SupabaseService comes from
// the @Global() DatabaseModule.
@Module({
  controllers: [HealthController],
})
export class HealthModule {}

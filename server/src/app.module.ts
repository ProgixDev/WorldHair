import { Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';
import { AdSlotsModule } from './ad-slots/ad-slots.module';
import { AppointmentsModule } from './appointments/appointments.module';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { CoiffeurModule } from './coiffeur/coiffeur.module';
import { RolesGuard } from './common/guards/roles.guard';
import { UserThrottlerGuard } from './common/guards/user-throttler.guard';
import { ConfigModule } from './config/config.module';
import { EnvironmentVariables } from './config/env.validation';
import { ContentModule } from './content/content.module';
import { DatabaseModule } from './database/database.module';
import { DiscoveryModule } from './discovery/discovery.module';
import { HealthModule } from './health/health.module';
import { MessagesModule } from './messages/messages.module';
import { NotificationsModule } from './notifications/notifications.module';
import { ReviewsModule } from './reviews/reviews.module';
import { SalonModule } from './salon/salon.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule,
    ScheduleModule.forRoot(),
    EventEmitterModule.forRoot(),
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
    DatabaseModule,
    HealthModule,
    UsersModule,
    AuthModule,
    CoiffeurModule,
    SalonModule,
    DiscoveryModule,
    AppointmentsModule,
    ReviewsModule,
    NotificationsModule,
    MessagesModule,
    AdSlotsModule,
    ContentModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: UserThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    // Must come after JwtAuthGuard: it reads request.user, which only exists
    // once JwtAuthGuard has run (guards execute in this array's order).
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}

import { Module } from '@nestjs/common';
import { MailModule } from '../mail/mail.module';
import { AppointmentRemindersJob } from './jobs/appointment-reminders.job';
import { AppointmentNotificationsListener } from './listeners/appointment-notifications.listener';
import { CoiffeurApplicationNotificationsListener } from './listeners/coiffeur-application-notifications.listener';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { PushTokensService } from './push-tokens.service';
import { PushService } from './push.service';

// No explicit SupabaseService import needed — DatabaseModule is @Global().
// ScheduleModule.forRoot()/EventEmitterModule.forRoot() are registered once
// in AppModule, not here.
@Module({
  imports: [MailModule],
  controllers: [NotificationsController],
  providers: [
    PushService,
    PushTokensService,
    NotificationsService,
    AppointmentRemindersJob,
    AppointmentNotificationsListener,
    CoiffeurApplicationNotificationsListener,
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}

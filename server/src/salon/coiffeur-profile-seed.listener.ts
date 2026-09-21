import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { CoiffeurApplicationsService } from '../coiffeur/coiffeur-applications.service';
import type { CoiffeurApplicationDecidedEvent } from '../notifications/listeners/coiffeur-application-notifications.listener';
import { SalonService } from './salon.service';

/**
 * Pre-fills "Mon salon" the moment an application is validated — without
 * this, a coiffeur who typed their salon name/description/address during
 * signup (coiffeur_applications, a one-time KYC snapshot) would find "Mon
 * salon" (coiffeur_profiles, the ongoing particulier-facing page — a
 * completely separate table) blank, having to retype everything they
 * already gave.
 */
@Injectable()
export class CoiffeurProfileSeedListener {
  private readonly logger = new Logger(CoiffeurProfileSeedListener.name);

  constructor(
    private readonly applications: CoiffeurApplicationsService,
    private readonly salon: SalonService,
  ) {}

  @OnEvent('coiffeur-application.decided')
  async onDecided(event: CoiffeurApplicationDecidedEvent): Promise<void> {
    if (event.status !== 'validated') return;

    try {
      const application = await this.applications.getMine(event.profileId);
      if (!application) return;
      await this.salon.seedProfileFromApplication(event.profileId, application);
    } catch (error) {
      this.logger.warn('Seeding the salon profile from the application failed', error as Error);
    }
  }
}

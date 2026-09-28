import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type Stripe from 'stripe';
import { AppointmentsService } from '../appointments/appointments.service';
import { CoiffeurApplicationsService } from '../coiffeur/coiffeur-applications.service';
import { AuthenticatedUser } from '../common/types/authenticated-user';
import { EnvironmentVariables } from '../config/env.validation';
import { SupabaseService } from '../database/supabase.service';
import { PaymentsService } from '../payments/payments.service';
import { PayoutAccountsService } from '../payments/payout-accounts.service';
import { SalonService } from '../salon/salon.service';
import { PlatformSettingsService } from '../settings/platform-settings.service';
import { StripeService } from '../stripe/stripe.service';
import { FakeStripe } from '../../test/utils/fakes/fake-stripe';
import { FakeSupabaseService } from '../../test/utils/fakes/fake-supabase.service';
import { DataExportService } from './data-export.service';

const STUDIO = 'coiffeur-1';
const CAMILLE = 'client-1';
const PAST = new Date(Date.now() - 10 * 86_400_000).toISOString();

describe('DataExportService', () => {
  let supabase: FakeSupabaseService;
  let exports: DataExportService;

  beforeEach(() => {
    supabase = new FakeSupabaseService();
    const events = new EventEmitter2();
    const config = {
      get: (key: string) => ({ STRIPE_SECRET_KEY: 'sk_test_123', WEB_APP_URL: 'https://worldhair.test' })[key],
    } as unknown as ConfigService<EnvironmentVariables, true>;
    const stripeService = new StripeService(new FakeStripe() as unknown as Stripe, config);
    const payouts = new PayoutAccountsService(supabase as unknown as SupabaseService, stripeService, config);
    const payments = new PaymentsService(
      supabase as unknown as SupabaseService,
      stripeService,
      new PlatformSettingsService(supabase as unknown as SupabaseService),
      payouts,
      events,
      config,
    );
    const appointments = new AppointmentsService(
      supabase as unknown as SupabaseService,
      new CoiffeurApplicationsService(supabase as unknown as SupabaseService, events),
      new SalonService(supabase as unknown as SupabaseService),
      events,
      payments,
      payouts,
    );
    exports = new DataExportService(supabase as unknown as SupabaseService, appointments);

    supabase.seedValidatedSalon({
      profileId: STUDIO,
      firstName: 'Sofia',
      lastName: 'Benali',
      salonName: 'Studio W',
      phone: '06 12 34 56 78',
      services: [{ name: 'Coupe & brushing', price: 40, durationMin: 60, specialty: 'coupe' }],
    });
    supabase.addUser('camille-token', { id: CAMILLE, email: 'camille@example.com', email_confirmed_at: null }, 'particulier', {
      firstName: 'Camille',
      lastName: 'Durand',
    });
    supabase.seedTermsAcceptance(CAMILLE, '2026-09-29', '2026-09-29T08:00:00.000Z');
  });

  const user = (id: string, email: string, role: AuthenticatedUser['role']): AuthenticatedUser =>
    ({ id, email, role, emailVerified: true }) as AuthenticatedUser;

  it("gives a client everything WorldHair holds on them: account, bookings, reviews, favorites, settings", async () => {
    const booking = supabase.seedAppointment({ particulierId: CAMILLE, coiffeurId: STUDIO, startsAt: PAST, price: 40 });
    supabase.seedPayment({ appointmentId: booking, particulierId: CAMILLE, coiffeurId: STUDIO, amount: 40, refundedAmount: 10 });
    supabase.seedReview({ appointmentId: booking, particulierId: CAMILLE, coiffeurId: STUDIO, rating: 5, tags: ['Écoute'], comment: 'Top !' });
    supabase.seedFavorite(CAMILLE, STUDIO);

    const data = await exports.export(user(CAMILLE, 'camille@example.com', 'particulier'));

    expect(data.account).toMatchObject({
      id: CAMILLE,
      email: 'camille@example.com',
      role: 'particulier',
      firstName: 'Camille',
      lastName: 'Durand',
      termsVersion: '2026-09-29',
      termsAcceptedAt: '2026-09-29T08:00:00.000Z',
    });
    expect(data.bookings).toMatchObject([{ id: booking, salonName: 'Studio W', price: 40, payment: { amount: 40, refundedAmount: 10 } }]);
    expect(data.reviewsWritten).toMatchObject([{ salonName: 'Studio W', rating: 5, comment: 'Top !' }]);
    expect(data.favorites).toMatchObject([{ salonId: STUDIO, salonName: 'Studio W' }]);
    expect(data.salon).toBeUndefined();
    expect(JSON.parse(JSON.stringify(data))).toEqual(data);
  });

  it('gives a salon its dossier, its page, its prestations and hours, its bookings and the reviews it received', async () => {
    const booking = supabase.seedAppointment({ particulierId: CAMILLE, coiffeurId: STUDIO, startsAt: PAST, price: 40 });
    supabase.seedReview({ appointmentId: booking, particulierId: CAMILLE, coiffeurId: STUDIO, rating: 4, comment: 'Bien.' });
    supabase.seedSubscription({ profileId: STUDIO, status: 'active', stripeCustomerId: 'cus_1', stripeSubscriptionId: 'sub_1' });

    const data = await exports.export(user(STUDIO, 'sofia@example.com', 'coiffeur'));

    expect(data.salon).toMatchObject({
      application: { firstName: 'Sofia', lastName: 'Benali', status: 'validated' },
      profile: { salonName: 'Studio W', phone: '06 12 34 56 78' },
      services: [{ name: 'Coupe & brushing', price: 40 }],
      bookings: [{ id: booking, clientName: 'Camille Durand' }],
      reviewsReceived: [{ rating: 4, comment: 'Bien.' }],
      subscription: { status: 'active' },
    });
    // Its own bookings as a client are none.
    expect(data.bookings).toEqual([]);
  });
});

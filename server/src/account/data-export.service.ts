import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { AppointmentsService, CoiffeurAppointment, ParticulierAppointment } from '../appointments/appointments.service';
import { AuthenticatedUser } from '../common/types/authenticated-user';
import { allPages } from '../common/utils/pages';
import { slices } from '../common/utils/slices';
import { SupabaseService } from '../database/supabase.service';

type Row = Record<string, unknown>;

/** snake_case columns as camelCase keys, like the rest of the API — `omit` left out. */
function camel(row: Row, omit: string[] = []): Row {
  return Object.fromEntries(
    Object.entries(row)
      .filter(([key]) => !omit.includes(key))
      .map(([key, value]) => [key.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase()), value]),
  );
}

/** A salon's booking as its export gives it: the client by name, as in the app — not by account. */
function withoutClientId(booking: CoiffeurAppointment): Omit<CoiffeurAppointment, 'clientId'> {
  return Object.fromEntries(Object.entries(booking).filter(([key]) => key !== 'clientId')) as Omit<CoiffeurAppointment, 'clientId'>;
}

export interface DataExport {
  /** What this is, in the user's language. */
  about: string;
  exportedAt: string;
  account: Row;
  notificationPreferences: Row | null;
  favorites: { salonId: string; salonName: string; addedAt: string }[];
  /** As a client. */
  bookings: ParticulierAppointment[];
  reviewsWritten: Row[];
  reportsFiled: Row[];
  /** What WorldHair sent this account (pushes), and the phones they went to — never their push tokens. */
  notifications: Row[];
  devices: Row[];
  /** A coiffeur's salon: everything they gave WorldHair about it, and its activity. */
  salon?: {
    application: Row | null;
    profile: Row | null;
    services: Row[];
    openingHours: Row[];
    closures: Row[];
    gallery: Row[];
    subscription: Row | null;
    payoutAccount: Row | null;
    /** The salon's bookings, its clients by name as it sees them in the app — not by account. */
    bookings: Omit<CoiffeurAppointment, 'clientId'>[];
    reviewsReceived: Row[];
  };
}

/** Where a large export waits to be downloaded (private; emptied every night by DocumentRetentionJob). */
export const EXPORTS_BUCKET = 'data-exports';
const EXPORT_FILE = 'worldhair-donnees.json';
/** How long the download link works. */
const LINK_SECONDS = 10 * 60;

/**
 * « Exporter mes données » (TODO.md Phase 8 — GDPR, right of access): every
 * row WorldHair holds about the account, read afresh, as JSON the app
 * shares. Internal bookkeeping (payment locks, Stripe ids) is left out; the
 * files themselves (photos, documents) are named, not included.
 */
@Injectable()
export class DataExportService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly appointments: AppointmentsService,
  ) {}

  async export(user: AuthenticatedUser, now = new Date()): Promise<DataExport> {
    const [profile, preferences, favorites, reviewsWritten, reportsFiled, bookings, notifications, devices] = await Promise.all([
      this.one('profiles', 'id', user.id),
      this.one('notification_preferences', 'user_id', user.id),
      this.all('favorites', 'particulier_id', user.id, ['created_at', 'coiffeur_id']),
      this.all('reviews', 'particulier_id', user.id, ['created_at', 'id']),
      this.all('review_reports', 'reporter_id', user.id, ['created_at', 'review_id']),
      this.appointments.listForParticulier(user.id),
      this.all('notifications_log', 'user_id', user.id, ['created_at', 'id']),
      this.all('push_tokens', 'user_id', user.id, ['created_at', 'id']),
    ]);
    const salonNames = await this.salonNames([
      ...favorites.map((row) => row.coiffeur_id as string),
      ...reviewsWritten.map((row) => row.coiffeur_id as string),
    ]);

    const data: DataExport = {
      about: "Les données que WorldHair détient sur votre compte, au format JSON (RGPD, droit d'accès).",
      exportedAt: now.toISOString(),
      account: { id: user.id, email: user.email, ...camel(profile ?? {}, ['id']) },
      notificationPreferences: preferences ? camel(preferences, ['user_id']) : null,
      favorites: favorites.map((row) => ({
        salonId: row.coiffeur_id as string,
        salonName: salonNames.get(row.coiffeur_id as string) ?? '',
        addedAt: row.created_at as string,
      })),
      bookings,
      reviewsWritten: reviewsWritten.map((row) => ({
        salonName: salonNames.get(row.coiffeur_id as string) ?? '',
        ...camel(row, ['particulier_id', 'report_reason', 'reported_at']),
      })),
      reportsFiled: reportsFiled.map((row) => camel(row, ['reporter_id'])),
      notifications: notifications.map((row) => camel(row, ['id', 'user_id', 'dedupe_key'])),
      devices: devices.map((row) => camel(row, ['id', 'user_id', 'token'])),
    };

    if (user.role === 'coiffeur') {
      const [application, salonProfile, services, openingHours, closures, gallery, subscription, payoutAccount, salonBookings, reviewsReceived] =
        await Promise.all([
          this.one('coiffeur_applications', 'profile_id', user.id),
          this.one('coiffeur_profiles', 'profile_id', user.id),
          this.all('coiffeur_services', 'profile_id', user.id, ['id']),
          this.all('coiffeur_availability', 'profile_id', user.id, ['weekday']),
          this.all('coiffeur_time_off', 'profile_id', user.id, ['starts_at', 'id']),
          this.all('coiffeur_gallery_photos', 'profile_id', user.id, ['created_at', 'id']),
          this.one('coiffeur_subscriptions', 'profile_id', user.id),
          this.one('coiffeur_payout_accounts', 'profile_id', user.id),
          this.appointments.listForCoiffeur(user.id),
          this.all('reviews', 'coiffeur_id', user.id, ['created_at', 'id']),
        ]);
      data.salon = {
        application: application ? camel(application, ['id', 'profile_id']) : null,
        // `location`: PostGIS's own copy of latitude/longitude.
        profile: salonProfile ? camel(salonProfile, ['profile_id', 'location']) : null,
        services: services.map((row) => camel(row, ['profile_id'])),
        openingHours: openingHours.map((row) => camel(row, ['profile_id'])),
        closures: closures.map((row) => camel(row, ['profile_id'])),
        gallery: gallery.map((row) => camel(row, ['profile_id'])),
        subscription: subscription ? camel(subscription, ['profile_id', 'stripe_customer_id', 'stripe_subscription_id']) : null,
        payoutAccount: payoutAccount ? camel(payoutAccount, ['profile_id', 'stripe_account_id']) : null,
        bookings: salonBookings.map(withoutClientId),
        // Their authors are the salon's clients: shown as in the app, by review, without their id.
        reviewsReceived: reviewsReceived.map((row) => camel(row, ['particulier_id', 'coiffeur_id', 'report_reason', 'reported_at'])),
      };
    }
    return data;
  }

  /**
   * The same export as a file, for one too large to hand to the phone's
   * share sheet: written to a private bucket, answered as a link that
   * works a few minutes. The file goes the next night, or with the account.
   */
  async downloadLink(user: AuthenticatedUser): Promise<{ url: string; expiresAt: string }> {
    const path = `${user.id}/${EXPORT_FILE}`;
    const body = JSON.stringify(await this.export(user), null, 2);
    const storage = this.supabase.client.storage.from(EXPORTS_BUCKET);
    const { error } = await storage.upload(path, body, { upsert: true, contentType: 'application/json' });
    if (error) {
      throw new InternalServerErrorException(error.message);
    }
    const { data, error: linkError } = await storage.createSignedUrl(path, LINK_SECONDS, { download: EXPORT_FILE });
    if (linkError || !data) {
      throw new InternalServerErrorException(linkError?.message ?? 'No download link');
    }
    return { url: data.signedUrl, expiresAt: new Date(Date.now() + LINK_SECONDS * 1000).toISOString() };
  }

  private async one(table: string, column: string, value: string): Promise<Row | null> {
    const { data, error } = await this.supabase.client.from(table).select().eq(column, value).maybeSingle();
    if (error) {
      throw new InternalServerErrorException(error.message);
    }
    return data as Row | null;
  }

  /** Every row, however many, in a stable order. */
  private async all(table: string, column: string, value: string, order: string[]): Promise<Row[]> {
    return allPages<Row>((from, to) => {
      let query = this.supabase.client.from(table).select().eq(column, value);
      for (const key of order) query = query.order(key);
      return query.range(from, to);
    });
  }

  private async salonNames(ids: string[]): Promise<Map<string, string>> {
    const names = new Map<string, string>();
    for (const slice of slices([...new Set(ids)])) {
      const { data, error } = await this.supabase.client.from('coiffeur_profiles').select('profile_id, salon_name').in('profile_id', slice);
      if (error) {
        throw new InternalServerErrorException(error.message);
      }
      for (const row of data as { profile_id: string; salon_name: string }[]) names.set(row.profile_id, row.salon_name);
    }
    return names;
  }
}

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { AppointmentRow, derivedStatus } from '../appointments/appointments.service';
import { Role } from '../common/types/role';
import { allPages } from '../common/utils/pages';
import { slices } from '../common/utils/slices';
import { SupabaseService } from '../database/supabase.service';

/** Why a review is reported — the app's picker (TODO.md Phase 6); the admins read it with the details. */
export const REPORT_REASONS = ['offensive', 'fake', 'personal_info', 'spam', 'other'] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

export interface ReviewDto {
  id: string;
  appointmentId: string;
  salonId: string;
  authorName: string;
  rating: number;
  tags: string[];
  comment: string;
  reply?: string;
  createdAt: string;
  status: 'visible' | 'reported' | 'hidden';
  /** The reader already reported it: the app shows « Signalé » instead of the button. */
  reportedByMe: boolean;
}

/** One person's report on a review, for the admins. */
export interface ReviewReportDto {
  reporterId: string;
  /** A client's full name; a salon by its name. */
  reporterName: string;
  reporterRole: Role;
  reason: ReportReason;
  details: string | null;
  createdAt: string;
}

/** A review in the admins' moderation queue: whose salon, whose words, and every report on it. */
export interface ModeratedReviewDto extends ReviewDto {
  salonName: string;
  /** Unabridged — the public byline keeps the last name's initial only. */
  authorFullName: string;
  /** Oldest first. */
  reports: ReviewReportDto[];
  /** The latest report's reason, as the review keeps it — the only one for reviews reported before each report was kept. */
  reportReason: string | null;
  reportedAt: string | null;
}

export interface CreateReviewInput {
  appointmentId: string;
  rating: number;
  tags?: string[];
  comment?: string;
}

interface ReviewRow {
  id: string;
  appointment_id: string;
  /** Null once its author deleted their account: the review stays, as « Ancien client ». */
  particulier_id: string | null;
  coiffeur_id: string;
  rating: number;
  tags: string[];
  comment: string;
  coiffeur_reply: string | null;
  replied_at: string | null;
  status: string;
  report_reason: string | null;
  reported_at: string | null;
  created_at: string;
}

/** How a review whose author deleted their account signs (TODO.md Phase 8). */
const FORMER_CLIENT = 'Ancien client';

/** The authors still with an account. */
function authorsOf(rows: ReviewRow[]): string[] {
  return rows.flatMap((row) => (row.particulier_id ? [row.particulier_id] : []));
}

interface ProfileNameRow {
  id: string;
  first_name: string;
  last_name: string;
  role?: Role;
}

interface ReviewReportRow {
  review_id: string;
  reporter_id: string;
  reason: ReportReason;
  details: string | null;
  created_at: string;
}

/**
 * "Avis" (TODO.md). A review may only be left once its appointment shows as
 * "done" (see AppointmentsService.derivedStatus) — one review per
 * appointment, enforced by the `reviews.appointment_id` unique constraint.
 * Deliberately does NOT touch coiffeur_profiles.rating/review_count — see
 * schema.sql's comment on the reviews table for why.
 */
@Injectable()
export class ReviewsService {
  constructor(private readonly supabase: SupabaseService) {}

  async create(particulierId: string, input: CreateReviewInput): Promise<ReviewDto> {
    const appointment = await this.appointmentOrThrow(input.appointmentId);
    if (appointment.particulier_id !== particulierId) {
      throw new ForbiddenException();
    }
    if (derivedStatus(appointment) !== 'done') {
      throw new BadRequestException('This appointment is not completed yet');
    }
    if (appointment.attendance === 'no_show') {
      throw new BadRequestException('This appointment was marked as missed');
    }

    const { data: existing, error: existingError } = await this.supabase.client
      .from('reviews')
      .select()
      .eq('appointment_id', input.appointmentId)
      .maybeSingle();
    if (existingError) {
      throw new InternalServerErrorException(existingError.message);
    }
    if (existing) {
      throw new BadRequestException('This appointment already has a review');
    }

    const { data, error } = await this.supabase.client
      .from('reviews')
      .insert({
        appointment_id: input.appointmentId,
        particulier_id: particulierId,
        coiffeur_id: appointment.coiffeur_id,
        rating: input.rating,
        tags: input.tags ?? [],
        comment: input.comment?.trim() ?? '',
      })
      .select()
      .single();
    if (error) {
      throw new InternalServerErrorException(error.message);
    }

    const names = await this.authorNamesFor([particulierId]);
    return this.map(data as ReviewRow, names.get(particulierId) ?? 'Client');
  }

  /**
   * Public — a salon's reviews, for the discovery/salon-detail page.
   * `reported` still shows: reporting only flags a review for admin
   * attention, it must not let anyone hide content just by reporting it
   * before an admin ever looks at it. Only an admin's `hide` decision
   * actually removes something from public view.
   */
  async listForSalon(coiffeurId: string, viewerId?: string): Promise<ReviewDto[]> {
    const rows = (await this.select({ coiffeurId })).filter((row) => row.status !== 'hidden');
    return this.mapAll(rows, await this.reportedBy(viewerId, rows));
  }

  /** The particulier's own submitted reviews. */
  async listMine(particulierId: string): Promise<ReviewDto[]> {
    return this.mapAll(await this.select({ particulierId }));
  }

  /** The coiffeur's own reviews to manage/reply to — every status, not just visible. */
  async listForCoiffeurOwner(coiffeurId: string): Promise<ReviewDto[]> {
    const rows = await this.select({ coiffeurId });
    return this.mapAll(rows, await this.reportedBy(coiffeurId, rows));
  }

  async reply(coiffeurId: string, reviewId: string, text: string): Promise<void> {
    const row = await this.reviewOrThrow(reviewId);
    if (row.coiffeur_id !== coiffeurId) {
      throw new ForbiddenException();
    }
    await this.updateRow(reviewId, { coiffeur_reply: text.trim(), replied_at: new Date().toISOString() });
  }

  async deleteReply(coiffeurId: string, reviewId: string): Promise<void> {
    const row = await this.reviewOrThrow(reviewId);
    if (row.coiffeur_id !== coiffeurId) {
      throw new ForbiddenException();
    }
    await this.updateRow(reviewId, { coiffeur_reply: null, replied_at: null });
  }

  /**
   * "Signaler" (TODO.md Phase 6): a client reading a review, or the salon
   * it's about, reports it once, with a reason. It joins the admins' queue
   * and stays visible until they decide; one they already hid stays hidden,
   * the report kept. The author can't report their own review, nor a salon
   * another salon's.
   */
  async report(
    reviewId: string,
    reporter: { id: string; role: Role },
    input: { reason: ReportReason; details?: string },
  ): Promise<void> {
    const row = await this.reviewOrThrow(reviewId);
    if (row.particulier_id === reporter.id) {
      throw new BadRequestException("You can't report your own review");
    }
    if (reporter.role === 'coiffeur' && row.coiffeur_id !== reporter.id) {
      throw new ForbiddenException("A salon can only report its own salon's reviews");
    }
    const details = input.details?.trim() || null;
    const { data, error } = await this.supabase.client
      .from('review_reports')
      .insert({ review_id: reviewId, reporter_id: reporter.id, reason: input.reason, details })
      .select()
      .single();
    if (error && error.code !== '23505') {
      throw new InternalServerErrorException(error.message);
    }
    // Reported before: flagged again only when that first try's flag never
    // landed — a repeat never undoes the admins' decision since.
    const report = (data as ReviewReportRow | null) ?? (await this.unflaggedReportOf(row, reporter.id));
    if (report) {
      await this.updateRow(reviewId, {
        ...(row.status === 'hidden' ? {} : { status: 'reported' }),
        report_reason: report.details ? `${report.reason}: ${report.details}` : report.reason,
        // The report's own time (the database's clock): what a repeat compares against.
        reported_at: report.created_at,
      });
    }
    if (error) {
      throw new ConflictException('You already reported this review');
    }
  }

  // ─── Admin — "Signalement / modération avis" ─────────────────────────────

  /** The queue: reviews reported and not decided on yet. */
  async listReported(): Promise<ModeratedReviewDto[]> {
    return this.forModeration(await this.selectAll('reported'));
  }

  /** Reviews the admins hid — one can be put back. */
  async listHidden(): Promise<ModeratedReviewDto[]> {
    return this.forModeration(await this.selectAll('hidden'));
  }

  async moderate(reviewId: string, decision: 'hide' | 'restore'): Promise<void> {
    await this.reviewOrThrow(reviewId);
    await this.updateRow(reviewId, { status: decision === 'hide' ? 'hidden' : 'visible' });
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private async select(filters: { coiffeurId?: string; particulierId?: string; status?: string }): Promise<ReviewRow[]> {
    let query = this.supabase.client.from('reviews').select();
    if (filters.coiffeurId) query = query.eq('coiffeur_id', filters.coiffeurId);
    if (filters.particulierId) query = query.eq('particulier_id', filters.particulierId);
    if (filters.status) query = query.eq('status', filters.status);
    const { data, error } = await query;
    if (error) {
      throw new InternalServerErrorException(error.message);
    }
    return data as ReviewRow[];
  }

  /** This person's report on the review, when its flag never landed: the review wasn't flagged at, or after, the time it was filed. */
  private async unflaggedReportOf(row: ReviewRow, reporterId: string): Promise<ReviewReportRow | null> {
    const { data, error } = await this.supabase.client
      .from('review_reports')
      .select()
      .eq('review_id', row.id)
      .eq('reporter_id', reporterId)
      .maybeSingle();
    if (error) {
      throw new InternalServerErrorException(error.message);
    }
    const report = data as ReviewReportRow | null;
    if (!report) return null;
    const flagged = row.reported_at !== null && new Date(row.reported_at).getTime() >= new Date(report.created_at).getTime();
    return flagged ? null : report;
  }

  /** Every review with this status, however many. */
  private async selectAll(status: 'reported' | 'hidden'): Promise<ReviewRow[]> {
    return allPages<ReviewRow>((from, to) =>
      this.supabase.client
        .from('reviews')
        .select()
        .eq('status', status)
        .order('created_at', { ascending: false })
        .order('id')
        .range(from, to),
    );
  }

  private async forModeration(rows: ReviewRow[]): Promise<ModeratedReviewDto[]> {
    const reports = await this.reportsOn(rows.map((row) => row.id));
    const people = await this.profilesFor([
      ...new Set([...authorsOf(rows), ...reports.map((report) => report.reporter_id)]),
    ]);
    const salons = await this.salonNamesFor([
      ...new Set([
        ...rows.map((row) => row.coiffeur_id),
        ...reports.filter((report) => people.get(report.reporter_id)?.role === 'coiffeur').map((report) => report.reporter_id),
      ]),
    ]);
    const reportsOf = new Map<string, ReviewReportRow[]>();
    for (const report of reports) reportsOf.set(report.review_id, [...(reportsOf.get(report.review_id) ?? []), report]);
    const nameOf = (id: string) => {
      const person = people.get(id);
      return `${person?.first_name ?? ''} ${person?.last_name ?? ''}`.trim();
    };

    return rows
      .slice()
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .map((row) => {
        const author = row.particulier_id ? people.get(row.particulier_id) : undefined;
        return {
          ...this.map(
            row,
            row.particulier_id ? this.formatAuthorName(author?.first_name ?? '', author?.last_name ?? '') : FORMER_CLIENT,
          ),
          salonName: salons.get(row.coiffeur_id) || nameOf(row.coiffeur_id) || 'Salon',
          authorFullName: row.particulier_id ? nameOf(row.particulier_id) || 'Client' : FORMER_CLIENT,
          reports: (reportsOf.get(row.id) ?? []).map((report) => {
            const role = people.get(report.reporter_id)?.role ?? 'particulier';
            return {
              reporterId: report.reporter_id,
              reporterName:
                (role === 'coiffeur' ? salons.get(report.reporter_id) : undefined) ||
                nameOf(report.reporter_id) ||
                (role === 'coiffeur' ? 'Salon' : 'Client'),
              reporterRole: role,
              reason: report.reason,
              details: report.details,
              createdAt: report.created_at,
            };
          }),
          reportReason: row.report_reason,
          reportedAt: row.reported_at,
        };
      });
  }

  /** Every report on these reviews, oldest first. */
  private async reportsOn(reviewIds: string[]): Promise<ReviewReportRow[]> {
    const reports: ReviewReportRow[] = [];
    for (const slice of slices(reviewIds)) {
      reports.push(
        ...(await allPages<ReviewReportRow>((from, to) =>
          this.supabase.client
            .from('review_reports')
            .select()
            .in('review_id', slice)
            .order('created_at')
            .order('review_id')
            .order('reporter_id')
            .range(from, to),
        )),
      );
    }
    return reports.sort((a, b) => a.created_at.localeCompare(b.created_at));
  }

  private async profilesFor(ids: string[]): Promise<Map<string, ProfileNameRow>> {
    const profiles = new Map<string, ProfileNameRow>();
    for (const slice of slices(ids)) {
      const { data, error } = await this.supabase.client.from('profiles').select().in('id', slice);
      if (error) {
        throw new InternalServerErrorException(error.message);
      }
      for (const row of data as ProfileNameRow[]) profiles.set(row.id, row);
    }
    return profiles;
  }

  /** Salons by their shop name — coiffeurs' own profile names are blank (see coiffeur_applications). */
  private async salonNamesFor(ids: string[]): Promise<Map<string, string>> {
    const names = new Map<string, string>();
    for (const slice of slices(ids)) {
      const { data, error } = await this.supabase.client.from('coiffeur_profiles').select().in('profile_id', slice);
      if (error) {
        throw new InternalServerErrorException(error.message);
      }
      for (const row of data as { profile_id: string; salon_name: string }[]) names.set(row.profile_id, row.salon_name);
    }
    return names;
  }

  private async appointmentOrThrow(id: string): Promise<AppointmentRow> {
    const { data, error } = await this.supabase.client.from('appointments').select().eq('id', id).maybeSingle();
    if (error) {
      throw new InternalServerErrorException(error.message);
    }
    if (!data) {
      throw new NotFoundException('Appointment not found');
    }
    return data as AppointmentRow;
  }

  private async reviewOrThrow(id: string): Promise<ReviewRow> {
    const { data, error } = await this.supabase.client.from('reviews').select().eq('id', id).maybeSingle();
    if (error) {
      throw new InternalServerErrorException(error.message);
    }
    if (!data) {
      throw new NotFoundException('Review not found');
    }
    return data as ReviewRow;
  }

  private async updateRow(id: string, patch: Record<string, unknown>): Promise<void> {
    const { error } = await this.supabase.client.from('reviews').update(patch).eq('id', id);
    if (error) {
      throw new InternalServerErrorException(error.message);
    }
  }

  /** A hundred at a time: a salon's authors, however many. */
  private async authorNamesFor(ids: string[]): Promise<Map<string, string>> {
    const names = new Map<string, string>();
    for (const [id, row] of await this.profilesFor(ids)) names.set(id, this.formatAuthorName(row.first_name, row.last_name));
    return names;
  }

  /** "Camille Durand" -> "Camille D." — the last name's initial only, for a public review byline. */
  private formatAuthorName(firstName: string, lastName: string): string {
    const lastInitial = lastName ? lastName.charAt(0).toUpperCase() + '.' : '';
    return [firstName, lastInitial].filter(Boolean).join(' ').trim() || 'Client';
  }

  /** Which of `rows` `viewerId` already reported. */
  private async reportedBy(viewerId: string | undefined, rows: ReviewRow[]): Promise<Set<string>> {
    const reported = new Set<string>();
    if (!viewerId || rows.length === 0) return reported;
    for (const slice of slices(rows.map((row) => row.id))) {
      const { data, error } = await this.supabase.client
        .from('review_reports')
        .select('review_id')
        .eq('reporter_id', viewerId)
        .in('review_id', slice);
      if (error) {
        throw new InternalServerErrorException(error.message);
      }
      for (const report of data as { review_id: string }[]) reported.add(report.review_id);
    }
    return reported;
  }

  private async mapAll(rows: ReviewRow[], reportedByMe = new Set<string>()): Promise<ReviewDto[]> {
    const names = await this.authorNamesFor([...new Set(authorsOf(rows))]);
    return rows
      .slice()
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .map((row) =>
        this.map(
          row,
          row.particulier_id ? (names.get(row.particulier_id) ?? 'Client') : FORMER_CLIENT,
          reportedByMe.has(row.id),
        ),
      );
  }

  private map(row: ReviewRow, authorName: string, reportedByMe = false): ReviewDto {
    return {
      id: row.id,
      appointmentId: row.appointment_id,
      salonId: row.coiffeur_id,
      authorName,
      rating: row.rating,
      tags: row.tags,
      comment: row.comment,
      reply: row.coiffeur_reply ?? undefined,
      createdAt: row.created_at,
      status: row.status as ReviewDto['status'],
      reportedByMe,
    };
  }
}

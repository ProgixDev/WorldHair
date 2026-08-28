import { BadRequestException, ForbiddenException, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { AppointmentRow, derivedStatus } from '../appointments/appointments.service';
import { SupabaseService } from '../database/supabase.service';

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
  particulier_id: string;
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

interface ProfileNameRow {
  id: string;
  first_name: string;
  last_name: string;
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
  async listForSalon(coiffeurId: string): Promise<ReviewDto[]> {
    const rows = (await this.select({ coiffeurId })).filter((row) => row.status !== 'hidden');
    return this.mapAll(rows);
  }

  /** The particulier's own submitted reviews. */
  async listMine(particulierId: string): Promise<ReviewDto[]> {
    return this.mapAll(await this.select({ particulierId }));
  }

  /** The coiffeur's own reviews to manage/reply to — every status, not just visible. */
  async listForCoiffeurOwner(coiffeurId: string): Promise<ReviewDto[]> {
    return this.mapAll(await this.select({ coiffeurId }));
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

  /** Any authenticated caller — flags a review for admin attention. */
  async report(reviewId: string, reason?: string): Promise<void> {
    const row = await this.reviewOrThrow(reviewId);
    if (row.status === 'hidden') return; // already actioned — nothing to do
    await this.updateRow(reviewId, {
      status: 'reported',
      report_reason: reason?.trim() || null,
      reported_at: new Date().toISOString(),
    });
  }

  // ─── Admin — "Signalement / modération avis" ─────────────────────────────

  async listReported(): Promise<ReviewDto[]> {
    return this.mapAll(await this.select({ status: 'reported' }));
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

  private async authorNamesFor(ids: string[]): Promise<Map<string, string>> {
    if (ids.length === 0) return new Map();
    const { data, error } = await this.supabase.client.from('profiles').select().in('id', ids);
    if (error) {
      throw new InternalServerErrorException(error.message);
    }
    return new Map(
      (data as ProfileNameRow[]).map((row) => [row.id, this.formatAuthorName(row.first_name, row.last_name)]),
    );
  }

  /** "Camille Durand" -> "Camille D." — the last name's initial only, for a public review byline. */
  private formatAuthorName(firstName: string, lastName: string): string {
    const lastInitial = lastName ? lastName.charAt(0).toUpperCase() + '.' : '';
    return [firstName, lastInitial].filter(Boolean).join(' ').trim() || 'Client';
  }

  private async mapAll(rows: ReviewRow[]): Promise<ReviewDto[]> {
    const names = await this.authorNamesFor([...new Set(rows.map((row) => row.particulier_id))]);
    return rows
      .slice()
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .map((row) => this.map(row, names.get(row.particulier_id) ?? 'Client'));
  }

  private map(row: ReviewRow, authorName: string): ReviewDto {
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
    };
  }
}

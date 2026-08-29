import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PaginationOptions } from '../common/dto/pagination-query.dto';
import { SupabaseService } from '../database/supabase.service';
import { PracticeZone, SubmitCoiffeurApplicationDto } from './dto/submit-application.dto';
import { ReviewDecision } from './dto/review-application.dto';

export type ApplicationStatus = 'pending' | 'validated' | 'rejected';

export interface CoiffeurApplication {
  id: string;
  profileId: string;
  firstName: string;
  lastName: string;
  phone: string;
  salonName: string;
  description: string;
  practiceZone: PracticeZone;
  addressLine: string | null;
  postalCode: string | null;
  city: string | null;
  invoiceDocumentPath: string | null;
  travelRadiusKm: number | null;
  identityDocumentPath: string;
  diplomaDocumentPath: string;
  kbisDocumentPath: string;
  status: ApplicationStatus;
  reviewMessage: string | null;
  shopProfileComplete: boolean;
  submittedAt: string;
  reviewedAt: string | null;
}

interface CoiffeurApplicationRow {
  id: string;
  profile_id: string;
  first_name: string;
  last_name: string;
  phone: string;
  salon_name: string;
  description: string;
  practice_zone: PracticeZone;
  address_line: string | null;
  postal_code: string | null;
  city: string | null;
  invoice_document_path: string | null;
  travel_radius_km: number | null;
  identity_document_path: string;
  diploma_document_path: string;
  kbis_document_path: string;
  status: ApplicationStatus;
  review_message: string | null;
  shop_profile_complete: boolean;
  submitted_at: string;
  reviewed_at: string | null;
}

function mapRow(row: CoiffeurApplicationRow): CoiffeurApplication {
  return {
    id: row.id,
    profileId: row.profile_id,
    firstName: row.first_name,
    lastName: row.last_name,
    phone: row.phone,
    salonName: row.salon_name,
    description: row.description,
    practiceZone: row.practice_zone,
    addressLine: row.address_line,
    postalCode: row.postal_code,
    city: row.city,
    invoiceDocumentPath: row.invoice_document_path,
    travelRadiusKm: row.travel_radius_km,
    identityDocumentPath: row.identity_document_path,
    diplomaDocumentPath: row.diploma_document_path,
    kbisDocumentPath: row.kbis_document_path,
    status: row.status,
    reviewMessage: row.review_message,
    shopProfileComplete: row.shop_profile_complete,
    submittedAt: row.submitted_at,
    reviewedAt: row.reviewed_at,
  };
}

/**
 * Reads/writes the `coiffeur_applications` table (see `../../schema.sql`) —
 * both the coiffeur's own self-service actions and the admin review queue,
 * since they're the same table and this keeps `mapRow` in one place.
 */
@Injectable()
export class CoiffeurApplicationsService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly events: EventEmitter2,
  ) {}

  async getMine(userId: string): Promise<CoiffeurApplication | null> {
    const { data, error } = await this.supabase.client
      .from('coiffeur_applications')
      .select()
      .eq('profile_id', userId)
      .maybeSingle();

    if (error) {
      throw new InternalServerErrorException(error.message);
    }
    return data ? mapRow(data as CoiffeurApplicationRow) : null;
  }

  /**
   * Creates the application on first submission, or replaces it (clearing any
   * prior rejection) on resubmission — the mobile app's "Modifier mon
   * dossier" flow after a rejection. Also promotes the caller's `profiles`
   * role to 'coiffeur', since that's what submitting one means product-wise.
   */
  async submit(userId: string, dto: SubmitCoiffeurApplicationDto): Promise<CoiffeurApplication> {
    this.assertOwnPath(userId, dto.identityDocumentPath, 'identityDocumentPath');
    this.assertOwnPath(userId, dto.diplomaDocumentPath, 'diplomaDocumentPath');
    this.assertOwnPath(userId, dto.kbisDocumentPath, 'kbisDocumentPath');

    const isSalon = dto.practiceZone === PracticeZone.Salon;
    if (isSalon && !dto.invoiceDocumentPath) {
      throw new BadRequestException('invoiceDocumentPath is required when practiceZone is salon');
    }
    if (isSalon && dto.invoiceDocumentPath) {
      this.assertOwnPath(userId, dto.invoiceDocumentPath, 'invoiceDocumentPath');
    }

    const row = {
      profile_id: userId,
      first_name: dto.firstName.trim(),
      last_name: dto.lastName.trim(),
      phone: dto.phone.trim(),
      salon_name: dto.salonName.trim(),
      description: dto.description?.trim() ?? '',
      practice_zone: dto.practiceZone,
      address_line: isSalon ? (dto.addressLine ?? '').trim() : null,
      postal_code: isSalon ? (dto.postalCode ?? null) : null,
      city: isSalon ? (dto.city ?? '').trim() : null,
      invoice_document_path: isSalon ? (dto.invoiceDocumentPath ?? null) : null,
      travel_radius_km: isSalon ? null : (dto.travelRadiusKm ?? null),
      identity_document_path: dto.identityDocumentPath,
      diploma_document_path: dto.diplomaDocumentPath,
      kbis_document_path: dto.kbisDocumentPath,
      status: 'pending',
      review_message: null,
      submitted_at: new Date().toISOString(),
      reviewed_at: null,
    };

    const { data, error } = await this.supabase.client
      .from('coiffeur_applications')
      .upsert(row, { onConflict: 'profile_id' })
      .select()
      .single();

    if (error) {
      throw new InternalServerErrorException(error.message);
    }

    const { error: roleError } = await this.supabase.client
      .from('profiles')
      .update({ role: 'coiffeur' })
      .eq('id', userId)
      .select()
      .maybeSingle();

    if (roleError) {
      throw new InternalServerErrorException(roleError.message);
    }

    return mapRow(data as CoiffeurApplicationRow);
  }

  /** Issue #7: the mandatory post-approval screen marks itself done here. */
  async completeShopProfile(userId: string): Promise<CoiffeurApplication> {
    const current = await this.getMine(userId);
    if (!current) {
      throw new NotFoundException('No coiffeur application found');
    }
    if (current.status !== 'validated') {
      throw new BadRequestException(
        'The shop profile can only be completed once the application is validated',
      );
    }

    const { data, error } = await this.supabase.client
      .from('coiffeur_applications')
      .update({ shop_profile_complete: true })
      .eq('profile_id', userId)
      .select()
      .single();

    if (error) {
      throw new InternalServerErrorException(error.message);
    }
    return mapRow(data as CoiffeurApplicationRow);
  }

  // ─── Admin ─────────────────────────────────────────────────────────────────

  async listByStatus(
    status: ApplicationStatus | undefined,
    pagination: PaginationOptions,
  ): Promise<CoiffeurApplication[]> {
    let query = this.supabase.client
      .from('coiffeur_applications')
      .select()
      .order('submitted_at', { ascending: true })
      .range(pagination.offset, pagination.offset + pagination.limit - 1);

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;
    if (error) {
      throw new InternalServerErrorException(error.message);
    }
    return (data as CoiffeurApplicationRow[]).map(mapRow);
  }

  async decide(
    applicationId: string,
    decision: ReviewDecision,
    message?: string,
  ): Promise<CoiffeurApplication> {
    const { data, error } = await this.supabase.client
      .from('coiffeur_applications')
      .update({
        status: decision as ApplicationStatus,
        review_message: decision === ReviewDecision.Rejected ? (message ?? null) : null,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', applicationId)
      .select()
      .maybeSingle();

    if (error) {
      throw new InternalServerErrorException(error.message);
    }
    if (!data) {
      throw new NotFoundException('Application not found');
    }
    const application = mapRow(data as CoiffeurApplicationRow);
    this.events.emit('coiffeur-application.decided', {
      applicationId: application.id,
      profileId: application.profileId,
      status: application.status as 'validated' | 'rejected',
      reviewMessage: application.reviewMessage,
    });
    return application;
  }

  /**
   * Storage RLS is the real enforcement (see schema.sql) — this is a cheap
   * server-side sanity check against a client that lies about whose path a
   * document lives at, rejected early as a 400 rather than surfacing whatever
   * error Storage/Postgres would produce downstream.
   */
  private assertOwnPath(userId: string, path: string, field: string): void {
    if (!path.startsWith(`${userId}/`)) {
      throw new BadRequestException(`${field} must be a path under your own storage folder`);
    }
  }
}

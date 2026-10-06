import { apiClient } from "@/lib/apiClient";

/** Mirrors server/src/coiffeur/dto/application.dto.ts exactly. */
export interface CoiffeurApplication {
  id: string;
  profileId: string;
  firstName: string;
  lastName: string;
  phone: string;
  salonName: string;
  description: string;
  practiceZone: "salon" | "domicile";
  addressLine: string | null;
  postalCode: string | null;
  city: string | null;
  invoiceDocumentPath: string | null;
  travelRadiusKm: number | null;
  identityDocumentPath: string;
  diplomaDocumentPath: string;
  kbisDocumentPath: string;
  status: "pending" | "validated" | "rejected";
  reviewMessage: string | null;
  shopProfileComplete: boolean;
  submittedAt: string;
  reviewedAt: string | null;
}

export interface DocumentUrls {
  identity: string | null;
  diploma: string | null;
  kbis: string | null;
  invoice: string | null;
}

/**
 * `limit` is explicit: this endpoint defaults to 20 rows
 * (server/src/common/dto/pagination-query.dto.ts), which silently hid every
 * dossier past the 20th from the admin queue. 100 is that DTO's ceiling —
 * past it this list has to move to real server-side paging rather than the
 * client-side paging `components/admin/Pagination.tsx` does.
 */
export async function listCoiffeurApplications(
  status?: CoiffeurApplication["status"],
): Promise<CoiffeurApplication[]> {
  const { data } = await apiClient.get<CoiffeurApplication[]>(
    "/admin/coiffeur-applications",
    { params: { status, limit: 100 } },
  );
  return data;
}

export async function decideCoiffeurApplication(
  id: string,
  decision: "validated" | "rejected",
  message?: string,
): Promise<CoiffeurApplication> {
  const { data } = await apiClient.patch<CoiffeurApplication>(
    `/admin/coiffeur-applications/${id}/decision`,
    { decision, message },
  );
  return data;
}

export async function getApplicationDocumentUrls(id: string): Promise<DocumentUrls> {
  const { data } = await apiClient.get<DocumentUrls>(
    `/admin/coiffeur-applications/${id}/document-urls`,
  );
  return data;
}

/** Mirrors server/src/reviews/reviews.service.ts's ReviewDto. */
export interface Review {
  id: string;
  appointmentId: string;
  salonId: string;
  authorName: string;
  rating: number;
  tags: string[];
  comment: string;
  reply?: string;
  createdAt: string;
  status: "visible" | "reported" | "hidden";
  /** Whether the reader reported it — always false in the admin's lists. */
  reportedByMe: boolean;
}

/** Why a review was reported — the app's picker (mobile/src/features/reviews/report.ts). */
export type ReportReason = "offensive" | "fake" | "personal_info" | "spam" | "other";

/** Mirrors server/src/reviews/reviews.service.ts's ReviewReportDto. */
export interface ReviewReport {
  reporterId: string;
  /** A client's full name; a salon by its name. */
  reporterName: string;
  reporterRole: "particulier" | "coiffeur" | "admin" | "admin_limited";
  reason: ReportReason;
  details: string | null;
  createdAt: string;
}

/** Mirrors server/src/reviews/reviews.service.ts's ModeratedReviewDto. */
export interface ModeratedReview extends Review {
  salonName: string;
  authorFullName: string;
  /** Oldest first. */
  reports: ReviewReport[];
  /** The latest report's reason as the review keeps it — the only one for reviews reported before each report was kept. */
  reportReason: string | null;
  reportedAt: string | null;
}

export async function listReportedReviews(): Promise<ModeratedReview[]> {
  const { data } = await apiClient.get<ModeratedReview[]>("/admin/reviews/reported");
  return data;
}

/** The reviews the admins hid — one can be put back. */
export async function listHiddenReviews(): Promise<ModeratedReview[]> {
  const { data } = await apiClient.get<ModeratedReview[]>("/admin/reviews/hidden");
  return data;
}

export async function moderateReview(
  id: string,
  decision: "hide" | "restore",
): Promise<void> {
  await apiClient.patch(`/admin/reviews/${id}/moderate`, { decision });
}

/** Mirrors server/src/users/dto/admin-account.dto.ts's AdminAccountDto. */
export interface AdminAccount {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: "particulier" | "coiffeur";
  accountStatus: "active" | "suspended" | "banned";
  createdAt: string;
}

export async function listAccounts(
  role?: AdminAccount["role"],
  search?: string,
): Promise<AdminAccount[]> {
  const { data } = await apiClient.get<AdminAccount[]>("/admin/accounts", {
    params: { role, search },
  });
  return data;
}

export async function setAccountStatus(
  id: string,
  status: AdminAccount["accountStatus"],
): Promise<AdminAccount> {
  const { data } = await apiClient.patch<AdminAccount>(
    `/admin/accounts/${id}/status`,
    { status },
  );
  return data;
}

/**
 * Deletes a client or salon account for good, as its own « Supprimer mon
 * compte » would (a request received by e-mail): bookings to come
 * cancelled and refunded, a salon paid what it's owed. The top admin tier only.
 */
export async function deleteAccount(id: string): Promise<void> {
  await apiClient.delete(`/admin/accounts/${id}`);
}

export async function getAccount(id: string): Promise<AdminAccount> {
  const { data } = await apiClient.get<AdminAccount>(`/admin/accounts/${id}`);
  return data;
}

/** The coiffeur's dossier, looked up by profile id rather than application id — null if they never submitted one. */
export async function getCoiffeurApplicationByProfileId(
  profileId: string,
): Promise<CoiffeurApplication | null> {
  const { data } = await apiClient.get<CoiffeurApplication | null>(
    `/admin/coiffeur-applications/by-profile/${profileId}`,
  );
  return data;
}

/**
 * Uploads through the server (service-role) rather than straight to Supabase
 * Storage — this project's Storage service doesn't resolve `auth.uid()`
 * inside RLS policy checks the way PostgREST does, so a direct authenticated
 * browser upload is rejected regardless of policy. See
 * server/src/admin-media/admin-media.controller.ts.
 */
export async function uploadAdminMedia(file: File): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);
  const { data } = await apiClient.post<{ url: string }>("/admin/media", formData);
  return data.url;
}

/** Mirrors server/src/ad-slots/dto/ad-slot.dto.ts. */
export interface AdSlot {
  id: "home_banner" | "search_results" | "booking_confirmation";
  active: boolean;
  headline: string;
  imageUrl: string | null;
  linkUrl: string | null;
  updatedAt: string;
}

export interface UpdateAdSlotInput {
  active?: boolean;
  headline?: string;
  imageUrl?: string;
  linkUrl?: string;
}

export async function listAdSlots(): Promise<AdSlot[]> {
  const { data } = await apiClient.get<AdSlot[]>("/admin/ad-slots");
  return data;
}

export async function updateAdSlot(id: AdSlot["id"], patch: UpdateAdSlotInput): Promise<AdSlot> {
  const { data } = await apiClient.patch<AdSlot>(`/admin/ad-slots/${id}`, patch);
  return data;
}

/** Mirrors server/src/content/dto/content.dto.ts. */
export interface AppContent {
  key: string;
  heading: string;
  body: string;
  imageUrl: string | null;
  updatedAt: string;
}

export interface UpdateAppContentInput {
  heading?: string;
  body?: string;
  imageUrl?: string;
}

export async function getAppContent(key: string): Promise<AppContent> {
  const { data } = await apiClient.get<AppContent>(`/admin/content/${key}`);
  return data;
}

export async function updateAppContent(
  key: string,
  patch: UpdateAppContentInput,
): Promise<AppContent> {
  const { data } = await apiClient.patch<AppContent>(`/admin/content/${key}`, patch);
  return data;
}

/** Mirrors server/src/appointments/admin-stats.service.ts. */
export type StatsRange = "day" | "week" | "month";

export interface BookingStatsPoint {
  label: string;
  confirmed: number;
  cancelled: number;
  revenue: number;
}

export interface BookingStats {
  range: StatsRange;
  points: BookingStatsPoint[];
}

export async function getBookingStats(range: StatsRange): Promise<BookingStats> {
  const { data } = await apiClient.get<BookingStats>("/admin/stats/bookings", {
    params: { range },
  });
  return data;
}

/** Mirrors server/src/subscriptions/subscriptions.service.ts's AdminSubscriptionSummary. */
export interface AdminSubscriptionSummary {
  profileId: string;
  firstName: string;
  lastName: string;
  email: string;
  plan: "monthly" | "yearly";
  tier: "solo" | "team";
  state: "none" | "trialing" | "active" | "ending" | "past_due" | "incomplete" | "expired";
  /** Stripe's own status; `null` for an offered subscription or none at all. */
  stripeStatus: string | null;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  /** When the salon leaves search if nothing changes. */
  endsAt: string | null;
  /** The customer in Stripe's dashboard (its test side in test mode). */
  stripeCustomerUrl: string | null;
}

export async function listSubscriptions(): Promise<AdminSubscriptionSummary[]> {
  const { data } = await apiClient.get<AdminSubscriptionSummary[]>("/admin/subscriptions");
  return data;
}

/** Mirrors server/src/settings/platform-settings.service.ts. */
export interface PlatformSettings {
  /** Free days a coiffeur's first subscription starts with. */
  trialDays: number;
  /** WorldHair's share of each prestation paid in the app, in percent. */
  commissionPercent: number;
}

/** Mirrors server/src/payments/payments.service.ts's AdminPaymentSummary. */
export interface AdminPayment {
  id: string;
  appointmentId: string;
  createdAt: string;
  clientName: string;
  salonName: string;
  amount: number;
  refundedAmount: number;
  commissionAmount: number;
  transferAmount: number | null;
  transferredAt: string | null;
  status: "requires_payment" | "succeeded" | "canceled";
}

export async function listPayments(): Promise<AdminPayment[]> {
  const { data } = await apiClient.get<AdminPayment[]>("/admin/payments");
  return data;
}

/** Refunds the client — everything left, or `amount` euros — even after the salon was paid (its share is taken back first). */
export async function refundPayment(appointmentId: string, amount?: number): Promise<number> {
  const { data } = await apiClient.post<{ refunded: number }>(
    `/admin/payments/${appointmentId}/refund`,
    amount === undefined ? {} : { amount },
  );
  return data.refunded;
}

export async function getPlatformSettings(): Promise<PlatformSettings> {
  const { data } = await apiClient.get<PlatformSettings>("/admin/settings");
  return data;
}

export async function updatePlatformSettings(patch: Partial<PlatformSettings>): Promise<PlatformSettings> {
  const { data } = await apiClient.patch<PlatformSettings>("/admin/settings", patch);
  return data;
}

/** The list's status filter: `upcoming` is accepted and not over yet, `done` accepted and over. */
export type AdminAppointmentStatusFilter = "pending" | "upcoming" | "done" | "refused" | "cancelled";

/** Mirrors server/src/appointments/admin-appointments.service.ts's AdminAppointmentPayment. */
export interface AdminAppointmentPayment {
  status: AdminPayment["status"];
  amount: number;
  refundedAmount: number;
  commissionAmount: number;
  /** What the salon kept of its payout; `null` until paid out. */
  transferAmount: number | null;
  transferredAt: string | null;
}

/** Mirrors server/src/appointments/admin-appointments.service.ts's AdminAppointmentSummary. */
export interface AdminAppointment {
  id: string;
  startsAt: string;
  durationMin: number;
  serviceName: string;
  price: number;
  status: "pending" | "confirmed" | "done" | "refused" | "cancelled";
  attendance: "attended" | "no_show" | null;
  /** `null` unless cancelled — and on bookings cancelled before it was kept. */
  cancelledBy: "client" | "salon" | "admin" | "system" | null;
  /** An `id` of null: that side deleted their account since (TODO.md Phase 8). */
  salon: { id: string | null; name: string };
  client: { id: string | null; name: string };
  /** `null` for a booking made before payments. */
  payment: AdminAppointmentPayment | null;
  createdAt: string;
}

/** Mirrors server/src/appointments/admin-appointments.service.ts's AdminAppointmentDetail. */
export interface AdminAppointmentDetail extends AdminAppointment {
  services: { serviceId: string | null; name: string; price: number; durationMin: number }[];
  note: string | null;
  cancellationReason: string | null;
  client: { id: string | null; name: string; email: string | null };
  salon: { id: string | null; name: string; phone: string; city: string; email: string | null };
  payment: (AdminAppointmentPayment & { paymentIntentId: string | null }) | null;
  /** Who of the salon's team does it (TODO.md Phase 3); `null` when unknown or gone. */
  staffName: string | null;
  /** The client scanned the end-of-service code on the spot: proof of presence only. `null` otherwise. */
  confirmedByClientAt: string | null;
}

export interface AdminAppointmentFilters {
  status?: AdminAppointmentStatusFilter;
  /** Words of the salon's name. */
  salon?: string;
  /** Words of the client's name. */
  client?: string;
  /** Paris days (YYYY-MM-DD), both included. */
  from?: string;
  to?: string;
}

/** One page of the bookings: `query` from lib/appointments.ts's appointmentQuery. */
export async function listAdminAppointments(
  query: Record<string, string | number>,
): Promise<{ items: AdminAppointment[]; total: number }> {
  const { data } = await apiClient.get<{ items: AdminAppointment[]; total: number }>("/admin/appointments", {
    params: query,
  });
  return data;
}

export async function getAdminAppointment(id: string): Promise<AdminAppointmentDetail> {
  const { data } = await apiClient.get<AdminAppointmentDetail>(`/admin/appointments/${id}`);
  return data;
}

/** Cancels to settle a dispute: both sides are told `reason`, the client refunded all that's left. */
export async function cancelAdminAppointment(
  id: string,
  reason: string,
): Promise<{ refunded: number; refundFailed: boolean }> {
  const { data } = await apiClient.patch<{ refunded: number; refundFailed: boolean }>(
    `/admin/appointments/${id}/cancel`,
    { reason },
  );
  return data;
}

/** Mirrors server/src/admin-users/dto/admin-user.dto.ts. */
export interface AdminUser {
  id: string;
  email: string;
  tier: "admin" | "admin_limited";
  createdAt: string;
}

export async function listAdmins(): Promise<AdminUser[]> {
  const { data } = await apiClient.get<AdminUser[]>("/admin/admins");
  return data;
}

export async function createAdmin(email: string, password: string): Promise<AdminUser> {
  const { data } = await apiClient.post<AdminUser>("/admin/admins", { email, password });
  return data;
}

export async function deleteAdmin(id: string): Promise<void> {
  await apiClient.delete(`/admin/admins/${id}`);
}

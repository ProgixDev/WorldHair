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
}

export async function listReportedReviews(): Promise<Review[]> {
  const { data } = await apiClient.get<Review[]>("/admin/reviews/reported");
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

/** Mirrors server/src/subscriptions/dto/subscription.dto.ts's AdminSubscriptionSummaryDto. */
export interface AdminSubscriptionSummary {
  profileId: string;
  firstName: string;
  lastName: string;
  email: string;
  plan: "monthly" | "yearly";
  status: "trial" | "active" | "cancelled" | "expired" | "not_started";
  trialEndsAt: string | null;
  renewsAt: string | null;
}

export async function listSubscriptions(): Promise<AdminSubscriptionSummary[]> {
  const { data } = await apiClient.get<AdminSubscriptionSummary[]>("/admin/subscriptions");
  return data;
}

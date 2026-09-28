import type { AdminAppointment, AdminAppointmentFilters, AdminAppointmentStatusFilter } from "@/services/adminApi";

/** The status filter's choices, in the order the select lists them. */
export const STATUS_FILTERS: { value: AdminAppointmentStatusFilter; label: string }[] = [
  { value: "pending", label: "Demandes en attente" },
  { value: "upcoming", label: "À venir" },
  { value: "done", label: "Passés" },
  { value: "cancelled", label: "Annulés" },
  { value: "refused", label: "Refusés" },
];

/** The badge of each status. */
export const APPOINTMENT_STATUS_STYLES: Record<AdminAppointment["status"], string> = {
  pending: "bg-[#2a93d5]/15 text-[#2a93d5]",
  confirmed: "bg-[#1f9d55]/15 text-[#1f9d55]",
  done: "bg-white/10 text-[#93a6bc]",
  refused: "bg-[#ff7a70]/15 text-[#ff7a70]",
  cancelled: "bg-[#ff7a70]/15 text-[#ff7a70]",
};

const FILTER_KEYS = ["status", "salon", "client", "from", "to"] as const;

const round2 = (euros: number) => Math.round(euros * 100) / 100;

/** The days the server takes (server/src/appointments/dto/admin-appointments-query.dto.ts) — also the date inputs' bounds. */
export const FIRST_DAY = "2000-01-01";
export const LAST_DAY = "2099-12-31";

/** A real calendar day of this century, written YYYY-MM-DD — what a date input gives. */
function isDay(value: string): boolean {
  if (!/^20\d{2}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

/** The filters filled in, trimmed — blank ones, and days the server would refuse, left out. */
function filledIn(filters: AdminAppointmentFilters): Partial<Record<(typeof FILTER_KEYS)[number], string>> {
  const filled: Partial<Record<(typeof FILTER_KEYS)[number], string>> = {};
  for (const key of FILTER_KEYS) {
    const value = filters[key]?.trim();
    if (!value) continue;
    if ((key === "from" || key === "to") && !isDay(value)) continue;
    filled[key] = value;
  }
  return filled;
}

/** `GET /admin/appointments`'s query: the filters filled in, and the page (1-indexed) as limit/offset. */
export function appointmentQuery(
  filters: AdminAppointmentFilters,
  page: number,
  pageSize: number,
): Record<string, string | number> {
  return { ...filledIn(filters), limit: pageSize, offset: (page - 1) * pageSize };
}

/** The filters as the page's query string — the back button comes back to the same list. */
export function filtersToSearch(filters: AdminAppointmentFilters): string {
  return new URLSearchParams(filledIn(filters)).toString();
}

/** The filters from the page's query string; anything the server would refuse is left out. */
export function filtersFromSearch(search: URLSearchParams): AdminAppointmentFilters {
  const filters: AdminAppointmentFilters = {};
  const status = search.get("status");
  if (STATUS_FILTERS.some((option) => option.value === status)) filters.status = status as AdminAppointmentStatusFilter;
  const salon = search.get("salon")?.trim();
  if (salon) filters.salon = salon;
  const client = search.get("client")?.trim();
  if (client) filters.client = client;
  const from = search.get("from");
  if (from && isDay(from)) filters.from = from;
  const to = search.get("to");
  if (to && isDay(to)) filters.to = to;
  return filters;
}

/** Where a booking stands, in the admin's words — and who cancelled it. */
export function appointmentStatusLabel(
  appointment: Pick<AdminAppointment, "status" | "attendance" | "cancelledBy">,
): string {
  switch (appointment.status) {
    case "pending":
      return "Demande en attente";
    case "confirmed":
      return "Confirmé";
    case "done":
      return appointment.attendance === "no_show" ? "Client absent" : "Terminé";
    case "refused":
      return "Refusé par le salon";
    case "cancelled":
      switch (appointment.cancelledBy) {
        case "client":
          return "Annulé par le client";
        case "salon":
          return "Annulé par le salon";
        case "admin":
          return "Annulé par WorldHair";
        case "system":
          return "Expiré sans réponse";
        default:
          return "Annulé";
      }
  }
}

/** WorldHair may cancel a request or an accepted booking, even one already over (a dispute) — not one cancelled or refused. */
export function canCancel(appointment: Pick<AdminAppointment, "status">): boolean {
  return appointment.status === "pending" || appointment.status === "confirmed" || appointment.status === "done";
}

/**
 * What a cancelled or refused booking still owes its client: a refund Stripe
 * couldn't make at the time. A booking still on is refunded in part from the
 * payments page instead.
 */
export function refundOwed(appointment: Pick<AdminAppointment, "status" | "payment">): number {
  const { payment } = appointment;
  if (appointment.status !== "cancelled" && appointment.status !== "refused") return 0;
  if (!payment || payment.status !== "succeeded") return 0;
  return Math.max(0, round2(payment.amount - payment.refundedAmount));
}

/** Why the server refused a cancellation, for the admin — its answers are in English. */
export function cancelErrorMessage(status: number | undefined, message: string): string {
  if (status === 404) return "Ce rendez-vous n'existe plus.";
  if (status === 400) {
    return message.includes("reason")
      ? "Indiquez un motif d'au moins 3 caractères."
      : "Ce rendez-vous est déjà annulé ou refusé.";
  }
  return "Annulation impossible. Réessayez.";
}

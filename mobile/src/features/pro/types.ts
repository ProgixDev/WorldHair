import type { Service, SpecialtyId } from "../salons/types";

/** The coiffeur's own presentation page, editable from the pro area. */
export interface ProProfile {
  /** Catalogue salon this pro account is attached to (photos, reviews). */
  salonId: string;
  name: string;
  stylist: string;
  tagline: string;
  description: string;
  addressLine: string;
  postalCode: string;
  city: string;
  phone: string;
  specialties: SpecialtyId[];
  /** Locally picked cover photo; falls back to the catalogue image. */
  coverUri?: string | null;
}

/** One weekday of the agenda. Minutes from midnight, `null` when closed. */
export interface AvailabilityDay {
  weekday: number;
  open: boolean;
  opens: number;
  closes: number;
  /** Lunch break — bookings never land inside it. */
  breakStart: number | null;
  breakEnd: number | null;
}

export type ProAppointmentStatus =
  | "pending" // client asked, waiting for the coiffeur
  | "confirmed"
  | "refused"
  | "cancelled" // cancelled by either side
  | "done";

export interface ProAppointment {
  id: string;
  serviceId: string;
  clientName: string;
  /** Seed for the generated avatar. */
  clientId: string;
  startsAt: string;
  durationMin: number;
  price: number;
  status: ProAppointmentStatus;
  /** Free-text request from the client. */
  note?: string;
  /** New client vs regular — shown as a tag on the request card. */
  isNewClient: boolean;
}

export type PlanId = "monthly" | "yearly";

export interface Subscription {
  plan: PlanId;
  status: "trial" | "active" | "cancelled";
  /** ISO — end of the free month. */
  trialEndsAt: string | null;
  /** ISO — next automatic renewal. */
  renewsAt: string;
}

export const PLANS: {
  id: PlanId;
  label: string;
  price: number;
  period: string;
  hint: string;
  saving?: string;
}[] = [
  {
    id: "monthly",
    label: "Mensuel",
    price: 19,
    period: "par mois",
    hint: "Sans engagement, résiliable à tout moment.",
  },
  {
    id: "yearly",
    label: "Annuel",
    price: 182,
    period: "par an",
    hint: "Deux mois offerts par rapport au mensuel.",
    saving: "-20 %",
  },
];

export type ProService = Service;

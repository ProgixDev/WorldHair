import type { CancelledBy } from "../appointments/cancellation";
import type { ConfirmationMode, Service, SpecialtyId } from "../salons/types";

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
  /** National number only, digits — no dial code. Paired with phoneCountry, same split as the signup wizard (ProApplicationContext). */
  phone: string;
  /** ISO 3166-1 alpha-2, e.g. "FR" — which country's dial code/rules `phone` is in. */
  phoneCountry: string;
  specialties: SpecialtyId[];
  /** Locally picked cover photo; falls back to the catalogue image. */
  coverUri?: string | null;
  /** Set when the coiffeur picks their city via CityField — feeds the particulier map/radius search. Null until then. */
  latitude: number | null;
  longitude: number | null;
  /** `instant`: a new booking is confirmed straight away; `manual`: the coiffeur accepts or refuses it. */
  confirmationMode: ConfirmationMode;
  /** How late before its start a client can still book (0 = up to the start). */
  bookingNoticeMinutes: number;
  /** How late before its start a client can still cancel or move an accepted booking (0 = anytime). */
  cancellationNoticeMinutes: number;
  /** The salon's pages elsewhere as typed ("" for none); saved as links (features/pro/links.ts). */
  instagramUrl: string;
  facebookUrl: string;
  tiktokUrl: string;
  websiteUrl: string;
  /** As clients see it — hidden reviews left out. Read-only. */
  rating: number;
  reviewCount: number;
}

/** A congé or exceptional closure: whole days, or a few hours of one day. */
export interface TimeOff {
  id: string;
  startsAt: string;
  endsAt: string;
  /** The coiffeur's own note ("Congés", "Formation"); never shown to clients. */
  label: string;
  /** One person's congé (TODO.md Phase 3); `null`: the whole salon closes. */
  staffId: string | null;
}

/** A booking that falls inside a closure just added — listed so the coiffeur moves or cancels it. */
export interface TimeOffConflict {
  appointmentId: string;
  startsAt: string;
  durationMin: number;
  serviceName: string;
  status: string;
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

/** One prestation of a booking — several run back to back as one appointment. */
export interface ProAppointmentLine {
  serviceId: string | null;
  name: string;
  price: number;
  durationMin: number;
}

/** Set by the coiffeur once an accepted appointment has started. */
export type Attendance = "attended" | "no_show";

export interface ProAppointment {
  id: string;
  /** First prestation (see `services` for all of them). */
  serviceId: string;
  clientName: string;
  /** Seed for the generated avatar; null once the client deleted their account (« Client supprimé »). */
  clientId: string | null;
  startsAt: string;
  /** Total of every prestation. */
  durationMin: number;
  /** Total of every prestation. */
  price: number;
  services: ProAppointmentLine[];
  status: ProAppointmentStatus;
  attendance: Attendance | null;
  /** Free-text request from the client. */
  note?: string;
  /** New client vs regular — shown as a tag on the request card. */
  isNewClient: boolean;
  /** Paid in the app (TODO.md Phase 5); `null` for a booking made before payments. */
  payment: ProPayment | null;
  /** Who cancelled it; `null` unless cancelled. */
  cancelledBy?: CancelledBy | null;
  /** WorldHair's reason, when it cancelled (a dispute). */
  cancellationReason?: string | null;
  /** Who in the salon's team does it (TODO.md Phase 3); `null` for a booking whose person has left. */
  staffId: string | null;
  staffName: string | null;
}

// ─── The salon's team (TODO.md Phase 3) ─────────────────────────────────────

/** Someone of the salon's team: its owner, or a coiffeur who joined with his code. */
export interface StaffMember {
  id: string;
  profileId: string;
  firstName: string;
  lastName: string;
  photoUrl: string | null;
  isOwner: boolean;
  /** Off: clients' bookings never go to them; the owner can still give them one. */
  takesBookings: boolean;
  position: number;
  /** Their own week; `null`: the salon's hours. */
  availability: AvailabilityDay[] | null;
}

/** A code to join the salon: one use, until `expiresAt`. */
export interface SalonInvite {
  code: string;
  expiresAt: string;
  createdAt: string;
}

/** « Qui s'en occupe ? »: someone of the team, free or not at a booking's time. */
export interface StaffCandidate {
  staffId: string;
  firstName: string;
  lastName: string;
  photoUrl: string | null;
  isOwner: boolean;
  free: boolean;
  /** The person the booking has now. */
  held: boolean;
}

/** The salon's side of a booking's payment. */
export interface ProPayment {
  amount: number;
  refundedAmount: number;
  /** WorldHair's commission on what the client kept. */
  commissionAmount: number;
  /** What the salon receives — or received. */
  payoutAmount: number;
  /** When it was sent to the salon's bank account; `null` until a day after the appointment. */
  paidOutAt: string | null;
}

/** Where the salon gets paid: none yet, onboarding unfinished, ready, or the demo salon's exemption. */
export interface PayoutStatus {
  state: "none" | "incomplete" | "ready" | "exempt";
  /** Clients can book and pay in the app. */
  onlineBooking: boolean;
  /** Stripe's Express dashboard (payouts, bank details) can open. */
  canOpenDashboard: boolean;
}

export type PlanId = "monthly" | "yearly";

/** How the server reads the coiffeur's Stripe subscription (server/src/subscriptions/subscription-state.ts). */
export type SubscriptionState =
  | "none"
  | "trialing"
  | "active"
  /** A cancellation is scheduled: listed until `endsAt`. */
  | "ending"
  /** A payment failed and Stripe retries it: still listed meanwhile. */
  | "past_due"
  /** The first payment awaits the coiffeur's confirmation: not listed yet. */
  | "incomplete"
  | "expired";

/**
 * The coiffeur's subscription, read-only in the app: it's sold and managed
 * on the website, through Stripe (TODO.md Phase 4).
 */
export interface Subscription {
  state: SubscriptionState;
  plan: PlanId;
  /** Visible in search and bookable right now. */
  listed: boolean;
  /** Offered without Stripe (demo salons, launch partners). */
  offered: boolean;
  /** ISO — end of the free trial: the first charge. */
  trialEndsAt: string | null;
  /** ISO — next renewal. */
  currentPeriodEnd: string | null;
  /** ISO — when the salon leaves search if nothing changes; `null` while it renews on its own. */
  endsAt: string | null;
}

export type ProService = Service;

/** One "Réalisations" work photo — see pro/salon.tsx and salon/[id].tsx. */
export interface GalleryPhoto {
  id: string;
  url: string;
  storagePath: string;
}

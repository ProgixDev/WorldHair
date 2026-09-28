/** Prestation families — drive the filter chips and the service list. */
export type SpecialtyId =
  "coupe" | "coloration" | "afro" | "tresses" | "barbier" | "soins" | "mariage";

export interface Specialty {
  id: SpecialtyId;
  label: string;
}

export const SPECIALTIES: Specialty[] = [
  { id: "coupe", label: "Coupe" },
  { id: "coloration", label: "Coloration" },
  { id: "afro", label: "Coiffure afro" },
  { id: "tresses", label: "Tresses & locks" },
  { id: "barbier", label: "Barbier" },
  { id: "soins", label: "Soins" },
  { id: "mariage", label: "Mariage" },
];

export function specialtyLabel(id: SpecialtyId): string {
  return SPECIALTIES.find((s) => s.id === id)?.label ?? id;
}

export interface Service {
  id: string;
  name: string;
  /** Euros, TTC. */
  price: number;
  durationMin: number;
  specialty: SpecialtyId;
  description?: string;
  /** The coiffeur's own list only: `false` when hidden from clients. Public services are always visible. */
  isActive?: boolean;
}

export interface Review {
  id: string;
  author: string;
  rating: number;
  /** ISO date. */
  date: string;
  comment: string;
  /** Coiffeur's public answer, when there is one. */
  reply?: string;
  /** The reader already reported it: « Signalé » instead of the button. */
  reportedByMe?: boolean;
  /** The salon's own list only: `hidden` once WorldHair's moderation took it down. */
  status?: "visible" | "reported" | "hidden";
}

export interface OpeningDay {
  /** 0 = Sunday, matching Date#getDay. */
  weekday: number;
  /** Minutes from midnight; `null` when closed. */
  opens: number | null;
  closes: number | null;
  /** Lunch break, minutes from midnight; `null` (or absent) when there's none. */
  breakStart?: number | null;
  breakEnd?: number | null;
}

/** `instant`: a booking is confirmed straight away; `manual`: the salon accepts or refuses it. */
export type ConfirmationMode = "manual" | "instant";

/** The salon's pages elsewhere — icons on its page. */
export interface SocialLinks {
  instagram: string | null;
  facebook: string | null;
  tiktok: string | null;
  website: string | null;
}

/** A congé or exceptional closure — nothing can be booked inside it. */
export interface Closure {
  startsAt: string;
  endsAt: string;
}

export interface Salon {
  id: string;
  name: string;
  /** Person behind the chair — shown under the salon name. */
  stylist: string;
  tagline: string;
  description: string;
  /** Short marketing labels shown as tags ("Nouveau", "Coup de coeur"). */
  badges: string[];
  addressLine: string;
  postalCode: string;
  city: string;
  latitude: number;
  longitude: number;
  rating: number;
  reviewCount: number;
  /** Cheapest service, precomputed for the list cards. */
  priceFrom: number;
  specialties: SpecialtyId[];
  services: Service[];
  reviews: Review[];
  hours: OpeningDay[];
  /** "Réalisations" — work photos the coiffeur curates themselves; empty until they add any. */
  gallery: string[];
  /** Booking rules — only known from the salon's own page (fetchSalonById); list items carry neutral defaults. */
  confirmationMode: ConfirmationMode;
  /** How late before its start the client can still book; 0 = up to the start. */
  bookingNoticeMinutes: number;
  /** How late before its start the client can still cancel or move an accepted booking; 0 = anytime. */
  cancellationNoticeMinutes: number;
  /** Upcoming closures; empty for list items. */
  closures: Closure[];
  /** Bookable and payable in the app (the salon's Stripe payouts are set up). */
  onlineBooking: boolean;
  /** In a salon, or at the client's home within `travelRadiusKm`. */
  practiceZone: "salon" | "domicile";
  travelRadiusKm: number | null;
  /** When it can next take its shortest prestation (ISO), within two weeks; `null` if not bookable online, or full. */
  nextSlot: string | null;
  /** Only known from its own page; all `null` for list items. */
  socialLinks: SocialLinks;
}

/** Salon + everything the UI derives from the user's position. */
export interface SalonWithDistance extends Salon {
  /** Kilometres from the active position. */
  distanceKm: number;
}

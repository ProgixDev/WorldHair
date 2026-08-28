/**
 * Mock ad-zone service (issue #5). The admin back-office will own activation,
 * image and link per placement (see TODO.md's "CRUD zones publicitaires");
 * this file is the seam it replaces. Every slot starts inactive, so nothing
 * renders until an admin turns one on.
 */

const LATENCY_MS = 250;

function delay(ms = LATENCY_MS): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export type AdPlacementId =
  | "home_banner"
  | "search_results"
  | "booking_confirmation";

export interface AdSlot {
  id: AdPlacementId;
  active: boolean;
  headline: string;
  imageUri: string | null;
  linkUrl: string | null;
}

const AD_SLOTS: AdSlot[] = [
  {
    id: "home_banner",
    active: false,
    headline: "Nos partenaires beauté",
    imageUri: null,
    linkUrl: null,
  },
  {
    id: "search_results",
    active: false,
    headline: "Découvrez nos marques partenaires",
    imageUri: null,
    linkUrl: null,
  },
  {
    id: "booking_confirmation",
    active: false,
    headline: "Prenez soin de vos cheveux entre deux rendez-vous",
    imageUri: null,
    linkUrl: null,
  },
];

export async function getAdSlots(): Promise<AdSlot[]> {
  await delay();
  return AD_SLOTS;
}

export async function getAdSlot(id: AdPlacementId): Promise<AdSlot | null> {
  const slots = await getAdSlots();
  return slots.find((slot) => slot.id === id) ?? null;
}

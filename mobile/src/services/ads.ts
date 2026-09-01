import { apiClient } from "../lib/apiClient";

export type AdPlacementId = "home_banner" | "search_results" | "booking_confirmation";

export interface AdSlot {
  id: AdPlacementId;
  active: boolean;
  headline: string;
  imageUri: string | null;
  linkUrl: string | null;
}

interface AdSlotApiResponse {
  id: AdPlacementId;
  active: boolean;
  headline: string;
  imageUrl: string | null;
  linkUrl: string | null;
  updatedAt: string;
}

function mapSlot(row: AdSlotApiResponse): AdSlot {
  return {
    id: row.id,
    active: row.active,
    headline: row.headline,
    imageUri: row.imageUrl,
    linkUrl: row.linkUrl,
  };
}

export async function getAdSlots(): Promise<AdSlot[]> {
  const { data } = await apiClient.get<AdSlotApiResponse[]>("/ad-slots");
  return data.map(mapSlot);
}

export async function getAdSlot(id: AdPlacementId): Promise<AdSlot | null> {
  const slots = await getAdSlots();
  return slots.find((slot) => slot.id === id) ?? null;
}

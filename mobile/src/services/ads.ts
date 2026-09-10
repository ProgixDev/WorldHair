import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
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

/** How often to re-check a focused screen's ad slot for an admin-side change. */
const POLL_INTERVAL_MS = 15_000;

/**
 * The current state of one ad placement, kept fresh without needing a full
 * app restart. A plain one-shot fetch only ever ran once per app session on
 * a tab screen (tabs stay mounted once visited, they don't remount when you
 * switch back), so an admin toggling a slot never showed up until the app
 * was killed and relaunched. This refetches on every focus AND polls every
 * `POLL_INTERVAL_MS` while focused — not true realtime (that would need a
 * Supabase Realtime subscription, which isn't wired up anywhere in this app
 * and needs a database-side publication change too), but close enough for
 * something that changes this rarely, with none of that added complexity.
 */
export function useAdSlot(id: AdPlacementId): AdSlot | null {
  const [slot, setSlot] = useState<AdSlot | null>(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      const refresh = () => {
        getAdSlot(id).then((next) => {
          if (!cancelled) setSlot(next);
        });
      };

      refresh();
      const interval = setInterval(refresh, POLL_INTERVAL_MS);

      return () => {
        cancelled = true;
        clearInterval(interval);
      };
    }, [id]),
  );

  return slot;
}

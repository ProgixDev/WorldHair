import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { addFavorite, fetchFavorites, removeFavorite } from "../features/salons/api";
import type { Salon } from "../features/salons/types";
import { useAuth } from "./AuthContext";
import { useLocation } from "./LocationContext";

interface FavoritesContextValue {
  /** Only a client keeps favorites; the hearts hide for anyone else. */
  enabled: boolean;
  /** The favorite salons, the latest first — the profile's « Favoris ». */
  salons: Salon[];
  isFavorite: (salonId: string) => boolean;
  /** Puts or takes off the heart at once; undone if the server refuses. */
  toggle: (salon: Salon) => Promise<void>;
  refresh: () => Promise<void>;
}

const FavoritesContext = createContext<FavoritesContextValue | undefined>(undefined);

/** "Favoris" (TODO.md Phase 6): one list for the hearts on cards, the salon page and the profile. */
export function FavoritesProvider({ children }: { children: React.ReactNode }) {
  const { session } = useAuth();
  const { coords } = useLocation();
  const enabled = session?.role === "particulier";
  const [salons, setSalons] = useState<Salon[]>([]);
  // Read at call time: the list's distances follow the client without reloading it each move.
  const where = useRef(coords);
  useEffect(() => {
    where.current = coords;
  }, [coords]);

  const refresh = useCallback(async () => {
    if (!enabled) {
      setSalons([]);
      return;
    }
    setSalons(await fetchFavorites(where.current));
  }, [enabled]);

  useEffect(() => {
    refresh().catch(() => {});
  }, [refresh, session?.userId]);

  const ids = useMemo(() => new Set(salons.map((salon) => salon.id)), [salons]);

  const toggle = useCallback(
    async (salon: Salon) => {
      const wasFavorite = ids.has(salon.id);
      setSalons((current) =>
        wasFavorite ? current.filter((item) => item.id !== salon.id) : [salon, ...current],
      );
      try {
        if (wasFavorite) await removeFavorite(salon.id);
        else await addFavorite(salon.id);
      } catch {
        setSalons((current) =>
          wasFavorite ? [salon, ...current.filter((item) => item.id !== salon.id)] : current.filter((item) => item.id !== salon.id),
        );
      }
    },
    [ids],
  );

  const value = useMemo<FavoritesContextValue>(
    () => ({ enabled, salons, isFavorite: (salonId) => ids.has(salonId), toggle, refresh }),
    [enabled, salons, ids, toggle, refresh],
  );

  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>;
}

export function useFavorites(): FavoritesContextValue {
  const value = useContext(FavoritesContext);
  if (!value) throw new Error("useFavorites must be used inside FavoritesProvider");
  return value;
}

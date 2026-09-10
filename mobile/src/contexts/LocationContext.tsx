import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { Coordinates } from "../features/salons/geo";
import { PARIS_CENTER } from "../features/salons/geo";
import {
  peekPermission,
  requestPosition,
  type LocationStatus,
} from "../services/location";
import {
  clearManualCity,
  getManualCity,
  setManualCity as persistManualCity,
} from "../services/preferences";

interface LocationContextValue {
  /** Device position when granted, Paris centre otherwise. */
  coords: Coordinates;
  status: LocationStatus;
  isFallback: boolean;
  isLoading: boolean;
  canAskAgain: boolean;
  /** Prompts (or re-reads) and refreshes the position. */
  enable: () => Promise<void>;
  /** Manual mode: the user picked a city instead of granting GPS. */
  setManualCoords: (coords: Coordinates, label: string) => void;
  manualLabel: string | null;
}

const LocationContext = createContext<LocationContextValue | undefined>(
  undefined,
);

export function LocationProvider({ children }: { children: React.ReactNode }) {
  const [coords, setCoords] = useState<Coordinates>(PARIS_CENTER);
  const [status, setStatus] = useState<LocationStatus>("unknown");
  const [isFallback, setIsFallback] = useState(true);
  const [canAskAgain, setCanAskAgain] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [manualLabel, setManualLabel] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    Promise.all([peekPermission(), getManualCity()]).then(
      ([result, savedCity]) => {
        if (cancelled) return;

        // Live GPS always wins once it's actually granted — a saved manual
        // city only matters while there's nothing better. Still worth
        // reading both in parallel above rather than gating one on the
        // other: whichever branch applies, there's no second AsyncStorage
        // round trip to wait on.
        if (result.status === "granted" && !result.isFallback) {
          setCoords(result.coords);
          setStatus(result.status);
          setIsFallback(result.isFallback);
          setCanAskAgain(result.canAskAgain);
          return;
        }

        if (savedCity) {
          setCoords({ latitude: savedCity.latitude, longitude: savedCity.longitude });
          setManualLabel(savedCity.label);
          setIsFallback(false);
          setStatus("granted");
          setCanAskAgain(result.canAskAgain);
          return;
        }

        setCoords(result.coords);
        setStatus(result.status);
        setIsFallback(result.isFallback);
        setCanAskAgain(result.canAskAgain);
      },
    ).finally(() => {
      if (!cancelled) setIsLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const enable = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await requestPosition();
      setCoords(result.coords);
      setStatus(result.status);
      setIsFallback(result.isFallback);
      setCanAskAgain(result.canAskAgain);
      if (!result.isFallback) {
        // Real GPS now works — any previously saved manual city would only
        // ever be stale from here on, so it's not worth keeping around.
        setManualLabel(null);
        void clearManualCity();
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  const setManualCoords = useCallback((next: Coordinates, label: string) => {
    setCoords(next);
    setManualLabel(label);
    setIsFallback(false);
    setStatus("granted");
    void persistManualCity({ label, latitude: next.latitude, longitude: next.longitude });
  }, []);

  const value = useMemo<LocationContextValue>(
    () => ({
      coords,
      status,
      isFallback,
      isLoading,
      canAskAgain,
      enable,
      setManualCoords,
      manualLabel,
    }),
    [
      coords,
      status,
      isFallback,
      isLoading,
      canAskAgain,
      enable,
      setManualCoords,
      manualLabel,
    ],
  );

  return (
    <LocationContext.Provider value={value}>
      {children}
    </LocationContext.Provider>
  );
}

export function useLocation(): LocationContextValue {
  const context = useContext(LocationContext);
  if (!context)
    throw new Error("useLocation must be used inside a <LocationProvider>.");
  return context;
}

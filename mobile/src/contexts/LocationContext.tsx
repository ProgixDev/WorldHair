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
    peekPermission()
      .then((result) => {
        if (cancelled) return;
        setCoords(result.coords);
        setStatus(result.status);
        setIsFallback(result.isFallback);
        setCanAskAgain(result.canAskAgain);
      })
      .finally(() => {
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
      if (!result.isFallback) setManualLabel(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const setManualCoords = useCallback((next: Coordinates, label: string) => {
    setCoords(next);
    setManualLabel(label);
    setIsFallback(false);
    setStatus("granted");
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

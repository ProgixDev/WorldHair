import React, { createContext, useContext, useMemo, useState } from "react";
import type { PracticeZone, ProDocument } from "../../services/auth";

export interface ProApplicationDraft {
  firstName: string;
  lastName: string;
  phone: string;
  salonName: string;
  description: string;
  practiceZone: PracticeZone;
  addressLine: string;
  postalCode: string;
  city: string;
  travelRadiusKm: string;
  identity: ProDocument | null;
  diploma: ProDocument | null;
  kbis: ProDocument | null;
  invoice: ProDocument | null;
}

const EMPTY_DRAFT: ProApplicationDraft = {
  firstName: "",
  lastName: "",
  phone: "",
  salonName: "",
  description: "",
  practiceZone: "salon",
  addressLine: "",
  postalCode: "",
  city: "",
  travelRadiusKm: "",
  identity: null,
  diploma: null,
  kbis: null,
  invoice: null,
};

interface ProApplicationContextValue {
  draft: ProApplicationDraft;
  update: (patch: Partial<ProApplicationDraft>) => void;
  reset: () => void;
}

const ProApplicationContext = createContext<
  ProApplicationContextValue | undefined
>(undefined);

/** Holds the coiffeur wizard's answers while it spans several screens. */
export function ProApplicationProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [draft, setDraft] = useState<ProApplicationDraft>(EMPTY_DRAFT);

  const value = useMemo<ProApplicationContextValue>(
    () => ({
      draft,
      update: (patch) => setDraft((current) => ({ ...current, ...patch })),
      reset: () => setDraft(EMPTY_DRAFT),
    }),
    [draft],
  );

  return (
    <ProApplicationContext.Provider value={value}>
      {children}
    </ProApplicationContext.Provider>
  );
}

export function useProApplication(): ProApplicationContextValue {
  const context = useContext(ProApplicationContext);
  if (!context)
    throw new Error(
      "useProApplication must be used inside a <ProApplicationProvider>.",
    );
  return context;
}

export const PRO_WIZARD_STEPS = 4;

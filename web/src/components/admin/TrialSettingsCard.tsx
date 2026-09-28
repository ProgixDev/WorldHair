"use client";

import { getPlatformSettings, updatePlatformSettings } from "@/services/adminApi";
import { useEffect, useState } from "react";

/**
 * "Période d'essai paramétrable" (devis): the free days a coiffeur's first
 * subscription starts with, before Stripe's first charge. Applies to the
 * next Checkouts; running trials keep theirs.
 */
export function TrialSettingsCard() {
  const [days, setDays] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getPlatformSettings()
      .then((settings) => {
        setDays(String(settings.trialDays));
        setLoaded(true);
      })
      .catch(() => setError("Impossible de charger la période d'essai."));
  }, []);

  const save = async () => {
    const value = Number(days);
    if (!Number.isInteger(value) || value < 0 || value > 365) {
      setError("Entre 0 et 365 jours.");
      return;
    }
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const saved = await updatePlatformSettings({ trialDays: value });
      setDays(String(saved.trialDays));
      setMessage(
        saved.trialDays === 0
          ? "Plus d'essai gratuit : le premier prélèvement a lieu à l'abonnement."
          : `Les prochains abonnements commencent par ${saved.trialDays} jours gratuits.`,
      );
    } catch {
      setError("Enregistrement impossible. Réessayez.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 rounded-2xl bg-[#111c2e] p-5">
      <div>
        <p className="text-sm font-medium text-[#f2f6fb]">Période d&apos;essai des coiffeurs</p>
        <p className="text-xs text-[#93a6bc]">
          Jours gratuits avant le premier prélèvement, pour un premier abonnement. 0 = pas d&apos;essai.
        </p>
      </div>
      <div className="flex gap-2">
        <label className="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-xl bg-[#080f1a] px-3 focus-within:outline-2 focus-within:outline-[#2a93d5]">
          <input
            type="number"
            min={0}
            max={365}
            inputMode="numeric"
            value={days}
            disabled={!loaded}
            onChange={(event) => setDays(event.target.value)}
            aria-label="Jours d'essai"
            className="min-w-0 flex-1 bg-transparent text-sm text-[#f2f6fb] outline-none"
          />
          <span className="text-xs text-[#93a6bc]">jours</span>
        </label>
        <button
          type="button"
          disabled={!loaded || saving}
          onClick={() => void save()}
          className="h-11 shrink-0 rounded-full bg-[#2a93d5] px-6 text-xs font-medium text-white transition-colors hover:bg-[#2480ba] disabled:opacity-50"
        >
          {saving ? "Enregistrement…" : "Enregistrer"}
        </button>
      </div>
      {error && <p className="text-xs text-[#ff7a70]">{error}</p>}
      {message && <p className="text-xs text-[#1f9d55]">{message}</p>}
    </div>
  );
}

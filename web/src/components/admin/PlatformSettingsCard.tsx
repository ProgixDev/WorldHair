"use client";

import { getPlatformSettings, updatePlatformSettings } from "@/services/adminApi";
import { useEffect, useState } from "react";

/**
 * What WorldHair tunes without a deploy: the free trial of a coiffeur's
 * first subscription ("Période d'essai paramétrable", devis), and the
 * commission kept on each prestation paid in the app (Stripe's card fees
 * come out of it). Both apply from now on — running trials and payments
 * already made keep theirs.
 */
export function PlatformSettingsCard() {
  const [days, setDays] = useState("");
  const [commission, setCommission] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getPlatformSettings()
      .then((settings) => {
        setDays(String(settings.trialDays));
        setCommission(String(settings.commissionPercent).replace(".", ","));
        setLoaded(true);
      })
      .catch(() => setError("Impossible de charger les paramètres."));
  }, []);

  const save = async () => {
    const trialDays = Number(days);
    const commissionPercent = Number(commission.replace(",", "."));
    // An emptied field reads as 0 to Number(): it must never switch trials or the commission off by accident.
    if (days.trim() === "" || !Number.isInteger(trialDays) || trialDays < 0 || trialDays > 365) {
      setError("Période d'essai : entre 0 et 365 jours.");
      return;
    }
    if (commission.trim() === "" || !Number.isFinite(commissionPercent) || commissionPercent < 0 || commissionPercent > 100) {
      setError("Commission : entre 0 et 100 %.");
      return;
    }
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const saved = await updatePlatformSettings({
        trialDays,
        commissionPercent: Math.round(commissionPercent * 100) / 100,
      });
      setDays(String(saved.trialDays));
      setCommission(String(saved.commissionPercent).replace(".", ","));
      setMessage(
        `Enregistré : ${saved.trialDays === 0 ? "pas d'essai gratuit" : `${saved.trialDays} jours d'essai`}, commission de ${String(saved.commissionPercent).replace(".", ",")} % sur les prochains paiements.`,
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
        <p className="text-sm font-medium text-[#f2f6fb]">Abonnements et paiements</p>
        <p className="text-xs text-[#93a6bc]">
          S&apos;appliquent aux prochains abonnements et aux prochains paiements.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs text-[#93a6bc]">Période d&apos;essai des coiffeurs (0 = aucune)</span>
          <span className="flex h-11 items-center gap-2 rounded-xl bg-[#080f1a] px-3 focus-within:outline-2 focus-within:outline-[#2a93d5]">
            <input
              type="number"
              min={0}
              max={365}
              inputMode="numeric"
              value={days}
              disabled={!loaded}
              onChange={(event) => setDays(event.target.value)}
              className="min-w-0 flex-1 bg-transparent text-sm text-[#f2f6fb] outline-none"
            />
            <span className="text-xs text-[#93a6bc]">jours</span>
          </span>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs text-[#93a6bc]">Commission sur les prestations payées</span>
          <span className="flex h-11 items-center gap-2 rounded-xl bg-[#080f1a] px-3 focus-within:outline-2 focus-within:outline-[#2a93d5]">
            <input
              inputMode="decimal"
              value={commission}
              disabled={!loaded}
              onChange={(event) => setCommission(event.target.value)}
              className="min-w-0 flex-1 bg-transparent text-sm text-[#f2f6fb] outline-none"
            />
            <span className="text-xs text-[#93a6bc]">%</span>
          </span>
        </label>
      </div>
      <button
        type="button"
        disabled={!loaded || saving}
        onClick={() => void save()}
        className="h-11 self-start rounded-full bg-[#2a93d5] px-6 text-xs font-medium text-white transition-colors hover:bg-[#2480ba] disabled:opacity-50"
      >
        {saving ? "Enregistrement…" : "Enregistrer"}
      </button>
      {error && <p className="text-xs text-[#ff7a70]">{error}</p>}
      {message && <p className="text-xs text-[#1f9d55]">{message}</p>}
    </div>
  );
}

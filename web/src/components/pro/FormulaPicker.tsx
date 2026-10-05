"use client";

import { Button } from "@/components/ui/Button";
import {
  describePrice,
  PLAN_NAMES,
  priceFor,
  TIER_INFO,
  TIERS,
  tierSaving,
  trialSentence,
} from "@/lib/subscription";
import { cn } from "@/lib/utils";
import type { PlanId, PlanPrice, SubscriptionTier } from "@/services/proApi";

const PLAN_IDS: readonly PlanId[] = ["monthly", "yearly"];

interface FormulaPickerProps {
  prices: PlanPrice[];
  plan: PlanId;
  onPlanChange: (plan: PlanId) => void;
  /** The salon's own formula, highlighted; `null` before a first subscription. */
  currentTier: SubscriptionTier | null;
  trialDays: number;
  /** What is being redirected to, if anything: every button waits meanwhile. */
  redirecting: SubscriptionTier | "portal" | null;
  onChoose: (tier: SubscriptionTier) => void;
}

/**
 * The two formulas (Solo, Équipe) side by side, with one shared Mensuel /
 * Annuel toggle above them: the billing period is a choice about money, the
 * formula one about the salon, and each card has its own way to pay.
 */
export function FormulaPicker({
  prices,
  plan,
  onPlanChange,
  currentTier,
  trialDays,
  redirecting,
  onChoose,
}: FormulaPickerProps) {
  return (
    <div className="flex flex-col gap-3">
      {/* Native radios: arrow keys and focus behave as the browser's own radio group. */}
      <fieldset className="min-w-0">
        <legend className="sr-only">Période de facturation</legend>
        <div className="grid grid-cols-2 gap-1 rounded-xl bg-[#111c2e] p-1 sm:w-fit sm:min-w-64">
          {PLAN_IDS.map((id) => {
            const selected = id === plan;
            return (
              <label
                key={id}
                className={cn(
                  "flex cursor-pointer items-center justify-center rounded-lg px-4 py-2 text-sm font-medium transition-colors",
                  "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[#f2f6fb]",
                  selected ? "bg-[#2a93d5] text-white" : "text-[#93a6bc] hover:text-[#f2f6fb]",
                )}
              >
                <input
                  type="radio"
                  name="billing-plan"
                  value={id}
                  checked={selected}
                  onChange={() => onPlanChange(id)}
                  className="sr-only"
                />
                {PLAN_NAMES[id]}
              </label>
            );
          })}
        </div>
      </fieldset>

      <div className="grid gap-3 sm:grid-cols-2">
        {TIERS.map((tier) => {
          const price = priceFor(prices, tier, plan);
          const display = price ? describePrice(price) : null;
          const saving = plan === "yearly" ? tierSaving(prices, tier) : null;
          const trial = price ? trialSentence(trialDays, price) : "";
          const current = tier === currentTier;
          const headingId = `formula-${tier}`;
          return (
            <article
              key={tier}
              aria-labelledby={headingId}
              className={cn(
                "flex flex-col gap-3 rounded-2xl border bg-[#111c2e] p-5",
                current ? "border-[#2a93d5]" : "border-transparent",
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <h2 id={headingId} className="text-base font-medium text-[#f2f6fb]">
                  {TIER_INFO[tier].name}
                </h2>
                {current && (
                  <span className="rounded-full bg-[#2a93d5]/15 px-2.5 py-0.5 text-xs font-medium text-[#2a93d5]">
                    Votre formule
                  </span>
                )}
              </div>
              <p className="text-sm text-[#93a6bc]">{TIER_INFO[tier].tagline}</p>

              {display ? (
                <div className="flex flex-col gap-1">
                  <p className="flex items-baseline gap-1.5">
                    <span className="text-3xl font-semibold text-[#e4b980]">{display.perMonth}</span>
                    <span className="text-sm text-[#93a6bc]">/ mois</span>
                  </p>
                  {(display.billing || saving) && (
                    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[#93a6bc]">
                      {display.billing}
                      {saving && (
                        <span className="rounded-full bg-[#1f9d55]/15 px-2.5 py-0.5 font-medium text-[#1f9d55]">
                          {saving}
                        </span>
                      )}
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-[#93a6bc]">Tarif indisponible pour le moment.</p>
              )}

              {trial && <p className="text-xs text-[#93a6bc]">{trial}</p>}

              <Button
                type="button"
                disabled={!price || redirecting !== null}
                onClick={() => onChoose(tier)}
                className="mt-auto h-11 rounded-xl bg-[#2a93d5] text-white hover:bg-[#2a93d5]/90 focus-visible:ring-[#f2f6fb]/60"
              >
                {redirecting === tier ? (
                  "Redirection…"
                ) : (
                  <>
                    Continuer vers le paiement<span className="sr-only"> : formule {TIER_INFO[tier].name}</span>
                  </>
                )}
              </Button>
            </article>
          );
        })}
      </div>
    </div>
  );
}

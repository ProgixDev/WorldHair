"use client";

import { useCoiffeurSession } from "@/components/pro/ProAuthGuard";
import { Button } from "@/components/ui/Button";
import { describeMySubscription, yearlySaving } from "@/lib/subscription";
import { cn } from "@/lib/utils";
import { signOutAdmin } from "@/services/adminAuth";
import {
  getMySubscription,
  listPlanPrices,
  type MySubscription,
  openCustomerPortal,
  type PlanId,
  type PlanPrice,
  startCheckout,
} from "@/services/proApi";
import { isAxiosError } from "axios";
import { Check, CreditCard, FileText, Lock, RefreshCw } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

const TONE_STYLES = {
  ok: "border-[#2a93d5] text-[#2a93d5]",
  warning: "border-[#e4b980] text-[#e4b980]",
  danger: "border-[#ff7a70] text-[#ff7a70]",
} as const;

const PLAN_LABELS: Record<PlanId, { name: string; period: string }> = {
  monthly: { name: "Mensuel", period: "par mois" },
  yearly: { name: "Annuel", period: "par an" },
};

function formatPrice(price: PlanPrice): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: price.currency.toUpperCase(),
    maximumFractionDigits: Number.isInteger(price.amount) ? 0 : 2,
  }).format(price.amount);
}

function messageFor(error: unknown): string {
  if (isAxiosError(error) && error.response?.status === 503) {
    return "Le paiement en ligne n'est pas encore disponible. Réessayez plus tard.";
  }
  return "Une erreur est survenue. Réessayez.";
}

/**
 * "Mon abonnement" (TODO.md Phase 4): where a coiffeur subscribes and
 * manages billing — never in the app. Paying happens on Stripe's own pages
 * (Checkout to subscribe, the Customer Portal for plan, card, invoices and
 * cancellation); Stripe's webhooks then update the server.
 */
export default function AbonnementPage() {
  const session = useCoiffeurSession();
  const router = useRouter();
  const [subscription, setSubscription] = useState<MySubscription | null>(null);
  const [prices, setPrices] = useState<PlanPrice[] | null>(null);
  const [plan, setPlan] = useState<PlanId>("monthly");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [redirecting, setRedirecting] = useState(false);
  const [checkout, setCheckout] = useState<"success" | "cancel" | null>(null);

  const load = useCallback(
    () =>
      getMySubscription()
        .then(async (mine) => {
          setSubscription(mine);
          if (mine.state !== "none") setPlan(mine.plan);
          setLoadError(null);
          if (mine.canSubscribe) setPrices(await listPlanPrices());
        })
        .catch((error: unknown) => setLoadError(messageFor(error))),
    [],
  );

  useEffect(() => {
    void load().then(() => {
      // Stripe sends the coiffeur back with ?checkout=success or ?checkout=cancel.
      const value = new URLSearchParams(window.location.search).get("checkout");
      if (value === "success" || value === "cancel") setCheckout(value);
    });
  }, [load]);

  // Back from Checkout, Stripe's webhook can land a few seconds after the coiffeur does.
  const listed = subscription?.listed ?? false;
  useEffect(() => {
    if (checkout !== "success" || listed) return;
    let tries = 0;
    const timer = setInterval(() => {
      tries += 1;
      void getMySubscription()
        .then(setSubscription)
        .catch(() => undefined);
      if (tries >= 10) clearInterval(timer);
    }, 2000);
    return () => clearInterval(timer);
  }, [checkout, listed]);

  const goTo = async (getUrl: () => Promise<string>) => {
    setActionError(null);
    setRedirecting(true);
    try {
      window.location.assign(await getUrl());
    } catch (error) {
      setActionError(messageFor(error));
      setRedirecting(false);
    }
  };

  const signOut = async () => {
    await signOutAdmin();
    router.replace("/login");
  };

  const summary = subscription ? describeMySubscription(subscription) : null;
  const monthly = prices?.find((price) => price.plan === "monthly");
  const yearly = prices?.find((price) => price.plan === "yearly");
  const saving = monthly && yearly ? yearlySaving(monthly.amount, yearly.amount) : null;
  const picked = prices?.find((price) => price.plan === plan);

  return (
    <div className="min-h-screen bg-[#17243a] px-4 py-6 sm:py-10">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
        <header className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Image src="/Logo.png" alt="WorldHair" width={32} height={32} />
            <span className="text-sm font-medium text-[#f2f6fb]">WorldHair Pro</span>
          </div>
          <div className="flex min-w-0 items-center gap-3">
            <span className="hidden truncate text-xs text-[#93a6bc] sm:inline">{session.email}</span>
            <button
              type="button"
              onClick={() => void signOut()}
              className="shrink-0 text-xs text-[#93a6bc] underline-offset-4 hover:text-[#f2f6fb] hover:underline"
            >
              Se déconnecter
            </button>
          </div>
        </header>

        <main className="flex flex-col gap-4 rounded-3xl bg-[#080f1a] p-5 sm:p-8">
          <h1 className="text-xl font-medium text-[#f2f6fb]">Mon abonnement</h1>

          {checkout === "success" && !listed && (
            <p className="rounded-2xl bg-[#1f9d55]/15 p-4 text-sm text-[#1f9d55]">
              Merci ! Votre paiement est enregistré : votre abonnement s&apos;active dans quelques secondes.
            </p>
          )}
          {checkout === "cancel" && (
            <p className="rounded-2xl bg-white/5 p-4 text-sm text-[#93a6bc]">
              Paiement annulé : rien n&apos;a été débité.
            </p>
          )}
          {loadError && (
            <div className="flex items-center justify-between gap-3 rounded-2xl bg-[#ff7a70]/10 p-4">
              <p className="text-sm text-[#ff7a70]">{loadError}</p>
              <button type="button" onClick={() => void load()} aria-label="Réessayer" className="text-[#ff7a70]">
                <RefreshCw className="size-4" />
              </button>
            </div>
          )}
          {!subscription && !loadError && <p className="py-8 text-center text-sm text-[#93a6bc]">Chargement…</p>}

          {subscription && summary && (
            <>
              <section className={cn("flex flex-col gap-2 rounded-2xl border bg-[#111c2e] p-5", TONE_STYLES[summary.tone])}>
                <p className="text-base font-medium">{summary.title}</p>
                <p className="text-sm text-[#93a6bc]">{summary.detail}</p>
                <p className="text-xs text-[#93a6bc]">
                  Visible dans la recherche :{" "}
                  <span className={subscription.listed ? "text-[#1f9d55]" : "text-[#ff7a70]"}>
                    {subscription.listed ? "oui" : "non"}
                  </span>
                </p>
              </section>

              {subscription.canSubscribe && (
                <section className="flex flex-col gap-3">
                  <p className="text-sm font-medium text-[#f2f6fb]">Choisissez votre formule</p>
                  {!prices && !actionError && <p className="text-sm text-[#93a6bc]">Chargement des tarifs…</p>}
                  {prices && (
                    <div role="radiogroup" className="grid gap-3 sm:grid-cols-2">
                      {prices.map((price) => {
                        const selected = price.plan === plan;
                        return (
                          <button
                            key={price.plan}
                            type="button"
                            role="radio"
                            aria-checked={selected}
                            onClick={() => setPlan(price.plan)}
                            className={cn(
                              "flex flex-col items-start gap-1 rounded-2xl border bg-[#111c2e] p-5 text-left transition-colors",
                              selected ? "border-[#2a93d5]" : "border-transparent hover:border-[#1e2e45]",
                            )}
                          >
                            <span className="flex w-full items-center justify-between text-sm font-medium text-[#f2f6fb]">
                              {PLAN_LABELS[price.plan].name}
                              {selected && <Check className="size-4 text-[#2a93d5]" />}
                            </span>
                            <span className="text-2xl font-semibold text-[#e4b980]">{formatPrice(price)}</span>
                            <span className="text-xs text-[#93a6bc]">
                              {PLAN_LABELS[price.plan].period}
                              {price.plan === "yearly" && saving ? ` · ${saving}` : ""}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                  <p className="text-xs text-[#93a6bc]">
                    {subscription.trialDays > 0 && picked
                      ? `${subscription.trialDays} jours d'essai gratuit, puis ${formatPrice(picked)} ${PLAN_LABELS[plan].period}. `
                      : ""}
                    Sans engagement : résiliable à tout moment, jusqu&apos;à la fin de la période payée.
                  </p>
                  <Button
                    type="button"
                    disabled={!picked || redirecting}
                    onClick={() => void goTo(() => startCheckout(plan))}
                    className="h-11 rounded-xl bg-[#2a93d5] text-white hover:bg-[#2a93d5]/90"
                  >
                    {redirecting ? "Redirection…" : "Continuer vers le paiement"}
                  </Button>
                </section>
              )}

              {subscription.canManage && (
                <section className="flex flex-col gap-3 rounded-2xl bg-[#111c2e] p-5">
                  <p className="text-sm font-medium text-[#f2f6fb]">Gérer mon abonnement</p>
                  <ul className="flex flex-col gap-2 text-sm text-[#93a6bc]">
                    <li className="flex items-center gap-2">
                      <RefreshCw className="size-4 shrink-0" /> Changer de formule, réactiver ou résilier
                    </li>
                    <li className="flex items-center gap-2">
                      <CreditCard className="size-4 shrink-0" /> Mettre à jour votre carte bancaire
                    </li>
                    <li className="flex items-center gap-2">
                      <FileText className="size-4 shrink-0" /> Télécharger vos factures
                    </li>
                  </ul>
                  <Button
                    type="button"
                    disabled={redirecting}
                    onClick={() => void goTo(openCustomerPortal)}
                    className={cn(
                      "h-11 rounded-xl text-white",
                      subscription.state === "past_due"
                        ? "bg-[#ff7a70] hover:bg-[#ff7a70]/90"
                        : "bg-[#2a93d5] hover:bg-[#2a93d5]/90",
                    )}
                  >
                    {redirecting
                      ? "Redirection…"
                      : subscription.state === "past_due"
                        ? "Mettre à jour ma carte"
                        : "Ouvrir la gestion de l'abonnement"}
                  </Button>
                </section>
              )}

              {actionError && <p className="text-sm text-[#ff7a70]">{actionError}</p>}

              <p className="flex items-center gap-2 text-xs text-[#93a6bc]">
                <Lock className="size-3.5 shrink-0" />
                Paiement sécurisé par Stripe : vos données bancaires ne transitent jamais par WorldHair.
              </p>
            </>
          )}
        </main>
      </div>
    </div>
  );
}

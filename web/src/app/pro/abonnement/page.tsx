"use client";

import { FormulaPicker } from "@/components/pro/FormulaPicker";
import { useCoiffeurSession } from "@/components/pro/ProAuthGuard";
import { Button } from "@/components/ui/Button";
import { describeFormula, describeMySubscription } from "@/lib/subscription";
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
  type SubscriptionTier,
} from "@/services/proApi";
import { isAxiosError } from "axios";
import { CreditCard, FileText, Lock, RefreshCw } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

const TONE_STYLES = {
  ok: "border-[#2a93d5] text-[#2a93d5]",
  warning: "border-[#e4b980] text-[#e4b980]",
  danger: "border-[#ff7a70] text-[#ff7a70]",
} as const;

function messageFor(error: unknown): string {
  const status = isAxiosError(error) ? error.response?.status : undefined;
  if (status === 503) return "Le paiement en ligne n'est pas encore disponible. Réessayez plus tard.";
  if (status === 400) return "Vous avez déjà un abonnement en cours : gérez-le depuis cette page.";
  if (status === 403) return "Votre dossier doit d'abord être validé par l'équipe WorldHair.";
  return "Une erreur est survenue. Réessayez.";
}

/** How long to wait for Stripe's webhook after Checkout before saying so. */
const ACTIVATION_POLLS = 15;

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
  // What the coiffeur is being sent to: a formula's Checkout, or the Customer Portal.
  const [redirecting, setRedirecting] = useState<SubscriptionTier | "portal" | null>(null);
  const [checkout, setCheckout] = useState<"success" | "cancel" | null>(null);
  const [activationSlow, setActivationSlow] = useState(false);

  const load = useCallback(
    () =>
      getMySubscription()
        .then(async (mine) => {
          setSubscription(mine);
          // A salon that has subscribed sees its own billing period (and formula, highlighted) first.
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

  // Back from Checkout, Stripe's webhook can land a few seconds after the coiffeur does:
  // until the Stripe subscription shows up, the page waits — and offers no second payment.
  const managed = subscription?.canManage ?? false;
  const activating = checkout === "success" && !managed;
  useEffect(() => {
    if (!activating) return;
    let tries = 0;
    const timer = setInterval(() => {
      tries += 1;
      void getMySubscription()
        .then(setSubscription)
        .catch(() => undefined);
      if (tries >= ACTIVATION_POLLS) {
        clearInterval(timer);
        setActivationSlow(true);
      }
    }, 2000);
    return () => clearInterval(timer);
  }, [activating]);

  const goTo = async (target: SubscriptionTier | "portal", getUrl: () => Promise<string>) => {
    setActionError(null);
    setRedirecting(target);
    try {
      window.location.assign(await getUrl());
    } catch (error) {
      setActionError(messageFor(error));
      setRedirecting(null);
    }
  };

  const signOut = async () => {
    await signOutAdmin();
    router.replace("/login");
  };

  const summary = subscription ? describeMySubscription(subscription) : null;
  const formula = subscription ? describeFormula(subscription) : null;

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

          {activating && (
            <p className="rounded-2xl bg-[#1f9d55]/15 p-4 text-sm text-[#1f9d55]">
              {activationSlow
                ? "Paiement enregistré. L'activation prend plus de temps que prévu : rechargez cette page dans une minute."
                : "Merci ! Votre paiement est enregistré : votre abonnement s'active dans quelques secondes."}
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
                {formula && <p className="text-sm font-medium text-[#f2f6fb]">{formula}</p>}
                <p className="text-sm text-[#93a6bc]">{summary.detail}</p>
                <p className="text-xs text-[#93a6bc]">
                  Visible dans la recherche :{" "}
                  <span className={subscription.listed ? "text-[#1f9d55]" : "text-[#ff7a70]"}>
                    {subscription.listed ? "oui" : "non"}
                  </span>
                </p>
              </section>

              {subscription.canSubscribe && !activating && (
                <section className="flex flex-col gap-3">
                  <p className="text-sm font-medium text-[#f2f6fb]">Choisissez votre formule</p>
                  {!prices && !actionError && <p className="text-sm text-[#93a6bc]">Chargement des tarifs…</p>}
                  {prices && (
                    <FormulaPicker
                      prices={prices}
                      plan={plan}
                      onPlanChange={setPlan}
                      currentTier={subscription.state !== "none" ? subscription.tier : null}
                      trialDays={subscription.trialDays}
                      redirecting={redirecting}
                      onChoose={(tier) => void goTo(tier, () => startCheckout(tier, plan))}
                    />
                  )}
                  <p className="text-xs text-[#93a6bc]">
                    Sans engagement : résiliable à tout moment, jusqu&apos;à la fin de la période payée.
                  </p>
                </section>
              )}

              {subscription.canManage && (
                <section className="flex flex-col gap-3 rounded-2xl bg-[#111c2e] p-5">
                  <p className="text-sm font-medium text-[#f2f6fb]">Gérer mon abonnement</p>
                  <ul className="flex flex-col gap-2 text-sm text-[#93a6bc]">
                    <li className="flex items-center gap-2">
                      <RefreshCw className="size-4 shrink-0" /> Changer de formule (Solo ou Équipe) ou de période, réactiver ou résilier
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
                    disabled={redirecting !== null}
                    onClick={() => void goTo("portal", openCustomerPortal)}
                    className={cn(
                      "h-11 rounded-xl text-white",
                      subscription.state === "past_due"
                        ? "bg-[#ff7a70] hover:bg-[#ff7a70]/90"
                        : "bg-[#2a93d5] hover:bg-[#2a93d5]/90",
                    )}
                  >
                    {redirecting === "portal"
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

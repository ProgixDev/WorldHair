import type { Metadata } from "next";
import Image from "next/image";
import { BackToApp } from "./BackToApp";

export const metadata: Metadata = {
  title: "Paiements — WorldHair",
  robots: { index: false, follow: false },
};

/**
 * Where Stripe's payout onboarding (Stripe Connect) comes back to, in the
 * browser the coiffeur's app opened: `etat=termine` when they left the form,
 * `etat=expire` when its link ran out. Either way the app takes over and
 * reads the result from Stripe itself.
 */
export default async function ConnectReturnPage({ searchParams }: { searchParams: Promise<{ etat?: string }> }) {
  const { etat } = await searchParams;
  const expired = etat === "expire";

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#17243a] px-4">
      <div className="flex w-full max-w-sm flex-col items-center gap-4 rounded-3xl bg-[#080f1a] p-8 text-center">
        <Image src="/Logo.png" alt="WorldHair" width={40} height={40} />
        <h1 className="text-lg font-medium text-[#f2f6fb]">
          {expired ? "Lien expiré" : "C'est noté"}
        </h1>
        <p className="text-sm text-[#93a6bc]">
          {expired
            ? "Ce lien de configuration a expiré. Relancez « Configurer mes paiements » depuis l'application."
            : "Retournez dans l'application WorldHair : l'écran Paiements affiche où en est votre configuration."}
        </p>
        <BackToApp />
      </div>
    </div>
  );
}

import type { Metadata } from "next";
import Image from "next/image";
import { BackToApp } from "@/components/BackToApp";

export const metadata: Metadata = {
  title: "Paiement — WorldHair",
  robots: { index: false, follow: false },
};

/**
 * Where Stripe's payment page sends a client back, in the browser the app
 * opened for a booking: `etat=paye` once paid, `etat=annule` when they gave
 * up. The app's booking screen (mobile/src/app/booking/[salonId].tsx) is
 * waiting for this link, and asks the server what Stripe says.
 */
export default async function PaymentReturnPage({ searchParams }: { searchParams: Promise<{ etat?: string }> }) {
  const { etat } = await searchParams;
  const paid = etat === "paye";

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#17243a] px-4">
      <div className="flex w-full max-w-sm flex-col items-center gap-4 rounded-3xl bg-[#080f1a] p-8 text-center">
        <Image src="/Logo.png" alt="WorldHair" width={40} height={40} />
        <h1 className="text-lg font-medium text-[#f2f6fb]">{paid ? "Paiement reçu" : "Paiement annulé"}</h1>
        <p className="text-sm text-[#93a6bc]">
          {paid
            ? "Retournez dans l'application WorldHair : votre demande part au salon."
            : "Rien n'a été débité. Retournez dans l'application WorldHair pour réessayer ou choisir un autre créneau."}
        </p>
        <BackToApp href={`worldhair://paiement-retour?etat=${paid ? "paye" : "annule"}`} />
      </div>
    </div>
  );
}

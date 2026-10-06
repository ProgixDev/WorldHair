import type { Metadata } from "next";
import Image from "next/image";
import { BackToApp } from "@/components/BackToApp";
import { normalizePresenceCode, presenceAppUrl } from "@/lib/presence";

export const metadata: Metadata = {
  title: "Confirmer mon rendez-vous — WorldHair",
  robots: { index: false, follow: false },
};

/**
 * The page the salon's end-of-service QR code opens (« code de fin »): the
 * client scans it with their phone's camera, and it hands over to the app,
 * which confirms with the server. No server call here — the code must not be
 * spent by merely looking at the page.
 */
export default async function PresencePage({ params }: { params: Promise<{ code: string }> }) {
  const code = normalizePresenceCode((await params).code);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#17243a] px-4">
      <div className="flex w-full max-w-sm flex-col items-center gap-4 rounded-3xl bg-[#080f1a] p-8 text-center">
        <Image src="/Logo.png" alt="WorldHair" width={40} height={40} />
        {code ? (
          <>
            <h1 className="text-lg font-medium text-[#f2f6fb]">Confirmer mon rendez-vous</h1>
            <p className="text-sm text-[#93a6bc]">
              Ouvrez WorldHair pour confirmer que votre prestation a bien eu lieu. Cela ne change rien à votre
              paiement.
            </p>
            <BackToApp href={presenceAppUrl(code)} label="Ouvrir dans l'application" />
            <p className="text-xs text-[#5b7186]">
              L&apos;application ne s&apos;ouvre pas ? Installez WorldHair, connectez-vous avec le compte qui a
              réservé, puis scannez de nouveau le code.
            </p>
          </>
        ) : (
          <>
            <h1 className="text-lg font-medium text-[#f2f6fb]">Lien invalide</h1>
            <p className="text-sm text-[#93a6bc]">
              Ce lien n&apos;est pas un code de fin de rendez-vous valable. Demandez au salon d&apos;afficher un
              nouveau code et scannez-le de nouveau.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

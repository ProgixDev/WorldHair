import type { Metadata } from "next";
import Image from "next/image";
import { BackToApp } from "@/components/BackToApp";
import { fetchInvite, inviteAppUrl, normalizeInviteCode } from "@/lib/invite";

export const metadata: Metadata = {
  title: "Rejoindre un salon — WorldHair",
  robots: { index: false, follow: false },
};

const dateFormat = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", timeZone: "Europe/Paris" });

/**
 * The link (or QR code) a salon owner shares to bring a coiffeur into his
 * team (TODO.md Phase 3): opens the app on « Rejoindre un salon » with the
 * code in. Without the app, the code is here to type once it's installed.
 */
export default async function JoinSalonPage({ params }: { params: Promise<{ code: string }> }) {
  const code = normalizeInviteCode((await params).code);
  const invite = code ? await fetchInvite(code) : null;

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#17243a] px-4">
      <div className="flex w-full max-w-sm flex-col items-center gap-4 rounded-3xl bg-[#080f1a] p-8 text-center">
        <Image src="/Logo.png" alt="WorldHair" width={40} height={40} />
        {invite ? (
          <>
            <h1 className="text-lg font-medium text-[#f2f6fb]">Rejoindre l&apos;équipe de {invite.salonName}</h1>
            <p className="text-sm text-[#93a6bc]">
              Ouvrez WorldHair : le code est déjà rempli. Pas encore de compte ? Créez-le en choisissant
              « Coiffeur », puis « Rejoindre un salon ».
            </p>
            <p
              className="rounded-2xl bg-[#17243a] px-6 py-3 font-mono text-3xl tracking-[0.3em] text-[#f2f6fb]"
              aria-label={`Code ${invite.code.split("").join(" ")}`}
            >
              {invite.code}
            </p>
            <p className="text-xs text-[#5b7186]">Valable jusqu&apos;au {dateFormat.format(new Date(invite.expiresAt))}, une seule fois.</p>
            <BackToApp href={inviteAppUrl(invite.code)} label="Ouvrir dans l'application" />
            <p className="text-xs text-[#5b7186]">
              L&apos;application ne s&apos;ouvre pas ? Installez WorldHair, puis entrez ce code dans « Rejoindre un salon ».
            </p>
          </>
        ) : (
          <>
            <h1 className="text-lg font-medium text-[#f2f6fb]">Lien expiré</h1>
            <p className="text-sm text-[#93a6bc]">
              Ce code n&apos;existe pas, a déjà servi ou a expiré. Demandez-en un nouveau au salon : Équipe › Inviter
              un coiffeur, dans son application.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

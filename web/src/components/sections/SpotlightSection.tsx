import { Image as ImageIcon } from "lucide-react";

/**
 * Always dark, same fixed-per-section approach as HeroSection.tsx — see its
 * doc comment.
 */
export function SpotlightSection() {
  return (
    <section id="coiffeurs" className="bg-[#080f1a] text-[#f2f6fb]">
      <div className="mx-auto grid max-w-6xl sm:grid-cols-2">
        <div className="flex aspect-4/3 items-center justify-center bg-[#0c1524] sm:aspect-auto">
          <ImageIcon className="size-16 text-[#93a6bc]/40" />
        </div>

        <div className="flex flex-col justify-center gap-5 px-4 py-14 sm:px-10 sm:py-20">
          <h2 className="font-heading text-3xl font-semibold text-balance sm:text-4xl">
            Développez votre clientèle sans effort administratif
          </h2>
          <p className="text-pretty text-[#93a6bc]">
            Votre salon, vos prestations et vos horaires centralisés dans un
            seul espace pro — WorldHair s&apos;occupe de la mise en relation,
            des demandes de rendez-vous jusqu&apos;aux avis clients.
          </p>
        </div>
      </div>
    </section>
  );
}

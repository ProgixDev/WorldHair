import Image from "next/image";

/**
 * Pitches ad space inside the app to businesses, not the coiffeur/particulier
 * audience the rest of the page targets. Same fixed-dark-band technique as
 * HeroSection.tsx — full-bleed background photo, a gradient scrim so text
 * stays legible over it, content pinned to one side — reused here to match a
 * reference composition with copy on the left against a travertine backdrop.
 */
export function PartnerSection() {
  return (
    <section
      id="partenaires"
      className="relative isolate mt-10 flex items-center overflow-hidden text-white sm:mt-24 sm:min-h-[38rem] lg:min-h-[46rem]"
    >
      <Image
        src="/images/worldhair-partner-travertine-background.png"
        alt=""
        fill
        sizes="100vw"
        className="-z-20 object-cover"
      />
      <div className="absolute inset-0 -z-10 bg-linear-to-r from-black/80 via-black/40 to-transparent" />

      <div className="mx-auto w-full max-w-[1680px] px-4 py-14 sm:px-6 sm:py-24">
        <div className="flex max-w-xl flex-col items-start gap-5">
          <p className="text-xs font-bold tracking-[0.08em] text-[#d9b579] uppercase">
            Espace partenaire
          </p>
          <h2 className="text-3xl text-balance sm:text-5xl lg:text-6xl">
            Faites <span className="text-[#d9b579]">rayonner</span> votre
            marque.
          </h2>
          <p className="max-w-md text-sm text-pretty text-white/80">
            Votre marque, vos offres ou votre nouvelle boutique, mises en
            avant auprès de milliers de particuliers et de coiffeurs actifs
            sur l&apos;application. Formats et emplacements publicitaires sur
            mesure, adaptés à votre budget.
          </p>

          <a
            href="mailto:partenariats@worldhair.fr"
            className="mt-2 h-auto rounded-full border border-[#d9b579] px-6 py-3 text-[11px] font-bold tracking-[0.08em] text-white uppercase transition-colors hover:bg-[#d9b579]/10"
          >
            Je veux devenir partenaire
          </a>
        </div>
      </div>
    </section>
  );
}

import { Button } from "@/components/ui/Button";
import { ArrowRight } from "lucide-react";
import Image from "next/image";

/**
 * Always dark, same fixed-per-section approach as HeroSection.tsx — see its
 * doc comment.
 */
export function SpotlightSection() {
  return (
    <section id="coiffeurs" className="scroll-mt-16 bg-[#080f1a] text-[#f2f6fb]">
      <div className="mx-auto grid max-w-[1680px] sm:grid-cols-2 sm:min-h-[38rem] lg:min-h-[46rem]">
        <div className="relative aspect-4/3 sm:aspect-auto">
          <Image
            src="/images/SpotlightSectionMainPicture.png"
            alt=""
            fill
            sizes="(min-width: 640px) 50vw, 100vw"
            className="object-cover"
          />
        </div>

        <div className="flex flex-col justify-center gap-8 px-4 py-14 sm:gap-12 sm:px-10 sm:py-28">
          <h2 className="text-3xl font-normal text-balance uppercase sm:text-5xl">
            Développez votre clientèle, sans effort administratif.
          </h2>
          <div className="flex flex-col gap-4 text-sm">
            <p className="text-pretty text-[#93a6bc]">
              Votre salon, vos prestations et vos horaires centralisés dans un
              seul espace pro — WorldHair s&apos;occupe de la mise en
              relation, des demandes de rendez-vous jusqu&apos;aux avis
              clients.
            </p>
            <p className="text-pretty text-[#93a6bc]">
              Chaque nouvelle demande, confirmation ou annulation vous est
              signalée en temps réel, et vos clients reçoivent leurs rappels
              automatiquement — pour vous concentrer sur ce qui compte :
              votre travail.
            </p>
            <p className="text-pretty text-[#93a6bc]">
              Une fois votre dossier validé, votre profil devient visible aux
              particuliers autour de vous — photos, prestations, horaires et
              avis vérifiés, le tout mis à jour depuis votre espace pro,
              sans jamais passer par un tiers.
            </p>
            <p className="text-pretty text-[#93a6bc]">
              Chaque avis publié provient d&apos;un rendez-vous réellement
              effectué : une réputation qui se construit sur des preuves,
              pas sur des promesses.
            </p>
          </div>

          <Button
            asChild
            size="lg"
            className="h-auto w-fit rounded-full bg-white px-3 py-2 pl-5 text-[11px] font-bold tracking-[0.08em] text-[#0c2340] uppercase hover:bg-white/90"
          >
            <a href="#telecharger">
              Rejoindre WorldHair
              <span className="grid size-7 place-items-center rounded-full bg-[#0c2340] text-base text-white">
                <ArrowRight className="size-4" aria-hidden="true" />
              </span>
            </a>
          </Button>
        </div>
      </div>
    </section>
  );
}

import { Star } from "lucide-react";
import Image from "next/image";

const PRESTATIONS = [
  {
    name: "Coupe & brushing",
    rating: 5,
    image: "/images/HighlightsSectionCoupeBrushing.png",
  },
  {
    name: "Coloration",
    rating: 5,
    image: "/images/HighlightsSectionColoration.png",
  },
  {
    name: "Soin capillaire",
    rating: 4,
    image: "/images/HighlightsSectionSoinCapillaire.png",
  },
] as const;

export function HighlightsSection() {
  return (
    <section id="fonctionnalites" className="bg-background mt-10 scroll-mt-10 sm:mt-24">
      <div className="mx-auto max-w-[1680px] px-4 py-12 sm:px-6 sm:py-20">
        <div>
          <h2 className="text-primary text-2xl font-thin tracking-tight text-balance uppercase sm:text-5xl sm:whitespace-nowrap lg:text-6xl">
            Vos cheveux, notre priorité.
          </h2>
          <p className="text-muted-foreground mt-3 max-w-xl text-sm text-pretty">
            Un aperçu des prestations les plus réservées sur WorldHair, notées
            par de vrais rendez-vous.
          </p>
        </div>

        <div className="border-border mt-8 grid overflow-hidden rounded-2xl border sm:mt-12 sm:grid-cols-3 sm:divide-x">
          {PRESTATIONS.map((prestation) => (
            <div
              key={prestation.name}
              className="border-border flex flex-col gap-4 border-t p-6 first:border-t-0 sm:border-t-0"
            >
              <div className="relative aspect-square overflow-hidden rounded-xl">
                <Image
                  src={prestation.image}
                  alt={prestation.name}
                  fill
                  sizes="(min-width: 640px) 33vw, 100vw"
                  className="object-cover"
                />
              </div>

              <span className="font-medium">{prestation.name}</span>

              <div className="flex items-center gap-0.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    className={
                      i < prestation.rating
                        ? "text-primary size-4 fill-current"
                        : "text-muted-foreground/30 size-4 fill-current"
                    }
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

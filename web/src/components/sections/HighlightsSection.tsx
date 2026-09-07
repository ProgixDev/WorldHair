import { Star } from "lucide-react";
import Image from "next/image";

const PRESTATIONS = [
  {
    name: "Coupe & brushing",
    rating: 5,
    image: "/images/HighlightsSectionCoupeBrushing.png",
    description: "Coupe personnalisée et brushing fini par un coiffeur près de chez vous.",
  },
  {
    name: "Coloration",
    rating: 5,
    image: "/images/HighlightsSectionColoration.png",
    description: "Balayage, coloration ou patine, adaptés à votre nature de cheveux.",
  },
  {
    name: "Soin capillaire",
    rating: 4,
    image: "/images/HighlightsSectionSoinCapillaire.png",
    description: "Soins réparateurs et hydratants pour des cheveux en meilleure santé.",
  },
  {
    name: "Coupe barbier",
    rating: 5,
    image: "/images/worldhair-barber-cut.png",
    description: "Coupe, dégradé et taille de barbe par un barbier expérimenté.",
  },
] as const;

/** Diverse set of real client photos generated from the prompts handed over
 *  earlier — proof of the range of hair types and clients WorldHair serves.
 *  The array is duplicated at render time so the marquee can loop seamlessly
 *  at the halfway mark. */
const GALLERY = [
  { alt: "Coiffure en locks", image: "/images/worldhair-locs.png" },
  { alt: "Tresses africaines", image: "/images/worldhair-african-braids.png" },
  { alt: "Cheveux européens lisses", image: "/images/worldhair-european-straight-hair.png" },
  { alt: "Cheveux crépus", image: "/images/worldhair-kinky-coily-hair.png" },
  { alt: "Cheveux indo-pakistanais épais et raides", image: "/images/worldhair-indo-pakistani-thick-straight-hair.png" },
  { alt: "Dégradé homme (edge-up)", image: "/images/worldhair-mens-edge-up.png" },
  { alt: "Brushing femme", image: "/images/worldhair-womens-blow-dry.png" },
  { alt: "Coupe homme afro", image: "/images/worldhair-mens-afro-cut.png" },
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

        <div className="mt-8 grid gap-4 sm:mt-12 sm:grid-cols-2 lg:grid-cols-4">
          {PRESTATIONS.map((prestation) => (
            <div
              key={prestation.name}
              className="border-border flex flex-col gap-4 rounded-2xl border p-6"
            >
              <div className="relative aspect-square overflow-hidden rounded-xl">
                <Image
                  src={prestation.image}
                  alt={prestation.name}
                  fill
                  sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
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

              <p className="text-muted-foreground text-sm text-pretty">
                {prestation.description}
              </p>
            </div>
          ))}
        </div>

        {/* Continuous drift, not a paginated carousel — nothing to click,
            just proof of the range of hair types and clients WorldHair
            serves. The list is rendered twice back to back and the
            animation travels exactly half the track width, so the seam
            between the two copies is invisible mid-loop. */}
        <div
          className="mt-10 overflow-hidden sm:mt-14"
          style={{ maskImage: "linear-gradient(to right, transparent, black 8%, black 92%, transparent)" }}
        >
          <div className="animate-marquee flex w-max gap-4">
            {[...GALLERY, ...GALLERY].map((photo, i) => (
              <div
                key={i}
                className="border-border relative aspect-square w-28 shrink-0 overflow-hidden rounded-xl border sm:w-36"
              >
                <Image
                  src={photo.image}
                  alt={photo.alt}
                  fill
                  sizes="144px"
                  className="object-cover"
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

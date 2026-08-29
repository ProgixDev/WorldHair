import { Image as ImageIcon, Star } from "lucide-react";

const PRESTATIONS = [
  { name: "Coupe & brushing", rating: 5 },
  { name: "Coloration", rating: 5 },
  { name: "Soin capillaire", rating: 4 },
] as const;

export function HighlightsSection() {
  return (
    <section id="fonctionnalites" className="bg-background">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <div className="max-w-xl">
          <h2 className="font-heading text-3xl font-semibold text-balance sm:text-4xl">
            Prestations populaires
          </h2>
          <p className="text-muted-foreground mt-3 text-pretty">
            Un aperçu des prestations les plus réservées sur WorldHair, notées
            par de vrais rendez-vous.
          </p>
        </div>

        <div className="border-border mt-12 grid overflow-hidden rounded-2xl border sm:grid-cols-3 sm:divide-x">
          {PRESTATIONS.map((prestation) => (
            <div
              key={prestation.name}
              className="border-border flex flex-col gap-4 border-t p-6 first:border-t-0 sm:border-t-0"
            >
              <div className="bg-muted flex aspect-square items-center justify-center rounded-xl">
                <ImageIcon className="text-muted-foreground/40 size-10" />
              </div>

              <div className="flex items-center justify-between">
                <span className="font-medium">{prestation.name}</span>
                <a href="#" className="text-primary text-sm font-medium hover:underline">
                  Voir plus
                </a>
              </div>

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

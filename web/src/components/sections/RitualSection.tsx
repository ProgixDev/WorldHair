import { Image as ImageIcon } from "lucide-react";

const STEPS = [
  {
    number: "01",
    tag: "Recherche",
    title: "Trouvez votre coiffeur",
  },
  {
    number: "02",
    tag: "Réservation",
    title: "Réservez en ligne",
  },
  {
    number: "03",
    tag: "Style",
    title: "Profitez de votre style",
  },
] as const;

export function RitualSection() {
  return (
    <section className="bg-background mt-16 sm:mt-24">
      <div className="mx-auto max-w-[1680px] px-4 py-20 sm:px-6">
        <div>
          <h2 className="text-primary text-2xl font-thin tracking-tight whitespace-nowrap uppercase sm:text-5xl lg:text-6xl">
            Votre style, votre parcours.
          </h2>
          <p className="text-muted-foreground mt-3 max-w-xl text-sm text-pretty">
            Trois étapes pensées pour rendre chaque rendez-vous simple, du
            premier clic jusqu&apos;au résultat final.
          </p>
        </div>

        <div className="mt-12 grid gap-6 sm:grid-cols-3">
          {STEPS.map((step) => (
            <div key={step.number} className="flex flex-col gap-4">
              <div className="bg-muted border-border relative flex aspect-3/4 items-center justify-center overflow-hidden rounded-2xl border">
                <ImageIcon className="text-muted-foreground/40 size-12" />
                <span className="text-foreground/60 absolute top-3 left-3 text-sm font-bold">
                  {step.number}
                </span>
                <span className="border-border bg-background/90 absolute top-3 right-3 rounded-full border px-3 py-1 text-xs font-medium">
                  {step.tag}
                </span>
              </div>
              <p className="text-sm font-bold tracking-tight uppercase">
                {step.title}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

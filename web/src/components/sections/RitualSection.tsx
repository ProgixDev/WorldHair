import Image from "next/image";

const STEPS = [
  {
    number: "01",
    image: "/images/RitualSectionRecherche.png",
    tag: "Recherche",
    title: "Trouvez votre coiffeur",
  },
  {
    number: "02",
    image: "/images/RitualSectionReservation.png",
    tag: "Réservation",
    title: "Réservez en ligne",
  },
  {
    number: "03",
    image: "/images/RitualSectionStyle.png",
    tag: "Style",
    title: "Profitez de votre style",
  },
] as const;

export function RitualSection() {
  return (
    <section id="parcours" className="bg-background mt-10 scroll-mt-5 sm:mt-24">
      <div className="mx-auto max-w-[1680px] px-4 py-12 sm:px-6 sm:py-20">
        <div>
          <h2 className="text-primary text-2xl font-thin tracking-tight text-balance uppercase sm:text-5xl sm:whitespace-nowrap lg:text-6xl">
            Votre style, votre parcours.
          </h2>
          <p className="text-muted-foreground mt-3 max-w-xl text-sm text-pretty">
            Trois étapes pensées pour rendre chaque rendez-vous simple, du
            premier clic jusqu&apos;au résultat final.
          </p>
        </div>

        <div className="mt-8 grid gap-6 sm:mt-12 sm:grid-cols-3">
          {STEPS.map((step) => (
            <div key={step.number} className="flex flex-col gap-4">
              <div className="bg-muted border-border relative flex aspect-square items-center justify-center overflow-hidden rounded-2xl border sm:aspect-3/4">
                <Image
                  src={step.image}
                  alt={step.title}
                  fill
                  sizes="(min-width: 640px) 33vw, 100vw"
                  className="absolute inset-0 size-full object-cover"
                />
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

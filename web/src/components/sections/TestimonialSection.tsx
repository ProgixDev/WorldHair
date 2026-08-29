import { Star } from "lucide-react";
import Image from "next/image";

export function TestimonialSection() {
  return (
    <section id="avis" className="scroll-mt-8 bg-background">
      <div className="mx-auto flex max-w-3xl flex-col items-center gap-4 px-4 pt-20 text-center sm:px-6">
        <p className="font-heading text-xl text-balance sm:text-2xl">
          &ldquo;J&apos;ai trouvé un coiffeur à deux rues de chez moi et
          réservé mon créneau en moins de deux minutes — plus simple, tu
          meurs.&rdquo;
        </p>
        <div className="flex items-center gap-0.5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Star key={i} className="text-primary size-4 fill-current" />
          ))}
        </div>
        <span className="text-muted-foreground text-sm font-medium">
          Camille D.
        </span>
      </div>

      <div className="mx-auto flex max-w-[1680px] justify-center px-4 pt-12 sm:px-6">
        <Image
          src="/images/TestimonialSectionMainPicture.png"
          alt="Icônes de témoignage cinq étoiles"
          width={1536}
          height={1024}
          className="w-full max-w-xl object-contain sm:max-w-3xl lg:max-w-4xl"
        />
      </div>
    </section>
  );
}

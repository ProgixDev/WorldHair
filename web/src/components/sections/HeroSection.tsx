import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/Button";

export function HeroSection() {
  return (
    <section
      aria-labelledby="worldhair-hero-heading"
      className="relative isolate min-h-screen overflow-hidden bg-[#020405] text-white"
    >
      <Image
        src="/images/HeroSectionBackground.png"
        alt=""
        fill
        priority
        sizes="100vw"
        className="-z-20 object-cover object-center"
      />
      <div className="absolute inset-0 -z-10 bg-linear-to-r from-black via-black/45 to-black/20" />
      <div className="absolute inset-x-0 bottom-0 -z-10 h-2/5 bg-linear-to-t from-black/70 to-transparent" />

      <div className="relative mx-auto min-h-screen max-w-[1680px] px-5 pt-24 pb-7 sm:px-8 sm:pt-28 sm:pb-10 lg:px-12">
        <div className="flex justify-end">
          <Button
            asChild
            size="lg"
            className="h-auto rounded-full bg-white px-3 py-2 pl-5 text-[11px] font-bold tracking-[0.08em] text-[#0c2340] hover:bg-white/90"
          >
            <a href="#telecharger">
              TÉLÉCHARGER L&apos;APP
              <span className="grid size-7 place-items-center rounded-full bg-[#0c2340] text-base text-white">
                <ArrowRight className="size-4" aria-hidden="true" />
              </span>
            </a>
          </Button>
        </div>

        <h1
          id="worldhair-hero-heading"
          aria-label="WorldHair"
          className="pointer-events-none absolute left-3 top-28 text-[clamp(5.9rem,16vw,13.5rem)] leading-[0.7] font-normal text-white sm:left-7 sm:top-32 lg:left-10 lg:top-32"
        >
          WorldHair
        </h1>

        <div className="absolute left-5 top-88 max-w-96 sm:left-8 sm:top-94 lg:left-12 lg:top-88">
          <p className="text-sm font-bold text-white uppercase">
            Votre style, à votre rythme
          </p>
          <p className="mt-2 text-sm leading-6 text-white/70">
            Réservez auprès de coiffeurs de confiance près de chez vous,
            simplement et en toute sérénité.
          </p>
        </div>

        <article className="absolute right-5 bottom-9 w-48 overflow-hidden rounded-2xl border-4 border-white shadow-2xl shadow-black/45 sm:right-8 sm:w-52 lg:right-12 lg:bottom-10">
          <div className="relative aspect-3/4">
            <Image
              src="/images/HeroSectionSmallPicture.png"
              alt=""
              fill
              className="object-cover object-[35%_35%]"
            />
            <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/85 to-transparent p-3 pt-10">
              <p className="font-heading text-sm text-pretty text-white italic">
                Chaque coupe raconte une histoire.
              </p>
            </div>
          </div>
        </article>
      </div>

      {/* A sibling of the padded content wrapper above, not a child of it —
          so `bottom-0` here means the section's true edge, not the wrapper's
          own bottom padding. Still painted last, so it layers on top of
          every text element above; the phone breaks the plane of the
          wordmark, on purpose. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center"
      >
        <Image
          src="/images/HeroSectionMainPicture.png"
          alt=""
          width={1448}
          height={1086}
          priority
          className="w-full max-w-lg object-contain object-bottom sm:max-w-2xl lg:max-w-3xl"
        />
      </div>
    </section>
  );
}

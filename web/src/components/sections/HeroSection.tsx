import Image from "next/image";
import { ArrowRight, Star } from "lucide-react";
import { Button } from "@/components/ui/Button";

export function HeroSection() {
  return (
    <section
      aria-labelledby="worldhair-hero-heading"
      className="relative isolate min-h-screen overflow-hidden bg-[#020405] text-white"
    >
      <Image
        src="/images/worldhair-navy-campaign-bg-v1.png"
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

        <article className="absolute right-5 bottom-9 w-48 overflow-hidden rounded-2xl border-4 border-white bg-white text-[#0c2340] shadow-2xl shadow-black/45 sm:right-8 sm:w-52 lg:right-12 lg:bottom-10">
          <Image
            src="/images/worldhair-stylist-card-v1.png"
            alt="Portrait de la coiffeuse de Maison Amara"
            width={416}
            height={520}
            className="h-32 w-full object-cover object-[44%_38%] sm:h-36"
          />
          <div className="p-3">
            <h2 className="text-sm font-bold">Maison Amara</h2>
            <p className="mt-1 text-xs text-[#607084]">Coloriste · Paris 11e</p>
            <div className="mt-2 flex items-center gap-1 text-xs font-medium text-[#a8703c]">
              <Star className="size-3 fill-current" aria-hidden="true" />
              <span>4,9</span>
              <span className="text-[#607084]">(128 avis)</span>
            </div>
          </div>
        </article>
      </div>

      {/* A sibling of the padded content wrapper above, not a child of it —
          so `bottom-0` here means the section's true edge, not the wrapper's
          own bottom padding. Still painted last, so it layers on top of
          every text element above; the jar breaks the plane of the
          wordmark, on purpose. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center"
      >
        <Image
          src="/images/worldhair-product-on-obsidian-v1.png"
          alt=""
          width={1536}
          height={1024}
          priority
          className="w-full max-w-xl object-contain object-bottom sm:max-w-3xl lg:max-w-4xl"
        />
      </div>
    </section>
  );
}

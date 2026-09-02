import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/Button";

/**
 * Two layouts, one markup tree. Below `sm` everything sits in normal flow —
 * wordmark, tagline, CTA, then the product shot pinned to the bottom by
 * `mt-auto`. From `sm` up the pieces go back to the fixed absolute
 * composition the design calls for (wordmark bleeding off the left edge,
 * tagline floating mid-canvas, photo card in the corner). Those offsets are
 * desktop geometry — applied at phone widths they stack on top of each
 * other, which is why mobile gets flow instead of scaled-down absolutes.
 */
export function HeroSection() {
  return (
    <section
      aria-labelledby="worldhair-hero-heading"
      className="relative isolate flex min-h-screen flex-col overflow-hidden bg-[#020405] text-white sm:block"
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

      <div className="relative mx-auto flex w-full max-w-[1680px] flex-col px-5 pt-24 pb-7 sm:block sm:min-h-screen sm:px-8 sm:pt-28 sm:pb-10 lg:px-12">
        <h1
          id="worldhair-hero-heading"
          aria-label="WorldHair"
          className="pointer-events-none order-1 static text-[clamp(3.4rem,16vw,13.5rem)] leading-[0.7] font-normal text-white sm:absolute sm:left-7 sm:top-32 lg:left-10 lg:top-32"
        >
          WorldHair
        </h1>

        <div className="order-2 static mt-6 sm:absolute sm:left-8 sm:top-94 sm:mt-0 sm:max-w-96 lg:left-12 lg:top-88">
          <p className="text-sm font-bold text-white uppercase">
            Votre style, à votre rythme
          </p>
          <p className="mt-2 text-sm leading-6 text-white/70">
            Réservez auprès de coiffeurs de confiance près de chez vous,
            simplement et en toute sérénité.
          </p>
        </div>

        <div className="order-3 mt-8 flex justify-start sm:mt-0 sm:justify-end">
          <Button
            asChild
            size="lg"
            className="h-auto rounded-full bg-white px-3 py-2.5 pl-5 text-[11px] font-bold tracking-[0.08em] text-[#0c2340] hover:bg-white/90 sm:py-2"
          >
            <a href="#telecharger">
              TÉLÉCHARGER L&apos;APP
              <span className="grid size-7 place-items-center rounded-full bg-[#0c2340] text-base text-white">
                <ArrowRight className="size-4" aria-hidden="true" />
              </span>
            </a>
          </Button>
        </div>

        {/* Decorative only — its line is atmosphere, not information, and in
            mobile flow it would push the product shot off screen. */}
        <article className="absolute right-5 bottom-9 hidden w-48 overflow-hidden rounded-2xl border-4 border-white shadow-2xl shadow-black/45 sm:right-8 sm:block sm:w-52 lg:right-12 lg:bottom-10">
          <div className="relative aspect-3/4">
            <Image
              src="/images/HeroSectionSmallPicture.png"
              alt=""
              fill
              sizes="208px"
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
          wordmark, on purpose. On mobile it stays in flow (`mt-auto` pins it
          to the bottom) so it sits below the copy instead of over it. */}
      <div
        aria-hidden="true"
        className="pointer-events-none static mt-auto flex justify-center sm:absolute sm:inset-x-0 sm:bottom-0"
      >
        <Image
          src="/images/HeroSectionMainPicture.png"
          alt=""
          width={1448}
          height={1086}
          priority
          sizes="(min-width: 1024px) 48rem, (min-width: 640px) 42rem, 100vw"
          className="w-full max-w-lg object-contain object-bottom sm:max-w-2xl lg:max-w-3xl"
        />
      </div>
    </section>
  );
}

import { Button } from "@/components/ui/Button";
import { ArrowUpRight, Image as ImageIcon, Scissors } from "lucide-react";

/**
 * Always dark — a fixed design choice for this band, not a user-toggleable
 * mode (this site has no light/dark switch). Colors are hardcoded to
 * mobile's own dark-mode swatches (constants/themes.ts) since the page's
 * one fixed palette (globals.css) is the light set — bright blue leads
 * here instead of the deep navy `--primary`, same swap mobile does when its
 * dark mode is active, just applied per-section instead of per-toggle.
 */
export function HeroSection() {
  return (
    <section className="bg-[#080f1a] text-[#f2f6fb]">
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <div className="flex items-center justify-end gap-3">
          <Button
            size="lg"
            className="rounded-full bg-[#38b6ff] text-[#04121f] hover:bg-[#38b6ff]/90"
          >
            Télécharger l&apos;app
          </Button>
          <Button
            size="icon-lg"
            variant="outline"
            className="rounded-full border-[#1e2e45] bg-[#111c2e] text-[#f2f6fb] hover:bg-[#17243a]"
            aria-label="Découvrir"
          >
            <ArrowUpRight />
          </Button>
        </div>

        <h1 className="font-heading mt-10 max-w-4xl text-5xl leading-tight font-semibold text-balance sm:text-6xl">
          Trouvez et réservez votre coiffeur en toute simplicité
        </h1>

        <div className="mt-12 flex flex-col gap-8 md:flex-row md:items-end">
          <div className="flex flex-col gap-3 md:w-1/4 md:shrink-0">
            <span className="text-sm font-semibold tracking-wide text-[#38b6ff] uppercase">
              Nouveau · iOS &amp; Android
            </span>
            <p className="text-sm text-pretty text-[#93a6bc]">
              WorldHair met en relation particuliers et coiffeurs
              professionnels près de chez vous, du premier rendez-vous à
              l&apos;avis vérifié.
            </p>
          </div>

          <div className="flex aspect-16/10 items-center justify-center rounded-3xl border border-[#1e2e45] bg-[#111c2e] md:flex-1">
            <Scissors className="size-16 text-[#93a6bc]/40" />
          </div>

          <div className="flex flex-col gap-2 md:w-1/5 md:shrink-0">
            <div className="flex aspect-square items-center justify-center rounded-3xl border border-[#1e2e45] bg-[#111c2e]">
              <ImageIcon className="size-10 text-[#93a6bc]/40" />
            </div>
            <span className="text-xs text-[#93a6bc]">
              Aperçu du profil salon
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

import { HeroSection } from "@/components/sections/HeroSection";
import { HighlightsSection } from "@/components/sections/HighlightsSection";
import { RitualSection } from "@/components/sections/RitualSection";
import { SpotlightSection } from "@/components/sections/SpotlightSection";
import { TestimonialSection } from "@/components/sections/TestimonialSection";

export default function Home() {
  return (
    <>
      <HeroSection />
      <HighlightsSection />
      <SpotlightSection />
      <RitualSection />
      <TestimonialSection />
    </>
  );
}

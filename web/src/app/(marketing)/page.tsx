import { HeroSection } from "@/components/sections/HeroSection";
import { HighlightsSection } from "@/components/sections/HighlightsSection";
import { PartnerSection } from "@/components/sections/PartnerSection";
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
      <PartnerSection />
      <TestimonialSection />
    </>
  );
}

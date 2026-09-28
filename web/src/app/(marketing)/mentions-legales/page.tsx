import { LegalPage } from "@/components/legal/LegalPage";
import { LEGAL_NOTICE } from "@/content/legal/mentions-legales";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Mentions légales — WorldHair",
  description: "Éditeur, hébergement et contact de WorldHair.",
};

export default function MentionsLegalesPage() {
  return <LegalPage document={LEGAL_NOTICE} path="/mentions-legales" />;
}

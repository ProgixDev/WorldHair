import { LegalPage } from "@/components/legal/LegalPage";
import { PRIVACY_POLICY } from "@/content/legal/confidentialite";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Politique de confidentialité — WorldHair",
  description: "Les données que WorldHair traite, pourquoi, combien de temps, et vos droits.",
};

export default function ConfidentialitePage() {
  return <LegalPage document={PRIVACY_POLICY} path="/confidentialite" />;
}

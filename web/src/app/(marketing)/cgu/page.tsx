import { LegalPage } from "@/components/legal/LegalPage";
import { CGU } from "@/content/legal/cgu";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Conditions générales d'utilisation — WorldHair",
  description: "Les règles de réservation, de paiement, d'annulation et d'avis de WorldHair.",
};

export default function CguPage() {
  return <LegalPage document={CGU} path="/cgu" />;
}

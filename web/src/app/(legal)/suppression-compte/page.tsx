import { LegalPage } from "@/components/legal/LegalPage";
import { ACCOUNT_DELETION } from "@/content/legal/suppression-compte";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Supprimer votre compte — WorldHair",
  description: "Comment supprimer votre compte WorldHair ou une partie de vos données, ce qui est effacé et ce qui est conservé.",
};

export default function SuppressionComptePage() {
  return <LegalPage document={ACCOUNT_DELETION} path="/suppression-compte" />;
}

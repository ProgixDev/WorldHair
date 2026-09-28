import { ProAuthGuard } from "@/components/pro/ProAuthGuard";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Mon abonnement — WorldHair",
  robots: { index: false, follow: false },
};

/** The coiffeurs' own corner of the website: their subscription, sold here rather than in the app. */
export default function ProLayout({ children }: { children: React.ReactNode }) {
  return <ProAuthGuard>{children}</ProAuthGuard>;
}

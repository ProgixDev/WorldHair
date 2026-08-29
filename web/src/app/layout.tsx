import "./globals.css";
import type { Metadata } from "next";
import localFont from "next/font/local";

// Same font files mobile bundles (mobile/assets/fonts/), copied into
// public/fonts/ — not Google's hosted versions, the exact same .ttf.
const roboto = localFont({
  variable: "--font-roboto",
  src: [
    { path: "../../public/fonts/Roboto/Roboto-Regular.ttf", weight: "400" },
    { path: "../../public/fonts/Roboto/Roboto-Medium.ttf", weight: "500" },
    { path: "../../public/fonts/Roboto/Roboto-Bold.ttf", weight: "700" },
  ],
});

const playfairDisplay = localFont({
  variable: "--font-playfair",
  src: [
    {
      path: "../../public/fonts/PlayfairDisplay/PlayfairDisplay-Regular.ttf",
      weight: "400",
    },
    {
      path: "../../public/fonts/PlayfairDisplay/PlayfairDisplay-Medium.ttf",
      weight: "500",
    },
    {
      path: "../../public/fonts/PlayfairDisplay/PlayfairDisplay-Bold.ttf",
      weight: "700",
    },
  ],
});

export const metadata: Metadata = {
  // Needed to resolve og:image/twitter:image into absolute URLs — without
  // it Next falls back to localhost even in production. Set
  // NEXT_PUBLIC_SITE_URL once this is actually deployed somewhere.
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: "WorldHair",
  description:
    "WorldHair met en relation particuliers et coiffeurs professionnels : trouvez, réservez et recevez votre prestation en toute confiance.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="fr"
      className={`${roboto.variable} ${playfairDisplay.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}

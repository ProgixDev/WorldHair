import "./globals.css";
import type { Metadata } from "next";
import localFont from "next/font/local";

// One typeface drives the whole site — Helvetica Neue, per the reference
// design's own typography (not a Google-hosted lookalike, the real family,
// provided as local files). Weights beyond what any component currently
// uses (Thin/UltraLight/Heavy/Black + italics) are still registered since
// the full family was provided — no cost to including them, and it means
// future weight/style choices don't need a new font drop.
const helveticaNeue = localFont({
  variable: "--font-helvetica-neue",
  src: [
    {
      path: "../../public/fonts/HelveticaNeue/HelveticaNeueThin.otf",
      weight: "100",
      style: "normal",
    },
    {
      path: "../../public/fonts/HelveticaNeue/HelveticaNeueThinItalic.otf",
      weight: "100",
      style: "italic",
    },
    {
      path: "../../public/fonts/HelveticaNeue/HelveticaNeueUltraLight.otf",
      weight: "200",
      style: "normal",
    },
    {
      path: "../../public/fonts/HelveticaNeue/HelveticaNeueUltraLightItalic.otf",
      weight: "200",
      style: "italic",
    },
    {
      path: "../../public/fonts/HelveticaNeue/HelveticaNeueLight.otf",
      weight: "300",
      style: "normal",
    },
    {
      path: "../../public/fonts/HelveticaNeue/HelveticaNeueLightItalic.otf",
      weight: "300",
      style: "italic",
    },
    {
      path: "../../public/fonts/HelveticaNeue/HelveticaNeueRoman.otf",
      weight: "400",
      style: "normal",
    },
    {
      path: "../../public/fonts/HelveticaNeue/HelveticaNeueItalic.ttf",
      weight: "400",
      style: "italic",
    },
    {
      path: "../../public/fonts/HelveticaNeue/HelveticaNeueMedium.otf",
      weight: "500",
      style: "normal",
    },
    {
      path: "../../public/fonts/HelveticaNeue/HelveticaNeueMediumItalic.otf",
      weight: "500",
      style: "italic",
    },
    {
      path: "../../public/fonts/HelveticaNeue/HelveticaNeueBold.otf",
      weight: "700",
      style: "normal",
    },
    {
      path: "../../public/fonts/HelveticaNeue/HelveticaNeueBoldItalic.otf",
      weight: "700",
      style: "italic",
    },
    {
      path: "../../public/fonts/HelveticaNeue/HelveticaNeueHeavy.otf",
      weight: "800",
      style: "normal",
    },
    {
      path: "../../public/fonts/HelveticaNeue/HelveticaNeueHeavyItalic.otf",
      weight: "800",
      style: "italic",
    },
    {
      path: "../../public/fonts/HelveticaNeue/HelveticaNeueBlack.otf",
      weight: "900",
      style: "normal",
    },
    {
      path: "../../public/fonts/HelveticaNeue/HelveticaNeueBlackItalic.otf",
      weight: "900",
      style: "italic",
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
      data-scroll-behavior="smooth"
      className={`${helveticaNeue.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}

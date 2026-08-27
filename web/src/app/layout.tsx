import "./globals.css";
import { ThemeProvider } from "@/contexts/ThemeContext";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  // Needed to resolve og:image/twitter:image into absolute URLs — without
  // it Next falls back to localhost even in production. Set
  // NEXT_PUBLIC_SITE_URL once this is actually deployed somewhere.
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: "App",
  description: "App",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      // next-themes sets the .dark class client-side, before hydration
      // finishes, so the class it applies never matches the server-rendered
      // markup — that mismatch is expected here, not a real bug.
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}

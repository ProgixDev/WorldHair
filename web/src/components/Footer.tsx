import Image from "next/image";

const FOOTER_LINKS = [
  { href: "#fonctionnalites", label: "Fonctionnalités" },
  { href: "#coiffeurs", label: "Coiffeurs" },
  { href: "#", label: "À propos" },
  { href: "#", label: "Contact" },
];

export function Footer() {
  return (
    <footer className="rounded-t-4xl mt-16 bg-[#020405] px-4 pt-10 text-white sm:mt-24 sm:px-6">
      <nav className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-4">
        {FOOTER_LINKS.map((link) => (
          <a
            key={link.label}
            href={link.href}
            className="text-xs text-white/70 transition-colors hover:text-white"
          >
            {link.label}
          </a>
        ))}
      </nav>

      <h2 className="mt-16 text-center text-[clamp(4.5rem,16vw,12rem)] leading-none font-medium tracking-tight sm:mt-20">
        WorldHair
      </h2>

      {/* Pulled up with a negative margin so it paints over the wordmark
          above — same overlap layering as HeroSection's product shot. */}
      <div className="relative z-10 mx-auto -mt-16 flex max-w-4xl justify-center sm:-mt-24">
        <Image
          src="/images/worldhair-product-on-obsidian-v1.png"
          alt=""
          width={1536}
          height={1024}
          className="w-full max-w-2xl object-contain object-bottom"
        />
      </div>

      <div className="border-t border-white/10 py-6 text-center text-xs text-white/40">
        © {new Date().getFullYear()} WorldHair. Tous droits réservés.
      </div>
    </footer>
  );
}

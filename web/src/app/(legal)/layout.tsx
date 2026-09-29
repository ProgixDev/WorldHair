/**
 * The legal pages' own shell (TODO.md Phase 8): the app opens them in its
 * browser, so nothing here leads on — no header, no « Compte » (which leads
 * to the coiffeurs' subscription page: App Store rule 3.1.3). The pages
 * link to one another only.
 */
export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full flex-1 flex-col bg-white">
      <main className="flex-1">{children}</main>
      <footer className="bg-[#020405] px-4 py-6 text-center text-xs text-white/40">
        © {new Date().getFullYear()} WorldHair. Tous droits réservés.
      </footer>
    </div>
  );
}

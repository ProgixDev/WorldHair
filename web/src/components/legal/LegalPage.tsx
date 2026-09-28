import type { LegalDocument } from "@/content/legal/types";
import Link from "next/link";
import { inlineParts } from "./inline";

const LEGAL_LINKS = [
  { href: "/cgu", label: "Conditions générales d'utilisation" },
  { href: "/confidentialite", label: "Politique de confidentialité" },
  { href: "/mentions-legales", label: "Mentions légales" },
];

function Inline({ text }: { text: string }) {
  return (
    <>
      {inlineParts(text).map((part, index) =>
        part.kind === "link" ? (
          <Link key={index} href={part.href} className="text-[#2a93d5] underline underline-offset-2 hover:text-[#0c2340]">
            {part.text}
          </Link>
        ) : part.kind === "missing" ? (
          // A company field not filled in yet (content/legal/company.ts): impossible to miss before launch.
          <mark key={index} className="rounded bg-amber-100 px-1 text-amber-900">
            [{part.text}]
          </mark>
        ) : (
          <span key={index}>{part.text}</span>
        ),
      )}
    </>
  );
}

/**
 * One legal page of the site (TODO.md Phase 8): a navy band under the
 * header with the title and version, then the text, then the other legal
 * pages. The app opens these same pages.
 */
export function LegalPage({ document, path }: { document: LegalDocument; path: string }) {
  return (
    <>
      <section className="bg-[#0c2340] px-4 pt-28 pb-10 text-white sm:px-6 sm:pt-36 sm:pb-14">
        <div className="mx-auto max-w-3xl">
          <p className="text-xs tracking-[0.2em] text-white/60 uppercase">Informations légales</p>
          <h1 className="mt-3 text-3xl leading-tight font-medium sm:text-5xl">{document.title}</h1>
          {document.version && <p className="mt-4 text-sm text-white/70">{document.version}</p>}
        </div>
      </section>

      <article className="bg-white px-4 py-10 text-[#0c2340] sm:px-6 sm:py-14">
        <div className="mx-auto flex max-w-3xl flex-col gap-8">
          {document.intro && (
            <p className="text-base leading-relaxed text-[#0c2340]/80">
              <Inline text={document.intro} />
            </p>
          )}

          {document.sections.map((section) => (
            <section key={section.title} className="flex flex-col gap-3">
              <h2 className="text-lg font-medium sm:text-xl">{section.title}</h2>
              {section.blocks.map((block, index) =>
                typeof block === "string" ? (
                  <p key={index} className="text-sm leading-relaxed text-[#0c2340]/80 sm:text-base">
                    <Inline text={block} />
                  </p>
                ) : (
                  <ul key={index} className="flex list-disc flex-col gap-2 pl-5 text-sm leading-relaxed text-[#0c2340]/80 sm:text-base">
                    {block.map((item) => (
                      <li key={item}>
                        <Inline text={item} />
                      </li>
                    ))}
                  </ul>
                ),
              )}
            </section>
          ))}

          <nav aria-label="Informations légales" className="mt-4 flex flex-wrap gap-x-6 gap-y-2 border-t border-[#0c2340]/10 pt-6">
            {LEGAL_LINKS.filter((link) => link.href !== path).map((link) => (
              <Link key={link.href} href={link.href} className="text-sm text-[#2a93d5] hover:text-[#0c2340]">
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      </article>
    </>
  );
}

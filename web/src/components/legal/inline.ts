import type { LegalDocument } from "@/content/legal/types";

export type InlinePart =
  | { kind: "text"; text: string }
  | { kind: "link"; text: string; href: string }
  /** A « [… à compléter] » field of company.ts, still empty. */
  | { kind: "missing"; text: string };

const TOKEN = /\[([^\]]+)\]\(([^)\s]+)\)|\[([^\]]*à compléter[^\]]*)\]/g;

/** A legal text cut into plain text, links (`[label](/path)`) and fields still to fill in. */
export function inlineParts(text: string): InlinePart[] {
  const parts: InlinePart[] = [];
  let last = 0;
  for (const match of text.matchAll(TOKEN)) {
    const index = match.index ?? 0;
    if (index > last) parts.push({ kind: "text", text: text.slice(last, index) });
    parts.push(match[3] !== undefined ? { kind: "missing", text: match[3] } : { kind: "link", text: match[1], href: match[2] });
    last = index + match[0].length;
  }
  if (last < text.length) parts.push({ kind: "text", text: text.slice(last) });
  return parts;
}

/** Every field these pages still wait for, once each — what must be filled in before launch. */
export function missingFields(documents: LegalDocument[]): string[] {
  const texts = documents.flatMap((document) => [
    document.intro ?? "",
    ...document.sections.flatMap((section) => section.blocks.flat()),
  ]);
  const missing = texts.flatMap((text) => inlineParts(text).filter((part) => part.kind === "missing").map((part) => part.text));
  return [...new Set(missing)];
}

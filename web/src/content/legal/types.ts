/**
 * A legal page's text: sections of paragraphs (a string) and lists (an
 * array of strings). Inside a text, `[label](/path)` is a link, and a
 * « [… à compléter] » is a field still to fill in (see company.ts).
 */
export type LegalBlock = string | string[];

export interface LegalSection {
  title: string;
  blocks: LegalBlock[];
}

export interface LegalDocument {
  title: string;
  /** Shown under the title: « Version du … », or nothing. */
  version?: string;
  intro?: string;
  sections: LegalSection[];
}

/**
 * Before launch (TODO.md Phase 8): the legal pages must have every company
 * field filled in (src/content/legal/company.ts). Lists what's missing and
 * fails until nothing is.
 *
 *   bun run check:legal
 */
import { missingFields } from "../src/components/legal/inline";
import { CGU } from "../src/content/legal/cgu";
import { PRIVACY_POLICY } from "../src/content/legal/confidentialite";
import { LEGAL_NOTICE } from "../src/content/legal/mentions-legales";

const missing = missingFields([CGU, PRIVACY_POLICY, LEGAL_NOTICE]);
if (missing.length > 0) {
  console.error(`The legal pages still wait for ${missing.length} field(s) in src/content/legal/company.ts:`);
  for (const field of missing) console.error(`  - ${field}`);
  process.exit(1);
}
console.log("Legal pages complete.");

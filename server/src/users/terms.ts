/**
 * The CGU and privacy policy in force (TODO.md Phase 8): the date they took
 * effect. The website shows the same date on its legal pages
 * (web/src/content/legal/company.ts) and the app sends it at sign-up
 * (mobile/src/features/legal/terms.ts). Change all three together: every
 * user whose accepted version differs is asked to accept the new one.
 */
export const TERMS_VERSION = '2026-09-29';

/**
 * The company behind WorldHair, as the legal pages show it (TODO.md
 * Phase 8). Every « [… à compléter] » shows highlighted on the pages until
 * it's filled in here — all of them must be before launch.
 */
export const COMPANY = {
  /** Dénomination sociale. */
  name: "World Haire Corporation",
  /** Forme juridique : SAS, SARL, EI… */
  legalForm: "société par actions simplifiée unipersonnelle (SASU)",
  capital: "500 €",
  address: "173 rue de Courcelles, 75017 Paris",
  /** Ville du greffe et numéro : « RCS Paris 123 456 789 », ou le numéro SIREN d'une entreprise individuelle. */
  registration: "RCS Paris 109 349 779",
  vatNumber: "[Numéro de TVA intracommunautaire à compléter]",
  publicationDirector: "André Neola, président",
  email: "worldhairapp@hotmail.com",
  phone: "06 16 87 67 09",
  /** Médiateur de la consommation (obligatoire en France pour les litiges avec des particuliers) : nom, site web. */
  mediator: "[Médiateur de la consommation à compléter]",
};

/**
 * Where the site, the API and the data are hosted — to check again when
 * production moves (TODO.md Phase 8, « Production environment »).
 */
export const HOSTING = {
  web: "Render Services, Inc., 525 Brannan Street, Suite 300, San Francisco, CA 94107, États-Unis (render.com)",
  data: "Supabase, Inc. (supabase.com), sur des serveurs situés dans l'Union européenne (Francfort, Allemagne)",
  dataRegion: "dans l'Union européenne (Francfort, Allemagne)",
};

/**
 * The CGU and privacy policy in force: the date they took effect. Must
 * match server/src/users/terms.ts and mobile/src/features/legal/terms.ts —
 * changing it asks every user to accept again, in the app.
 */
export const TERMS_VERSION = "2026-09-29";
export const TERMS_DATE = "29 septembre 2026";

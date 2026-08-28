import { isAxiosError } from "axios";
import { apiClient } from "../lib/apiClient";
import { supabase } from "../lib/supabase";
import { isRemoteUrl, uploadUserPhoto } from "../lib/uploadPhoto";
import { seedDemoBookings } from "./booking";
import { seedProWorkspace } from "./pro";

/**
 * Real auth service: Supabase Auth directly for signup/login/verify/reset
 * (see server/src/auth/auth.module.ts's doc comment for why that split
 * exists), the NestJS server for coiffeur onboarding (`/coiffeur/
 * applications/*`, since that's where the business logic — path ownership,
 * conditional practice-zone validation, role promotion — actually lives; see
 * server/src/coiffeur/). `profiles` itself is read directly here too (RLS
 * lets the owner read/update their own row), so session/role/status
 * resolution never needs the NestJS server to be reachable — only
 * *submitting or deciding* a coiffeur application does.
 */

export type UserRole = "particulier" | "coiffeur";

export type AccountStatus =
  | "pending_email" // email not verified yet
  | "profile_incomplete" // verified, profile/application not filled in
  | "pending_review" // coiffeur dossier submitted, admin has not ruled
  | "rejected" // coiffeur dossier refused
  | "active";

export interface ParticulierProfile {
  firstName: string;
  lastName: string;
  photoUri?: string | null;
}

export type ProDocumentKind = "identity" | "diploma" | "kbis" | "invoice";

export interface ProDocument {
  kind: ProDocumentKind;
  name: string;
  /** Local file URI — kept only for the on-device preview thumbnail. */
  uri: string;
  mimeType?: string | null;
  size?: number | null;
  /**
   * Path in the private `coiffeur-documents` Storage bucket, set once
   * `UploadSlot` finishes uploading — this, not `uri`, is what
   * `submitProApplication` sends the server.
   */
  storagePath?: string | null;
}

export type PracticeZone = "salon" | "domicile";

export interface ProApplication {
  firstName: string;
  lastName: string;
  phone: string;
  salonName: string;
  description?: string;
  practiceZone: PracticeZone;
  addressLine?: string;
  postalCode?: string;
  city?: string;
  travelRadiusKm?: number;
  documents: ProDocument[];
  submittedAt: string;
}

export interface Session {
  userId: string;
  email: string;
  role: UserRole;
  status: AccountStatus;
  emailVerified: boolean;
  profile?: ParticulierProfile | null;
  application?: ProApplication | null;
  /** Reason shown on the refused-account state. */
  reviewMessage?: string | null;
  /** Coiffeur only — issue #7. */
  shopProfileComplete?: boolean;
  /** ISO creation date — drives the "membre depuis" line. */
  createdAt: string;
}

export type AuthErrorCode =
  | "INVALID_CREDENTIALS"
  | "EMAIL_IN_USE"
  | "UNKNOWN_EMAIL"
  | "WEAK_PASSWORD"
  | "INVALID_CODE"
  | "NO_SESSION"
  | "STORAGE";

export class AuthError extends Error {
  readonly code: AuthErrorCode;

  constructor(code: AuthErrorCode, message: string) {
    super(message);
    this.name = "AuthError";
    this.code = code;
  }
}

function mapApiError(err: unknown): AuthError {
  if (isAxiosError(err)) {
    const body = err.response?.data as
      | { message?: string | string[] }
      | undefined;
    const message = Array.isArray(body?.message)
      ? body.message.join(" ")
      : body?.message;
    return new AuthError("STORAGE", message ?? "Une erreur est survenue.");
  }
  return new AuthError("STORAGE", "Une erreur est survenue.");
}

function basename(path: string): string {
  return path.split("/").pop() ?? path;
}

interface CoiffeurApplicationRow {
  first_name: string;
  last_name: string;
  phone: string;
  salon_name: string;
  description: string;
  practice_zone: PracticeZone;
  address_line: string | null;
  postal_code: string | null;
  city: string | null;
  invoice_document_path: string | null;
  travel_radius_km: number | null;
  identity_document_path: string;
  diploma_document_path: string;
  kbis_document_path: string;
  status: "pending" | "validated" | "rejected";
  review_message: string | null;
  shop_profile_complete: boolean;
  submitted_at: string;
}

/** Rebuilds the `documents` array display from Storage paths — the DB only
 * ever stores the path, not the original filename/mimetype/size. */
function mapApplicationRow(row: CoiffeurApplicationRow): ProApplication {
  const documents: ProDocument[] = [
    { kind: "identity", name: basename(row.identity_document_path), uri: row.identity_document_path },
    { kind: "diploma", name: basename(row.diploma_document_path), uri: row.diploma_document_path },
    { kind: "kbis", name: basename(row.kbis_document_path), uri: row.kbis_document_path },
  ];
  if (row.invoice_document_path) {
    documents.push({
      kind: "invoice",
      name: basename(row.invoice_document_path),
      uri: row.invoice_document_path,
    });
  }

  return {
    firstName: row.first_name,
    lastName: row.last_name,
    phone: row.phone,
    salonName: row.salon_name,
    description: row.description,
    practiceZone: row.practice_zone,
    addressLine: row.address_line ?? undefined,
    postalCode: row.postal_code ?? undefined,
    city: row.city ?? undefined,
    travelRadiusKm: row.travel_radius_km ?? undefined,
    documents,
    submittedAt: row.submitted_at,
  };
}

// ─── Session ─────────────────────────────────────────────────────────────────

/**
 * The single place a `Session` gets assembled: the Supabase auth user plus
 * its `profiles` row plus (coiffeurs only) its `coiffeur_applications` row —
 * both read directly via RLS, not through the NestJS server.
 */
async function buildSession(): Promise<Session | null> {
  const {
    data: { session: authSession },
  } = await supabase.auth.getSession();
  const user = authSession?.user;
  if (!user) return null;

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("first_name, last_name, photo_url, role, created_at")
    .eq("id", user.id)
    .maybeSingle();
  if (profileError) throw new AuthError("STORAGE", profileError.message);

  const role = (profile?.role as UserRole | undefined) ?? "particulier";
  const emailVerified = user.email_confirmed_at != null;
  const createdAt = profile?.created_at ?? user.created_at;

  if (role === "coiffeur") {
    const { data: applicationRow, error: applicationError } = await supabase
      .from("coiffeur_applications")
      .select()
      .eq("profile_id", user.id)
      .maybeSingle();
    if (applicationError) throw new AuthError("STORAGE", applicationError.message);

    const row = applicationRow as CoiffeurApplicationRow | null;
    const status: AccountStatus = !emailVerified
      ? "pending_email"
      : !row
        ? "profile_incomplete"
        : row.status === "pending"
          ? "pending_review"
          : row.status === "rejected"
            ? "rejected"
            : "active";

    return {
      userId: user.id,
      email: user.email ?? "",
      role: "coiffeur",
      status,
      emailVerified,
      profile: null,
      application: row ? mapApplicationRow(row) : null,
      reviewMessage: row?.review_message ?? null,
      shopProfileComplete: row?.shop_profile_complete ?? false,
      createdAt,
    };
  }

  const hasProfile = Boolean(profile?.first_name);
  const status: AccountStatus = !emailVerified
    ? "pending_email"
    : !hasProfile
      ? "profile_incomplete"
      : "active";

  return {
    userId: user.id,
    email: user.email ?? "",
    role: "particulier",
    status,
    emailVerified,
    profile: hasProfile
      ? {
          firstName: profile!.first_name,
          lastName: profile!.last_name,
          photoUri: profile?.photo_url ?? null,
        }
      : null,
    application: null,
    reviewMessage: null,
    createdAt,
  };
}

export async function getSession(): Promise<Session | null> {
  return buildSession();
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
}

// ─── Email + password ────────────────────────────────────────────────────────

/**
 * No session exists yet after this — Supabase withholds one until the email
 * is confirmed (see `verifyEmail`). Callers navigate to the verify screen
 * unconditionally rather than reading a returned session.
 */
export async function signUpWithEmail(params: {
  email: string;
  password: string;
  role: UserRole;
}): Promise<void> {
  const { error } = await supabase.auth.signUp({
    email: params.email.trim(),
    password: params.password,
  });

  if (error) {
    if (error.message.toLowerCase().includes("already registered"))
      throw new AuthError("EMAIL_IN_USE", "Un compte existe déjà avec cet email.");
    if (error.message.toLowerCase().includes("password"))
      throw new AuthError("WEAK_PASSWORD", "Mot de passe trop court.");
    throw new AuthError("STORAGE", error.message);
  }
  // `params.role` is only ever a client-side hint for which onboarding wizard
  // to land in post-verification (see features/auth/routing.ts and
  // services/preferences.ts's setSignupIntent) — the database's `profiles.role`
  // stays 'particulier' until a coiffeur application is actually submitted.
}

export async function signInWithEmail(params: {
  email: string;
  password: string;
}): Promise<Session> {
  const { error } = await supabase.auth.signInWithPassword({
    email: params.email.trim(),
    password: params.password,
  });
  if (error) throw new AuthError("INVALID_CREDENTIALS", "Email ou mot de passe incorrect.");

  const session = await buildSession();
  if (!session) throw new AuthError("NO_SESSION", "Session introuvable.");
  return session;
}

/**
 * Social login placeholder: expo-auth-session / expo-apple-authentication
 * aren't installed and no OAuth app is registered with Google/Apple yet, so
 * this still fabricates a session rather than running a real OAuth flow.
 * Swap this for `supabase.auth.signInWithOAuth` once those exist.
 */
export async function signInWithProvider(
  provider: "google" | "apple",
): Promise<Session> {
  const email = "demo." + provider + "@worldhair.app";
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password: DEMO_PASSWORD,
  });
  if (error) throw new AuthError("STORAGE", "Connexion impossible.");

  const session = await buildSession();
  if (!session) throw new AuthError("NO_SESSION", "Session introuvable.");
  return session;
}

// ─── Email verification ──────────────────────────────────────────────────────

export async function resendVerificationCode(email: string): Promise<void> {
  const { error } = await supabase.auth.resend({ type: "signup", email: email.trim() });
  if (error) throw new AuthError("STORAGE", error.message);
}

export async function verifyEmail(email: string, code: string): Promise<Session> {
  const { error } = await supabase.auth.verifyOtp({
    email: email.trim(),
    token: code.trim(),
    type: "signup",
  });
  if (error) throw new AuthError("INVALID_CODE", "Code incorrect ou expiré.");

  const session = await buildSession();
  if (!session) throw new AuthError("NO_SESSION", "Session introuvable après vérification.");
  return session;
}

// ─── Particulier profile ─────────────────────────────────────────────────────

export async function saveParticulierProfile(
  profile: ParticulierProfile,
): Promise<Session> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new AuthError("NO_SESSION", "Aucune session active.");

  let photoUrl: string | null = profile.photoUri ?? null;
  if (photoUrl && !isRemoteUrl(photoUrl)) {
    try {
      photoUrl = await uploadUserPhoto(user.id, "avatar", photoUrl);
    } catch {
      throw new AuthError("STORAGE", "Envoi de la photo impossible.");
    }
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      first_name: profile.firstName,
      last_name: profile.lastName,
      photo_url: photoUrl,
    })
    .eq("id", user.id);
  if (error) throw new AuthError("STORAGE", error.message);

  // Demo build: a brand-new particulier gets a populated agenda rather than
  // three empty tabs. No-op once the account has any booking of its own.
  await seedDemoBookings();

  const session = await buildSession();
  if (!session) throw new AuthError("NO_SESSION", "Session introuvable.");
  return session;
}

// ─── Coiffeur application ────────────────────────────────────────────────────

export async function submitProApplication(
  application: Omit<ProApplication, "submittedAt">,
): Promise<Session> {
  const pathFor = (kind: ProDocumentKind) =>
    application.documents.find((doc) => doc.kind === kind)?.storagePath ??
    undefined;

  const identityDocumentPath = pathFor("identity");
  const diplomaDocumentPath = pathFor("diploma");
  const kbisDocumentPath = pathFor("kbis");
  const invoiceDocumentPath = pathFor("invoice");

  if (!identityDocumentPath || !diplomaDocumentPath || !kbisDocumentPath) {
    throw new AuthError("STORAGE", "Documents manquants.");
  }

  try {
    await apiClient.post("/coiffeur/applications", {
      firstName: application.firstName,
      lastName: application.lastName,
      phone: application.phone,
      salonName: application.salonName,
      description: application.description,
      practiceZone: application.practiceZone,
      addressLine: application.addressLine,
      postalCode: application.postalCode,
      city: application.city,
      travelRadiusKm: application.travelRadiusKm,
      identityDocumentPath,
      diplomaDocumentPath,
      kbisDocumentPath,
      invoiceDocumentPath,
    });
  } catch (err) {
    throw mapApiError(err);
  }

  const session = await buildSession();
  if (!session) throw new AuthError("NO_SESSION", "Session introuvable.");
  return session;
}

/** Issue #7: the mandatory post-approval shop-profile screen marks itself done here. */
export async function completeShopProfile(): Promise<Session> {
  try {
    await apiClient.patch("/coiffeur/applications/me/shop-profile");
  } catch (err) {
    throw mapApiError(err);
  }

  const session = await buildSession();
  if (!session) throw new AuthError("NO_SESSION", "Session introuvable.");
  return session;
}

// ─── Demo / preview accounts ─────────────────────────────────────────────────

/**
 * Ready-made accounts, one per state the app can land a user in — seeded for
 * real in Supabase (see docs/superpowers/specs or ask: same 4 personas as
 * the old mock, now real rows) so the demo login bar keeps working without
 * needing anyone to actually run the signup/review flow first.
 */
export type DemoPersona =
  "particulier" | "coiffeur_active" | "coiffeur_pending" | "coiffeur_rejected";

export interface DemoPersonaInfo {
  id: DemoPersona;
  label: string;
  hint: string;
}

export const DEMO_PERSONAS: DemoPersonaInfo[] = [
  {
    id: "particulier",
    label: "Particulier",
    hint: "Profil complet → accueil",
  },
  {
    id: "coiffeur_active",
    label: "Coiffeur validé",
    hint: "Dossier accepté → accueil",
  },
  {
    id: "coiffeur_pending",
    label: "Coiffeur en attente",
    hint: "Dossier en cours de revue",
  },
  {
    id: "coiffeur_rejected",
    label: "Coiffeur refusé",
    hint: "Dossier à corriger",
  },
];

const DEMO_PASSWORD = "Demo1234!";

const DEMO_EMAILS: Record<DemoPersona, string> = {
  particulier: "demo.particulier@worldhair.app",
  coiffeur_active: "demo.coiffeur.active@worldhair.app",
  coiffeur_pending: "demo.coiffeur.pending@worldhair.app",
  coiffeur_rejected: "demo.coiffeur.rejected@worldhair.app",
};

/** Signs into one of the seeded preview accounts above — a real sign-in, not a fabrication. */
export async function signInAsDemo(persona: DemoPersona): Promise<Session> {
  const { error } = await supabase.auth.signInWithPassword({
    email: DEMO_EMAILS[persona],
    password: DEMO_PASSWORD,
  });
  if (error)
    throw new AuthError(
      "UNKNOWN_EMAIL",
      "Compte démo indisponible — a-t-il bien été seedé côté Supabase ?",
    );

  if (persona === "particulier") await seedDemoBookings();
  if (persona === "coiffeur_active") await seedProWorkspace();

  const session = await buildSession();
  if (!session) throw new AuthError("NO_SESSION", "Session introuvable.");
  return session;
}

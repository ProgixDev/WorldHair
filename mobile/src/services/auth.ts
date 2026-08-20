import AsyncStorage from "@react-native-async-storage/async-storage";
import { seedDemoBookings } from "./booking";

/**
 * Mock auth service. No backend exists yet (stack undecided — see TODO.md), so
 * every call here fakes latency against AsyncStorage. This module is the seam:
 * when the real API lands, only this file is replaced. Nothing outside it may
 * touch the storage keys below.
 */

const USERS_KEY = "@worldhair/mock_users";
const SESSION_KEY = "@worldhair/session";

/** Frontend-only build: the "emailed" code is always this. */
export const DEMO_VERIFICATION_CODE = "123456";

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

export type ProDocumentKind = "identity" | "diploma";

export interface ProDocument {
  kind: ProDocumentKind;
  name: string;
  uri: string;
  mimeType?: string | null;
  size?: number | null;
}

export interface ProApplication {
  firstName: string;
  lastName: string;
  phone: string;
  salonName: string;
  description?: string;
  addressLine: string;
  postalCode: string;
  city: string;
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
  /** ISO creation date — drives the "membre depuis" line. */
  createdAt: string;
}

interface StoredUser extends Session {
  password: string;
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

const LATENCY_MS = 700;

function delay(ms = LATENCY_MS): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

async function readUsers(): Promise<StoredUser[]> {
  try {
    const raw = await AsyncStorage.getItem(USERS_KEY);
    return raw ? (JSON.parse(raw) as StoredUser[]) : [];
  } catch {
    throw new AuthError("STORAGE", "Stockage local indisponible.");
  }
}

async function writeUsers(users: StoredUser[]): Promise<void> {
  try {
    await AsyncStorage.setItem(USERS_KEY, JSON.stringify(users));
  } catch {
    throw new AuthError("STORAGE", "Stockage local indisponible.");
  }
}

function toSession(user: StoredUser): Session {
  const { password: _password, ...session } = user;
  return session;
}

async function persistSession(user: StoredUser): Promise<Session> {
  const session = toSession(user);
  await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(session));
  return session;
}

/** Writes the mutated user back to the mock table and refreshes the session. */
async function commit(user: StoredUser): Promise<Session> {
  const users = await readUsers();
  const next = users.map((u) => (u.userId === user.userId ? user : u));
  await writeUsers(next);
  return persistSession(user);
}

async function requireUser(): Promise<StoredUser> {
  const session = await getSession();
  if (!session) throw new AuthError("NO_SESSION", "Aucune session active.");
  const users = await readUsers();
  const user = users.find((u) => u.userId === session.userId);
  if (!user) throw new AuthError("NO_SESSION", "Compte introuvable.");
  return user;
}

// ─── Session ─────────────────────────────────────────────────────────────────

export async function getSession(): Promise<Session | null> {
  try {
    const raw = await AsyncStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

export async function signOut(): Promise<void> {
  await AsyncStorage.removeItem(SESSION_KEY);
}

// ─── Email + password ────────────────────────────────────────────────────────

export async function signUpWithEmail(params: {
  email: string;
  password: string;
  role: UserRole;
}): Promise<Session> {
  await delay();
  const email = normalizeEmail(params.email);
  if (params.password.length < 8)
    throw new AuthError("WEAK_PASSWORD", "Mot de passe trop court.");

  const users = await readUsers();
  if (users.some((u) => u.email === email))
    throw new AuthError(
      "EMAIL_IN_USE",
      "Un compte existe déjà avec cet email.",
    );

  const user: StoredUser = {
    userId: "u_" + (users.length + 1) + "_" + params.role,
    email,
    password: params.password,
    role: params.role,
    status: "pending_email",
    emailVerified: false,
    profile: null,
    application: null,
    reviewMessage: null,
    createdAt: new Date().toISOString(),
  };

  await writeUsers([...users, user]);
  return persistSession(user);
}

export async function signInWithEmail(params: {
  email: string;
  password: string;
}): Promise<Session> {
  await delay();
  const email = normalizeEmail(params.email);
  const users = await readUsers();
  const user = users.find((u) => u.email === email);

  if (!user)
    throw new AuthError("UNKNOWN_EMAIL", "Aucun compte avec cet email.");
  if (user.password !== params.password)
    throw new AuthError("INVALID_CREDENTIALS", "Mot de passe incorrect.");

  return persistSession(user);
}

/**
 * Social login placeholder. expo-auth-session / expo-apple-authentication are
 * not installed, so this fabricates a verified account instead of running a
 * real OAuth flow. Replace wholesale once the provider apps exist.
 */
export async function signInWithProvider(
  provider: "google" | "apple",
): Promise<Session> {
  await delay();
  const email = "demo." + provider + "@worldhair.app";
  const users = await readUsers();
  const existing = users.find((u) => u.email === email);
  if (existing) return persistSession(existing);

  const user: StoredUser = {
    userId: "u_" + provider + "_demo",
    email,
    password: "",
    role: "particulier",
    status: "profile_incomplete",
    emailVerified: true,
    profile: null,
    application: null,
    reviewMessage: null,
    createdAt: new Date().toISOString(),
  };
  await writeUsers([...users, user]);
  return persistSession(user);
}

// ─── Email verification ──────────────────────────────────────────────────────

export async function resendVerificationCode(): Promise<void> {
  await delay(500);
  await requireUser();
}

export async function verifyEmail(code: string): Promise<Session> {
  await delay();
  if (code.trim() !== DEMO_VERIFICATION_CODE)
    throw new AuthError("INVALID_CODE", "Code incorrect ou expiré.");

  const user = await requireUser();
  return commit({ ...user, emailVerified: true, status: "profile_incomplete" });
}

// ─── Particulier profile ─────────────────────────────────────────────────────

export async function saveParticulierProfile(
  profile: ParticulierProfile,
): Promise<Session> {
  await delay();
  const user = await requireUser();
  // Demo build: a brand-new particulier gets a populated agenda rather than
  // three empty tabs. No-op once the account has any booking of its own.
  await seedDemoBookings();
  return commit({ ...user, profile, status: "active" });
}

// ─── Coiffeur application ────────────────────────────────────────────────────

export async function submitProApplication(
  application: Omit<ProApplication, "submittedAt">,
): Promise<Session> {
  await delay(900);
  const user = await requireUser();
  return commit({
    ...user,
    role: "coiffeur",
    application: { ...application, submittedAt: new Date().toISOString() },
    status: "pending_review",
  });
}

/** Dev-only shortcut so both review outcomes can be exercised without an API. */
export async function simulateReviewOutcome(
  outcome: "approved" | "rejected",
  message?: string,
): Promise<Session> {
  await delay(400);
  const user = await requireUser();
  return commit({
    ...user,
    status: outcome === "approved" ? "active" : "rejected",
    reviewMessage: message ?? null,
  });
}

// ─── Demo accounts ───────────────────────────────────────────────────────────

/** Ready-made accounts, one per state the app can land a user in. */
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

function demoApplication(): ProApplication {
  return {
    firstName: "Sofia",
    lastName: "Benali",
    phone: "06 12 34 56 78",
    salonName: "Studio W",
    description: "Coupe, coloration et coiffure afro dans un salon lumineux.",
    addressLine: "12 rue des Lilas",
    postalCode: "75011",
    city: "Paris",
    documents: [
      {
        kind: "identity",
        name: "piece-identite.pdf",
        uri: "demo://piece-identite.pdf",
        mimeType: "application/pdf",
        size: 248000,
      },
      {
        kind: "diploma",
        name: "cap-coiffure.pdf",
        uri: "demo://cap-coiffure.pdf",
        mimeType: "application/pdf",
        size: 312000,
      },
    ],
    submittedAt: new Date().toISOString(),
  };
}

function buildDemoUser(persona: DemoPersona): StoredUser {
  const base = {
    userId: "u_demo_" + persona,
    email: "demo." + persona.replace("_", ".") + "@worldhair.app",
    password: "Demo1234",
    emailVerified: true,
    createdAt: new Date().toISOString(),
  };

  if (persona === "particulier")
    return {
      ...base,
      role: "particulier",
      status: "active",
      profile: { firstName: "Camille", lastName: "Durand", photoUri: null },
      application: null,
      reviewMessage: null,
    };

  const application = demoApplication();

  if (persona === "coiffeur_active")
    return {
      ...base,
      role: "coiffeur",
      status: "active",
      profile: {
        firstName: application.firstName,
        lastName: application.lastName,
        photoUri: null,
      },
      application,
      reviewMessage: null,
    };

  if (persona === "coiffeur_pending")
    return {
      ...base,
      role: "coiffeur",
      status: "pending_review",
      profile: null,
      application,
      reviewMessage: null,
    };

  return {
    ...base,
    role: "coiffeur",
    status: "rejected",
    profile: null,
    application,
    reviewMessage:
      "Le diplôme envoyé est illisible. Merci de renvoyer une photo nette.",
  };
}

/**
 * Dev shortcut: drops straight into a persona without going through the forms.
 * The account is rebuilt on every call so a persona always starts clean.
 */
export async function signInAsDemo(persona: DemoPersona): Promise<Session> {
  await delay(300);
  const user = buildDemoUser(persona);
  const users = await readUsers();
  await writeUsers([...users.filter((u) => u.userId !== user.userId), user]);
  // A demo particulier should land on a lived-in agenda, not three empty tabs.
  if (persona === "particulier") await seedDemoBookings();
  return persistSession(user);
}

/** Wipes every mock account — dev reset only. */
export async function resetMockAuth(): Promise<void> {
  await AsyncStorage.multiRemove([USERS_KEY, SESSION_KEY]);
}

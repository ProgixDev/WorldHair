import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { supabase } from "../lib/supabase";
import * as auth from "../services/auth";
import type {
  DemoPersona,
  ParticulierProfile,
  ProApplication,
  Session,
  UserRole,
} from "../services/auth";

interface AuthContextValue {
  session: Session | null;
  /** True until the stored session has been read once. */
  isHydrating: boolean;
  signIn: (email: string, password: string) => Promise<Session>;
  signUp: (email: string, password: string, role: UserRole) => Promise<void>;
  signInWithProvider: (provider: "google" | "apple") => Promise<Session>;
  verifyEmail: (email: string, code: string) => Promise<Session>;
  resendCode: (email: string) => Promise<void>;
  saveParticulierProfile: (profile: ParticulierProfile) => Promise<Session>;
  submitProApplication: (
    application: Omit<ProApplication, "submittedAt">,
  ) => Promise<Session>;
  /** Marks the mandatory post-approval shop-profile screen as done (issue #7). */
  completeShopProfile: () => Promise<Session>;
  /** Re-reads the session — e.g. to check whether an admin decision landed. */
  refresh: () => Promise<Session | null>;
  /** Dev shortcut into a ready-made, really-seeded account (see services/auth.ts). */
  signInAsDemo: (persona: DemoPersona) => Promise<Session>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isHydrating, setIsHydrating] = useState(true);

  useEffect(() => {
    let cancelled = false;
    auth
      .getSession()
      .then((stored) => {
        if (!cancelled) setSession(stored);
      })
      .finally(() => {
        if (!cancelled) setIsHydrating(false);
      });

    // Supabase's own token refresh/sign-out-elsewhere notifications — keeps
    // `session` current without every screen needing to poll for it.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      if (!cancelled) void auth.getSession().then(setSession);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  const capture = useCallback(async (promise: Promise<Session>) => {
    const next = await promise;
    setSession(next);
    return next;
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      isHydrating,
      signIn: (email, password) =>
        capture(auth.signInWithEmail({ email, password })),
      signUp: (email, password, role) =>
        auth.signUpWithEmail({ email, password, role }),
      signInWithProvider: (provider) =>
        capture(auth.signInWithProvider(provider)),
      verifyEmail: (email, code) => capture(auth.verifyEmail(email, code)),
      resendCode: (email) => auth.resendVerificationCode(email),
      saveParticulierProfile: (profile) =>
        capture(auth.saveParticulierProfile(profile)),
      submitProApplication: (application) =>
        capture(auth.submitProApplication(application)),
      completeShopProfile: () => capture(auth.completeShopProfile()),
      refresh: async () => {
        const next = await auth.getSession();
        setSession(next);
        return next;
      },
      signInAsDemo: (persona) => capture(auth.signInAsDemo(persona)),
      signOut: async () => {
        await auth.signOut();
        setSession(null);
      },
    }),
    [session, isHydrating, capture],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context)
    throw new Error("useAuth must be used inside an <AuthProvider>.");
  return context;
}

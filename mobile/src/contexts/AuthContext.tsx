import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
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
  signUp: (email: string, password: string, role: UserRole) => Promise<Session>;
  signInWithProvider: (provider: "google" | "apple") => Promise<Session>;
  verifyEmail: (code: string) => Promise<Session>;
  resendCode: () => Promise<void>;
  saveParticulierProfile: (profile: ParticulierProfile) => Promise<Session>;
  submitProApplication: (
    application: Omit<ProApplication, "submittedAt">,
  ) => Promise<Session>;
  simulateReviewOutcome: (
    outcome: "approved" | "rejected",
    message?: string,
  ) => Promise<Session>;
  /** Marks the mandatory post-approval shop-profile screen as done (issue #7). */
  completeShopProfile: () => Promise<Session>;
  /** Dev shortcut into a ready-made account. */
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
    return () => {
      cancelled = true;
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
        capture(auth.signUpWithEmail({ email, password, role })),
      signInWithProvider: (provider) =>
        capture(auth.signInWithProvider(provider)),
      verifyEmail: (code) => capture(auth.verifyEmail(code)),
      resendCode: () => auth.resendVerificationCode(),
      saveParticulierProfile: (profile) =>
        capture(auth.saveParticulierProfile(profile)),
      submitProApplication: (application) =>
        capture(auth.submitProApplication(application)),
      simulateReviewOutcome: (outcome, message) =>
        capture(auth.simulateReviewOutcome(outcome, message)),
      completeShopProfile: () => capture(auth.completeShopProfile()),
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

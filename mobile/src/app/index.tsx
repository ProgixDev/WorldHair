import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import SplashScreen from "../components/ui/SplashScreen";
import { useAuth } from "../contexts/AuthContext";
import { nextRouteForSession } from "../features/auth/routing";
import { hasSeenOnboarding } from "../services/preferences";

/**
 * Entry gate: plays the splash while the stored session and the onboarding
 * flag hydrate, then hands the user to wherever they left off.
 */
export default function Index() {
  const router = useRouter();
  const { session, isHydrating } = useAuth();
  const [onboardingSeen, setOnboardingSeen] = useState<boolean | null>(null);
  const [splashDone, setSplashDone] = useState(false);

  useEffect(() => {
    let cancelled = false;
    hasSeenOnboarding().then((seen) => {
      if (!cancelled) setOnboardingSeen(seen);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!splashDone || isHydrating || onboardingSeen === null) return;
    router.replace(nextRouteForSession(session, onboardingSeen) as never);
  }, [splashDone, isHydrating, onboardingSeen, session, router]);

  return <SplashScreen onAnimationComplete={() => setSplashDone(true)} />;
}

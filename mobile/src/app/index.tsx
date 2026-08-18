import { useRouter } from "expo-router";
import { useEffect } from "react";
import SplashScreen from "../components/ui/SplashScreen";

export default function Index() {
  const router = useRouter();

  const handleSplashComplete = () => {
    // Navigate to home after splash animation completes
    router.replace("/home" as any);
  };

  return <SplashScreen onAnimationComplete={handleSplashComplete} />;
}

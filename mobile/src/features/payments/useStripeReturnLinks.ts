import { useStripe } from "@stripe/stripe-react-native";
import { useEffect } from "react";
import { Linking } from "react-native";
import { isStripeReturnUrl } from "./stripeReturn";

/**
 * Hands Stripe's return link (after a bank's check, 3-D Secure) to its SDK,
 * which closes its browser and finishes the payment. The router skips that
 * link (src/app/+native-intent.tsx).
 */
export function useStripeReturnLinks(): void {
  const { handleURLCallback } = useStripe();

  useEffect(() => {
    const pass = (url: string | null) => {
      if (url && isStripeReturnUrl(url)) void handleURLCallback(url);
    };
    Linking.getInitialURL()
      .then(pass)
      .catch(() => {});
    const subscription = Linking.addEventListener("url", ({ url }) => pass(url));
    return () => subscription.remove();
  }, [handleURLCallback]);
}

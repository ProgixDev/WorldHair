import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { AuthHeader } from "../../components/ui/AuthHeader";
import { Button } from "../../components/ui/Button";
import { OtpInput } from "../../components/ui/OtpInput";
import { Screen } from "../../components/ui/Screen";
import { useResponsive } from "../../constants/responsive";
import { spacing } from "../../constants/spacing";
import { typography } from "../../constants/typography";
import { useAuth } from "../../contexts/AuthContext";
import { useTheme } from "../../contexts/ThemeContext";
import { ROUTES, nextRouteForSession } from "../../features/auth/routing";
import {
  clearSignupIntent,
  getSignupIntent,
} from "../../services/preferences";
import { AuthError } from "../../services/auth";
import { isValidVerificationCode } from "../../utils/validation";

const RESEND_COOLDOWN_S = 30;

export default function VerifyEmail() {
  const router = useRouter();
  const { theme } = useTheme();
  const { space } = useResponsive();
  const { session, verifyEmail, resendCode, signOut } = useAuth();
  const { email: emailParam } = useLocalSearchParams<{ email?: string }>();

  // Signup leaves no session until verification succeeds, so the email this
  // screen operates on comes from the route param it was navigated with;
  // session.email only ever matters if this screen is somehow re-entered
  // with one already (e.g. resend after a hot reload).
  const email = emailParam ?? session?.email ?? "";

  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_S);
  const [resent, setResent] = useState(false);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => setCooldown((s) => s - 1), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const submit = async (value: string) => {
    if (!isValidVerificationCode(value)) {
      setError("Entrez les 6 chiffres du code.");
      return;
    }

    setError(null);
    setVerifying(true);
    try {
      const next = await verifyEmail(email, value);

      // Honor the role picked at sign-up: a freshly-verified account is
      // still role "particulier" in the database until a coiffeur
      // application is actually submitted (see services/auth.ts), so this
      // is the one place that intent needs to be read back.
      const intent = await getSignupIntent();
      await clearSignupIntent();
      if (intent === "coiffeur" && !next.application) {
        router.replace(ROUTES.proIdentity as never);
      } else {
        router.replace(nextRouteForSession(next, true) as never);
      }
    } catch (err) {
      setError(
        err instanceof AuthError
          ? err.message
          : "Vérification impossible. Réessayez.",
      );
    } finally {
      setVerifying(false);
    }
  };

  const handleResend = async () => {
    setError(null);
    try {
      await resendCode(email);
      setResent(true);
      setCooldown(RESEND_COOLDOWN_S);
    } catch {
      setError("Envoi impossible. Réessayez dans un instant.");
    }
  };

  const handleChangeEmail = async () => {
    await signOut();
    router.replace(ROUTES.signUp as never);
  };

  return (
    <Screen scroll centered>
      <View
        style={{ gap: space(spacing.xl), paddingBottom: space(spacing.xl) }}
      >
        <AuthHeader
          title="Vérifiez votre email"
          subtitle={
            "Nous avons envoyé un code à 6 chiffres à " +
            (email || "votre adresse") +
            "."
          }
          onBack={handleChangeEmail}
        />

        <View style={{ gap: spacing.md }}>
          <OtpInput
            value={code}
            onChange={(value) => {
              setCode(value);
              if (error) setError(null);
            }}
            error={Boolean(error)}
            onComplete={submit}
          />

          {error ? (
            <Text style={[typography.bodySmall, { color: theme.danger }]}>
              {error}
            </Text>
          ) : resent ? (
            <Text style={[typography.bodySmall, { color: theme.success }]}>
              Nouveau code envoyé.
            </Text>
          ) : null}
        </View>

        <View style={{ gap: spacing.md }}>
          <Button
            label="Vérifier mon email"
            onPress={() => submit(code)}
            loading={verifying}
          />

          <Pressable
            onPress={handleResend}
            disabled={cooldown > 0}
            accessibilityRole="button"
            hitSlop={8}
            style={{ alignItems: "center", paddingVertical: spacing.sm }}
          >
            <Text
              style={[
                typography.label,
                {
                  color:
                    cooldown > 0 ? theme.foreground.gray : theme.primary.main,
                },
              ]}
            >
              {cooldown > 0
                ? "Renvoyer le code dans " + cooldown + " s"
                : "Renvoyer le code"}
            </Text>
          </Pressable>

          <Pressable
            onPress={handleChangeEmail}
            accessibilityRole="button"
            hitSlop={8}
            style={{ alignItems: "center", paddingVertical: spacing.xs }}
          >
            <Text
              style={[typography.bodySmall, { color: theme.foreground.gray }]}
            >
              Utiliser une autre adresse
            </Text>
          </Pressable>
        </View>
      </View>
    </Screen>
  );
}

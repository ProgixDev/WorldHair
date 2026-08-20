import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { AuthHeader } from "../../components/ui/AuthHeader";
import { Button } from "../../components/ui/Button";
import { OtpInput } from "../../components/ui/OtpInput";
import { Screen } from "../../components/ui/Screen";
import { useResponsive } from "../../constants/responsive";
import { radius, spacing } from "../../constants/spacing";
import { typography } from "../../constants/typography";
import { useAuth } from "../../contexts/AuthContext";
import { useTheme } from "../../contexts/ThemeContext";
import { ROUTES, nextRouteForSession } from "../../features/auth/routing";
import { AuthError, DEMO_VERIFICATION_CODE } from "../../services/auth";
import { isValidVerificationCode } from "../../utils/validation";

const RESEND_COOLDOWN_S = 30;

export default function VerifyEmail() {
  const router = useRouter();
  const { theme } = useTheme();
  const { space } = useResponsive();
  const { session, verifyEmail, resendCode, signOut } = useAuth();

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
      const next = await verifyEmail(value);
      router.replace(nextRouteForSession(next, true) as never);
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
      await resendCode();
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
            (session?.email ?? "votre adresse") +
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

        {/* Frontend-only build: no mail is actually sent. */}
        <View
          style={{
            flexDirection: "row",
            gap: spacing.md,
            padding: spacing.lg,
            borderRadius: radius.lg,
            backgroundColor: theme.surface.base,
            borderWidth: 1,
            borderColor: theme.border,
          }}
        >
          <MaterialCommunityIcons
            name="information-outline"
            size={20}
            color={theme.primary.main}
          />
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={[typography.label, { color: theme.foreground.white }]}>
              Mode démo
            </Text>
            <Text
              style={[typography.caption, { color: theme.foreground.gray }]}
            >
              {"Aucun email n'est envoyé pour l'instant. Utilisez le code " +
                DEMO_VERIFICATION_CODE +
                "."}
            </Text>
          </View>
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

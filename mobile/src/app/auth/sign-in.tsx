import { useRouter } from "expo-router";
import React, { useState } from "react";
import { Platform, Pressable, Text, View } from "react-native";
import { Button } from "../../components/ui/Button";
import { DemoLoginBar } from "../../components/ui/DemoLoginBar";
import { Screen } from "../../components/ui/Screen";
import { SocialButton } from "../../components/ui/SocialButton";
import { TextField } from "../../components/ui/TextField";
import { useResponsive } from "../../constants/responsive";
import { spacing } from "../../constants/spacing";
import { typography } from "../../constants/typography";
import { useAuth } from "../../contexts/AuthContext";
import { useTheme } from "../../contexts/ThemeContext";
import { ROUTES, nextRouteForSession } from "../../features/auth/routing";
import { AuthError, type DemoPersona } from "../../services/auth";
import { isValidEmail } from "../../utils/validation";

export default function SignIn() {
  const router = useRouter();
  const { theme } = useTheme();
  const { space } = useResponsive();
  const { signIn, signInWithProvider, signInAsDemo } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ email?: string; password?: string }>(
    {},
  );
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState<null | "email" | "google" | "apple">(
    null,
  );
  const [demoPending, setDemoPending] = useState<DemoPersona | null>(null);

  const validate = () => {
    const next: typeof errors = {};
    if (!isValidEmail(email)) next.email = "Email invalide.";
    if (password.length === 0) next.password = "Mot de passe requis.";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSignIn = async () => {
    setFormError(null);
    if (!validate()) return;

    setPending("email");
    try {
      const session = await signIn(email, password);
      router.replace(nextRouteForSession(session, true) as never);
    } catch (error) {
      setFormError(
        error instanceof AuthError
          ? error.message
          : "Connexion impossible. Réessayez.",
      );
    } finally {
      setPending(null);
    }
  };

  const handleProvider = async (provider: "google" | "apple") => {
    setFormError(null);
    setPending(provider);
    try {
      const session = await signInWithProvider(provider);
      router.replace(nextRouteForSession(session, true) as never);
    } catch {
      setFormError("Connexion impossible. Réessayez.");
    } finally {
      setPending(null);
    }
  };

  const handleDemo = async (persona: DemoPersona) => {
    setFormError(null);
    setDemoPending(persona);
    try {
      const session = await signInAsDemo(persona);
      router.replace(nextRouteForSession(session, true) as never);
    } catch {
      setFormError("Connexion démo impossible.");
    } finally {
      setDemoPending(null);
    }
  };

  return (
    <Screen scroll centered contentStyle={{ justifyContent: "center" }}>
      <View
        style={{ gap: space(spacing.xl), paddingVertical: space(spacing.xl) }}
      >
        <View style={{ alignItems: "center", gap: spacing.xs }}>
          <Text
            style={[typography.wordmark, { color: theme.foreground.white }]}
          >
            WorldHair
          </Text>
          <Text style={[typography.overline, { color: theme.accent.warm }]}>
            LA BEAUTÉ, PARTOUT.
          </Text>
        </View>

        <View style={{ gap: spacing.sm }}>
          <Text
            style={[typography.h1, { color: theme.foreground.white }]}
            accessibilityRole="header"
          >
            Content de vous revoir.
          </Text>
          <Text style={[typography.body, { color: theme.foreground.gray }]}>
            Connectez-vous pour réserver en quelques secondes.
          </Text>
        </View>

        <View style={{ gap: spacing.lg }}>
          <TextField
            label="Email"
            value={email}
            onChangeText={setEmail}
            placeholder="vous@exemple.fr"
            keyboardType="email-address"
            autoComplete="email"
            textContentType="emailAddress"
            icon="email-outline"
            error={errors.email}
          />
          <TextField
            label="Mot de passe"
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            secure
            autoComplete="current-password"
            textContentType="password"
            icon="lock-outline"
            error={errors.password}
          />

          {formError ? (
            <Text style={[typography.bodySmall, { color: theme.danger }]}>
              {formError}
            </Text>
          ) : null}

          <Button
            label="Se connecter"
            onPress={handleSignIn}
            loading={pending === "email"}
            disabled={
              demoPending !== null || (pending !== null && pending !== "email")
            }
          />
        </View>

        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.md,
          }}
        >
          <View style={{ flex: 1, height: 1, backgroundColor: theme.border }} />
          <Text style={[typography.caption, { color: theme.foreground.gray }]}>
            ou
          </Text>
          <View style={{ flex: 1, height: 1, backgroundColor: theme.border }} />
        </View>

        <View style={{ gap: spacing.md }}>
          <SocialButton
            provider="google"
            onPress={() => handleProvider("google")}
            loading={pending === "google"}
            disabled={
              demoPending !== null || (pending !== null && pending !== "google")
            }
          />
          {Platform.OS === "ios" ? (
            <SocialButton
              provider="apple"
              onPress={() => handleProvider("apple")}
              loading={pending === "apple"}
              disabled={
                demoPending !== null ||
                (pending !== null && pending !== "apple")
              }
            />
          ) : null}
        </View>

        {/* Dev-only: no backend yet, so each persona can be entered directly. */}
        <DemoLoginBar
          onSelect={handleDemo}
          pending={demoPending}
          disabled={pending !== null}
        />

        <View
          style={{
            flexDirection: "row",
            justifyContent: "center",
            alignItems: "center",
            gap: spacing.xs,
            flexWrap: "wrap",
          }}
        >
          <Text
            style={[typography.bodySmall, { color: theme.foreground.gray }]}
          >
            Pas encore de compte ?
          </Text>
          <Pressable
            onPress={() => router.push(ROUTES.signUp as never)}
            accessibilityRole="link"
            hitSlop={8}
          >
            <Text style={[typography.label, { color: theme.primary.main }]}>
              Créer un compte
            </Text>
          </Pressable>
        </View>
      </View>
    </Screen>
  );
}

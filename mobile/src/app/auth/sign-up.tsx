import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import { Platform, Pressable, Text, View } from "react-native";
import { AuthHeader } from "../../components/ui/AuthHeader";
import { Button } from "../../components/ui/Button";
import { Checkbox } from "../../components/ui/Checkbox";
import { Screen } from "../../components/ui/Screen";
import { SegmentedControl } from "../../components/ui/SegmentedControl";
import { SocialButton } from "../../components/ui/SocialButton";
import { TextField } from "../../components/ui/TextField";
import { useResponsive } from "../../constants/responsive";
import { spacing } from "../../constants/spacing";
import { typography } from "../../constants/typography";
import { useAuth } from "../../contexts/AuthContext";
import { useTheme } from "../../contexts/ThemeContext";
import { ROUTES, nextRouteForSession } from "../../features/auth/routing";
import { AuthError, type UserRole } from "../../services/auth";
import { checkPassword, isValidEmail } from "../../utils/validation";

export default function SignUp() {
  const router = useRouter();
  const { theme } = useTheme();
  const { space } = useResponsive();
  const { signUp, signInWithProvider } = useAuth();

  const [role, setRole] = useState<UserRole>("particulier");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [errors, setErrors] = useState<{
    email?: string;
    password?: string;
    terms?: string;
  }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState<null | "email" | "google" | "apple">(
    null,
  );

  const strength = useMemo(() => checkPassword(password), [password]);

  const validate = () => {
    const next: typeof errors = {};
    if (!isValidEmail(email)) next.email = "Email invalide.";
    if (!strength.isValid)
      next.password = "Il manque : " + strength.issues.join(", ") + ".";
    if (!acceptedTerms) next.terms = "Vous devez accepter les CGU.";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSignUp = async () => {
    setFormError(null);
    if (!validate()) return;

    setPending("email");
    try {
      await signUp(email, password, role);
      router.replace(ROUTES.verifyEmail as never);
    } catch (error) {
      setFormError(
        error instanceof AuthError
          ? error.message
          : "Inscription impossible. Réessayez.",
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

  return (
    <Screen scroll centered>
      <View
        style={{ gap: space(spacing.xl), paddingBottom: space(spacing.xl) }}
      >
        <AuthHeader
          title="Créer un compte"
          subtitle="Quelques secondes suffisent pour commencer."
        />

        <SegmentedControl
          label="Je suis"
          value={role}
          onChange={setRole}
          options={[
            {
              value: "particulier",
              label: "Particulier",
              hint: "Je réserve",
            },
            {
              value: "coiffeur",
              label: "Coiffeur",
              hint: "Je propose mes services",
            },
          ]}
        />

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
            placeholder="8 caractères minimum"
            secure
            autoComplete="new-password"
            textContentType="newPassword"
            icon="lock-outline"
            error={errors.password}
            helper="8 caractères, une majuscule, une minuscule et un chiffre."
          />

          <PasswordMeter score={strength.score} />

          <Checkbox
            checked={acceptedTerms}
            onChange={setAcceptedTerms}
            error={errors.terms}
            accessibilityLabel="J'accepte les conditions générales d'utilisation"
          >
            <Text
              style={[typography.bodySmall, { color: theme.foreground.gray }]}
            >
              J&apos;accepte les{" "}
              <Text style={{ color: theme.primary.main }}>
                conditions générales
              </Text>{" "}
              et la{" "}
              <Text style={{ color: theme.primary.main }}>
                politique de confidentialité
              </Text>
              .
            </Text>
          </Checkbox>

          {formError ? (
            <Text style={[typography.bodySmall, { color: theme.danger }]}>
              {formError}
            </Text>
          ) : null}

          <Button
            label={
              role === "coiffeur"
                ? "Continuer mon inscription pro"
                : "Créer mon compte"
            }
            onPress={handleSignUp}
            loading={pending === "email"}
            disabled={pending !== null && pending !== "email"}
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
            disabled={pending !== null && pending !== "google"}
          />
          {Platform.OS === "ios" ? (
            <SocialButton
              provider="apple"
              onPress={() => handleProvider("apple")}
              loading={pending === "apple"}
              disabled={pending !== null && pending !== "apple"}
            />
          ) : null}
        </View>

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
            Déjà inscrit ?
          </Text>
          <Pressable
            onPress={() => router.replace(ROUTES.signIn as never)}
            accessibilityRole="link"
            hitSlop={8}
          >
            <Text style={[typography.label, { color: theme.primary.main }]}>
              Se connecter
            </Text>
          </Pressable>
        </View>
      </View>
    </Screen>
  );
}

/** Four-segment strength rail fed by `checkPassword`. */
function PasswordMeter({ score }: { score: number }) {
  const { theme } = useTheme();
  const labels = ["Trop faible", "Faible", "Correct", "Solide"];
  const colors = [
    theme.danger,
    theme.accent.warm,
    theme.primary.main,
    theme.success,
  ];

  return (
    <View style={{ gap: spacing.xs }}>
      <View style={{ flexDirection: "row", gap: spacing.xs }}>
        {[0, 1, 2, 3].map((segment) => (
          <View
            key={segment}
            style={{
              flex: 1,
              height: 4,
              borderRadius: 2,
              backgroundColor:
                score > segment
                  ? colors[Math.min(score, 4) - 1]
                  : theme.background.accent,
            }}
          />
        ))}
      </View>
      {score > 0 ? (
        <Text style={[typography.caption, { color: theme.foreground.gray }]}>
          {labels[Math.min(score, 4) - 1]}
        </Text>
      ) : null}
    </View>
  );
}

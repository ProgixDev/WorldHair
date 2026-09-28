import { useRouter } from "expo-router";
import React, { useState } from "react";
import { Modal, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { spacing } from "../constants/spacing";
import { typography } from "../constants/typography";
import { useAuth } from "../contexts/AuthContext";
import { useTheme } from "../contexts/ThemeContext";
import { ROUTES } from "../features/auth/routing";
import { mustAcceptTerms, openLegalPage } from "../features/legal/terms";
import { acceptTerms } from "../services/account";
import { Button } from "./ui/Button";

/**
 * New CGU or privacy policy (TODO.md Phase 8): a signed-in user who
 * accepted another version, or none (accounts made before they existed),
 * accepts the current one before going on — or signs out.
 */
export function TermsGate() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { session, refresh, signOut } = useAuth();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const accept = async () => {
    setSaving(true);
    setError(null);
    try {
      await acceptTerms();
      await refresh();
    } catch {
      setError("Votre accord n'a pas pu être enregistré. Vérifiez votre connexion et réessayez.");
    } finally {
      setSaving(false);
    }
  };

  const leave = async () => {
    await signOut();
    router.replace(ROUTES.signIn as never);
  };

  return (
    <Modal visible={mustAcceptTerms(session)} animationType="fade" onRequestClose={() => {}}>
      <ScrollView
        style={{ flex: 1, backgroundColor: theme.background.dark }}
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: "center",
          gap: spacing.lg,
          paddingHorizontal: spacing.xl,
          paddingTop: insets.top + spacing.xl,
          paddingBottom: insets.bottom + spacing.xl,
        }}
      >
        <Text style={[typography.overline, { color: theme.foreground.gray }]}>WORLDHAIR</Text>
        <Text style={[typography.h1, { color: theme.foreground.white }]}>Nos conditions évoluent</Text>
        <Text style={[typography.body, { color: theme.foreground.gray }]}>
          Pour continuer à utiliser WorldHair, prenez connaissance de nos conditions générales d&apos;utilisation
          et de notre politique de confidentialité, puis acceptez-les.
        </Text>

        <View style={{ gap: spacing.sm }}>
          <Text
            style={[typography.body, { color: theme.primary.main, textDecorationLine: "underline" }]}
            onPress={() => void openLegalPage("cgu")}
            accessibilityRole="link"
          >
            Conditions générales d&apos;utilisation
          </Text>
          <Text
            style={[typography.body, { color: theme.primary.main, textDecorationLine: "underline" }]}
            onPress={() => void openLegalPage("confidentialite")}
            accessibilityRole="link"
          >
            Politique de confidentialité
          </Text>
        </View>

        {error ? <Text style={[typography.bodySmall, { color: theme.danger }]}>{error}</Text> : null}

        <View style={{ gap: spacing.sm, marginTop: spacing.md }}>
          <Button label="J'accepte" onPress={() => void accept()} loading={saving} />
          <Button label="Se déconnecter" variant="outline" onPress={() => void leave()} disabled={saving} />
        </View>
      </ScrollView>
    </Modal>
  );
}

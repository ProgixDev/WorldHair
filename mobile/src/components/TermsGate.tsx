import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { Modal, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { spacing } from "../constants/spacing";
import { typography } from "../constants/typography";
import { useAuth } from "../contexts/AuthContext";
import { useTheme } from "../contexts/ThemeContext";
import { ROUTES } from "../features/auth/routing";
import { openLegalPage } from "../features/legal/terms";
import { acceptTerms, termsUpToDate } from "../services/account";
import { MyDataGroups } from "./account/MyDataGroups";
import { Button } from "./ui/Button";

/**
 * New CGU or privacy policy (TODO.md Phase 8): a signed-in user who
 * accepted another version, or none (accounts made before they existed),
 * accepts the current one before going on — or signs out, or deletes the
 * account. The server says which version is in force, so an app older
 * than it never loops.
 */
export function TermsGate() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { session, signOut } = useAuth();
  const [mustAccept, setMustAccept] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const userId = session?.userId ?? null;
  const emailVerified = session?.emailVerified ?? false;

  // Asked afresh for each account signed in; an answer for an account signed out meanwhile is dropped.
  useEffect(() => {
    let current = true;
    const check = userId && emailVerified ? termsUpToDate() : Promise.resolve(true);
    void check.then((upToDate) => {
      if (current) setMustAccept(!upToDate);
    });
    return () => {
      current = false;
    };
  }, [userId, emailVerified]);

  const accept = async () => {
    setSaving(true);
    setError(null);
    try {
      await acceptTerms();
      setMustAccept(!(await termsUpToDate()));
    } catch {
      setError("Votre accord n'a pas pu être enregistré. Vérifiez votre connexion et réessayez.");
    } finally {
      setSaving(false);
    }
  };

  const leave = async () => {
    setMustAccept(false);
    await signOut();
    router.replace(ROUTES.signIn as never);
  };

  return (
    <Modal visible={mustAccept && userId !== null} animationType="fade" onRequestClose={() => {}}>
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

        {/* Declining the new terms: the account and its data can still go. */}
        <MyDataGroups variant="links" />
      </ScrollView>
    </Modal>
  );
}

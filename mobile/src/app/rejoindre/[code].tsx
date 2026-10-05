import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect } from "react";
import { ActivityIndicator, Alert, View } from "react-native";
import { useAuth } from "../../contexts/AuthContext";
import { useTheme } from "../../contexts/ThemeContext";
import { routeForInviteLink } from "../../features/auth/routing";
import { setPendingJoinCode, setSignupIntent } from "../../services/preferences";
import { normalizeInviteCode } from "../../services/staff";

/**
 * Where the salon owner's QR code or link lands (« worldhair://rejoindre/
 * CODE », from the website's /rejoindre page — TODO.md Phase 3). Keeps the
 * code for « Rejoindre un salon », then sends the account where it can use
 * it: sign-up for someone new, the join screen for a client or a staff
 * account between salons.
 */
export default function InviteLink() {
  const router = useRouter();
  const { theme } = useTheme();
  const { session, isHydrating } = useAuth();
  const { code } = useLocalSearchParams<{ code: string }>();

  useEffect(() => {
    if (isHydrating) return;
    let current = true;
    void (async () => {
      const route = routeForInviteLink(session);
      // Only an account that can join keeps the code: never an owner's, nor a staff member's already in a salon
      // (`undefined`: their salon couldn't be read — kept, for when it can).
      const canJoin = !session || session.role === "particulier" || (session.role === "staff" && !session.staffMembership);
      if (canJoin) {
        await setPendingJoinCode(normalizeInviteCode(code ?? ""));
        if (!session || session.role === "particulier") await setSignupIntent("staff");
      }
      if (!current) return;
      router.replace(route as never);
      if (session?.role === "staff" && session.staffMembership) {
        Alert.alert(
          "Vous faites déjà partie d'un salon",
          "Pour rejoindre celui-ci, quittez d'abord " + session.staffMembership.salonName + " depuis votre compte.",
        );
      } else if (session?.role === "coiffeur") {
        Alert.alert("Lien pour les coiffeurs d'un salon", "Ce lien sert à rejoindre l'équipe d'un salon : votre compte gère déjà le sien.");
      }
    })();
    return () => {
      current = false;
    };
  }, [isHydrating, session, code, router]);

  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: theme.background.dark }}>
      <ActivityIndicator color={theme.primary.main} />
    </View>
  );
}

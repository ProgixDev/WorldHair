import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useState } from "react";
import { Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { radius, spacing } from "../../constants/spacing";
import { typography } from "../../constants/typography";
import { usePro } from "../../contexts/ProContext";
import { useTheme } from "../../contexts/ThemeContext";
import { Button } from "../ui/Button";
import { MyDataGroups } from "../account/MyDataGroups";

/**
 * Full-screen block once the subscription has ended (issue #8): a
 * translucent cover over the whole pro area, message centered. It states
 * the fact only — renewing happens outside the app (App Store rule
 * 3.1.3(f)); the button reads the status again once it has.
 */
export function SubscriptionExpiredOverlay() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { refreshSubscription } = usePro();
  const [busy, setBusy] = useState(false);
  const [stillExpired, setStillExpired] = useState(false);

  const handleRefresh = async () => {
    setBusy(true);
    try {
      await refreshSubscription();
      // Still mounted means still expired: say so rather than look stuck.
      setStillExpired(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: theme.surface.glass,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: spacing.xl,
        paddingTop: insets.top,
        paddingBottom: insets.bottom,
      }}
    >
      <View
        style={{
          width: "100%",
          maxWidth: 360,
          alignItems: "center",
          gap: spacing.lg,
          padding: spacing.xl,
          borderRadius: radius.xl,
          backgroundColor: theme.surface.raised,
          borderWidth: 1,
          borderColor: theme.danger,
        }}
      >
        <View
          style={{
            width: 72,
            height: 72,
            borderRadius: radius.full,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: theme.danger + "1f",
          }}
        >
          <MaterialCommunityIcons
            name="lock-outline"
            size={32}
            color={theme.danger}
          />
        </View>

        <View style={{ gap: spacing.sm, alignItems: "center" }}>
          <Text
            style={[
              typography.h1,
              { color: theme.foreground.white, textAlign: "center" },
            ]}
            accessibilityRole="header"
          >
            Abonnement terminé
          </Text>
          <Text
            style={[
              typography.bodySmall,
              { color: theme.foreground.gray, textAlign: "center" },
            ]}
          >
            Votre fiche n&apos;est plus visible par les clients et votre
            espace pro est en pause.
          </Text>
          {stillExpired ? (
            <Text
              style={[
                typography.caption,
                { color: theme.danger, textAlign: "center" },
              ]}
            >
              Toujours aucun abonnement actif.
            </Text>
          ) : null}
        </View>

        <Button
          label="Actualiser"
          onPress={() => void handleRefresh()}
          loading={busy}
          background={theme.primary.main}
          color={theme.primary.on}
          style={{ width: "100%" }}
        />

        {/* Leaving WorldHair stays possible behind the veil (TODO.md Phase 8). */}
        <MyDataGroups variant="links" />
      </View>
    </View>
  );
}

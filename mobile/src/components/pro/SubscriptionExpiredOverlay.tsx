import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useState } from "react";
import { Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { radius, spacing } from "../../constants/spacing";
import { typography } from "../../constants/typography";
import { usePro } from "../../contexts/ProContext";
import { useTheme } from "../../contexts/ThemeContext";
import { Button } from "../ui/Button";

/**
 * Full-screen block once the subscription has lapsed (issue #8): a
 * translucent cover over the whole pro area, message centered, one way out.
 * Real billing goes through the phone's store; this mock reactivates
 * straight away, same as the button on the account tab.
 */
export function SubscriptionExpiredOverlay() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { reactivateSubscription } = usePro();
  const [busy, setBusy] = useState(false);

  const handleReactivate = async () => {
    setBusy(true);
    try {
      await reactivateSubscription();
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
            Réabonnez-vous pour retrouver votre agenda, vos prestations et
            votre fiche visible par les clients.
          </Text>
        </View>

        <Button
          label="Se réabonner"
          onPress={() => void handleReactivate()}
          loading={busy}
          background={theme.primary.main}
          color={theme.primary.on}
          style={{ width: "100%" }}
        />
      </View>
    </View>
  );
}

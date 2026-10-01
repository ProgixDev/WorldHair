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
 * The salon's workspace couldn't be read (no network, server down): a
 * cover over the pro area with a way to try again, rather than screens
 * that spin forever.
 */
export function ProLoadFailed() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { retry } = usePro();
  const [busy, setBusy] = useState(false);

  const handleRetry = async () => {
    setBusy(true);
    await retry();
    setBusy(false);
  };

  return (
    <View
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: theme.background.dark,
        alignItems: "center",
        justifyContent: "center",
        gap: spacing.lg,
        paddingHorizontal: spacing.xl,
        paddingTop: insets.top,
        paddingBottom: insets.bottom,
      }}
    >
      <View
        style={{
          width: 72,
          height: 72,
          borderRadius: radius.full,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: theme.surface.raised,
        }}
      >
        <MaterialCommunityIcons name="wifi-off" size={32} color={theme.foreground.gray} />
      </View>
      <Text style={[typography.h2, { color: theme.foreground.white, textAlign: "center" }]}>
        Impossible de charger votre salon
      </Text>
      <Text style={[typography.body, { color: theme.foreground.gray, textAlign: "center" }]}>
        Vérifiez votre connexion et réessayez.
      </Text>
      <Button
        label="Réessayer"
        onPress={() => void handleRetry()}
        loading={busy}
        background={theme.primary.main}
        color={theme.primary.on}
        style={{ width: "100%", maxWidth: 360 }}
      />
    </View>
  );
}

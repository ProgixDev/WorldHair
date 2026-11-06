import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from "react-native";
import { EmptyState } from "../components/ui/EmptyState";
import { Group, RowShell } from "../components/ui/SettingsList";
import { useResponsive } from "../constants/responsive";
import { MIN_TOUCH_SIZE, spacing } from "../constants/spacing";
import { typography } from "../constants/typography";
import { useTheme } from "../contexts/ThemeContext";
import { listBlockedUsers, unblockUser, type BlockedUser } from "../features/reviews/block";
import { dayAndMonth } from "../utils/date";

/**
 * « Utilisateurs bloqués » (App Store guideline 1.2), from Mes données: the
 * people whose reviews this person no longer sees, each one to unblock.
 */
export default function BlockedUsersScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const { gutter } = useResponsive();
  const [blocked, setBlocked] = useState<BlockedUser[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [unblocking, setUnblocking] = useState<string | null>(null);

  const load = useCallback(async () => {
    setFailed(false);
    try {
      setBlocked(await listBlockedUsers());
    } catch {
      setFailed(true);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const unblock = async (user: BlockedUser) => {
    setUnblocking(user.userId);
    try {
      await unblockUser(user.userId);
      setBlocked((current) => (current ?? []).filter((item) => item.userId !== user.userId));
    } catch {
      Alert.alert("Déblocage impossible", "Vérifiez votre connexion et réessayez.");
    } finally {
      setUnblocking(null);
    }
  };

  const confirmUnblock = (user: BlockedUser) =>
    Alert.alert("Débloquer " + user.name + " ?", "Ses avis s'afficheront de nouveau.", [
      { text: "Annuler", style: "cancel" },
      { text: "Débloquer", onPress: () => void unblock(user) },
    ]);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.background.dark }}
      contentContainerStyle={{
        paddingHorizontal: gutter,
        paddingTop: spacing.sm,
        paddingBottom: spacing.xxl,
        gap: spacing.xl,
      }}
      showsVerticalScrollIndicator={false}
    >
      <View style={{ gap: spacing.sm }}>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Retour"
          hitSlop={8}
          style={{
            width: MIN_TOUCH_SIZE,
            height: MIN_TOUCH_SIZE,
            marginLeft: -spacing.md,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <MaterialCommunityIcons name="chevron-left" size={28} color={theme.foreground.white} />
        </Pressable>
        <Text style={[typography.display, { color: theme.foreground.white }]} accessibilityRole="header">
          Utilisateurs bloqués
        </Text>
        <Text style={[typography.bodySmall, { color: theme.foreground.gray }]}>
          Vous ne voyez plus les avis des personnes que vous avez bloquées. Elles n&apos;en sont pas prévenues.
        </Text>
      </View>

      {failed ? (
        <EmptyState
          icon="wifi-off"
          title="Chargement impossible"
          message="Vérifiez votre connexion et réessayez."
          action={{ label: "Réessayer", onPress: () => void load() }}
        />
      ) : blocked === null ? (
        <ActivityIndicator color={theme.primary.main} style={{ marginTop: spacing.xl }} />
      ) : blocked.length === 0 ? (
        <EmptyState
          icon="account-cancel-outline"
          title="Personne de bloqué"
          message="Depuis le « ⋯ » d'un avis, vous pouvez bloquer son auteur : vous ne verrez plus ses avis."
        />
      ) : (
        <Group title="Bloqués">
          {blocked.map((user, index) => (
            <RowShell
              key={user.userId}
              icon="account-cancel-outline"
              label={user.name}
              value={"Bloqué le " + dayAndMonth(new Date(user.blockedAt))}
              isLast={index === blocked.length - 1}
              right={
                <Pressable
                  onPress={() => confirmUnblock(user)}
                  disabled={unblocking !== null}
                  accessibilityRole="button"
                  accessibilityLabel={"Débloquer " + user.name}
                  hitSlop={8}
                >
                  <Text style={[typography.label, { color: theme.primary.main }]}>
                    {unblocking === user.userId ? "…" : "Débloquer"}
                  </Text>
                </Pressable>
              }
            />
          ))}
        </Group>
      )}
    </ScrollView>
  );
}

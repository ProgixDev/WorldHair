import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { MyDataGroups } from "../../components/account/MyDataGroups";
import { Group, Row, RowShell } from "../../components/ui/SettingsList";
import { elevation } from "../../constants/elevation";
import { useResponsive } from "../../constants/responsive";
import { MIN_TOUCH_SIZE, radius, spacing } from "../../constants/spacing";
import { typography } from "../../constants/typography";
import { useAuth } from "../../contexts/AuthContext";
import { useTheme } from "../../contexts/ThemeContext";
import { ROUTES } from "../../features/auth/routing";
import { initials } from "../../features/salons/images";
import { leaveSalon, staffErrorMessage } from "../../services/staff";

/**
 * A staff member's account (TODO.md Phase 3): who they are, where they
 * work, leaving the salon — refused while bookings to come are theirs, the
 * owner reassigns those first — and « Mes données ».
 */
export default function StaffAccount() {
  const router = useRouter();
  const { theme } = useTheme();
  const { gutter } = useResponsive();
  const { session, refresh, signOut } = useAuth();
  const [leaving, setLeaving] = useState(false);

  const profile = session?.profile ?? null;
  const fullName = profile ? profile.firstName + " " + profile.lastName : "Votre profil";
  const salonName = session?.staffMembership?.salonName ?? null;

  const leave = async () => {
    setLeaving(true);
    try {
      await leaveSalon();
      // No salon any more: the session says so, and « Rejoindre un salon » takes over.
      await refresh().catch(() => null);
      router.replace(ROUTES.joinSalon as never);
    } catch (err) {
      Alert.alert("Impossible de quitter le salon", staffErrorMessage(err));
    } finally {
      setLeaving(false);
    }
  };

  const handleLeave = () =>
    Alert.alert(
      salonName ? "Quitter " + salonName + " ?" : "Quitter le salon ?",
      "Vous ne verrez plus son agenda. Pour y revenir, il vous faudra un nouveau code de son gérant.",
      [
        { text: "Annuler", style: "cancel" },
        { text: "Quitter le salon", style: "destructive", onPress: () => void leave() },
      ],
    );

  const handleSignOut = () =>
    Alert.alert("Se déconnecter ?", "Vous devrez saisir vos identifiants.", [
      { text: "Annuler", style: "cancel" },
      {
        text: "Se déconnecter",
        style: "destructive",
        onPress: async () => {
          await signOut();
          router.replace(ROUTES.signIn as never);
        },
      },
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
          onPress={() => (router.canGoBack() ? router.back() : router.replace(ROUTES.staffAgenda as never))}
          accessibilityRole="button"
          accessibilityLabel="Retour à mon agenda"
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
          Compte
        </Text>
      </View>

      {/* ── Identity ─────────────────────────────────────────────────────── */}
      <View
        style={[
          {
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.lg,
            padding: spacing.lg,
            borderRadius: radius.xl,
            backgroundColor: theme.surface.raised,
            borderWidth: 1,
            borderColor: theme.divider,
          },
          elevation(1, theme.shadow),
        ]}
      >
        <View
          style={{
            width: 72,
            height: 72,
            borderRadius: radius.full,
            overflow: "hidden",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: theme.surface.base,
            borderWidth: 2,
            borderColor: theme.accent.warm,
          }}
        >
          {profile?.photoUri ? (
            <Image source={{ uri: profile.photoUri }} style={{ width: 72, height: 72 }} contentFit="cover" />
          ) : (
            <Text style={[typography.h1, { color: theme.accent.warm }]}>{profile ? initials(fullName) : "?"}</Text>
          )}
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[typography.h2, { color: theme.foreground.white }]} numberOfLines={1}>
            {fullName}
          </Text>
          <Text style={[typography.bodySmall, { color: theme.foreground.gray }]} numberOfLines={1}>
            {session?.email ?? ""}
          </Text>
          {salonName ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs, marginTop: spacing.xs }}>
              <MaterialCommunityIcons name="storefront-outline" size={13} color={theme.accent.warm} />
              <Text style={[typography.caption, { color: theme.accent.warm, flex: 1 }]} numberOfLines={2}>
                {"Vous travaillez chez " + salonName}
              </Text>
            </View>
          ) : null}
        </View>
      </View>

      {/* ── The salon ────────────────────────────────────────────────────── */}
      <View style={{ gap: spacing.md }}>
        <Group title="Mon salon">
          <RowShell icon="storefront-outline" label="Salon" value={salonName ?? "—"} />
          <Row
            icon="exit-run"
            label={leaving ? "Départ en cours…" : "Quitter le salon"}
            tone="danger"
            onPress={() => {
              if (!leaving) handleLeave();
            }}
            isLast
          />
        </Group>
        <Text style={[typography.caption, { color: theme.foreground.gray }]}>
          Le gérant du salon accepte, déplace et annule les rendez-vous ; vous les retrouvez dans votre agenda.
        </Text>
      </View>

      {/* ── Preferences ──────────────────────────────────────────────────── */}
      <Group title="Préférences">
        <Row
          icon="palette-outline"
          label="Apparence"
          value="Clair, sombre ou système"
          onPress={() => router.push("/screens/Themes" as never)}
          isLast
        />
      </Group>

      {/* ── Account ──────────────────────────────────────────────────────── */}
      <Group title="Compte">
        <Row
          icon="account-edit-outline"
          label="Modifier mon profil"
          value="Prénom, nom et photo"
          onPress={() => router.push(ROUTES.profileSetup as never)}
        />
        <Row icon="logout" label="Se déconnecter" tone="danger" onPress={handleSignOut} isLast />
      </Group>

      {/* ── My data, legal pages (TODO.md Phase 8) ───────────────────────── */}
      <MyDataGroups />
    </ScrollView>
  );
}

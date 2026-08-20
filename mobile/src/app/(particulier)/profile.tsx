import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useResponsive } from "../../constants/responsive";
import { radius, spacing } from "../../constants/spacing";
import { typography } from "../../constants/typography";
import { useAuth } from "../../contexts/AuthContext";
import { useLocation } from "../../contexts/LocationContext";
import { useTheme } from "../../contexts/ThemeContext";
import { initials } from "../../features/salons/covers";
import { ROUTES } from "../../features/auth/routing";
import { resetMockAuth } from "../../services/auth";
import {
  isUpcoming,
  listAppointments,
  listUserReviews,
  resetBookingData,
} from "../../services/booking";
import { clearPreferences } from "../../services/preferences";

/** Account tab: identity block, two counters, then a plain settings list. */
export default function Profile() {
  const router = useRouter();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { gutter } = useResponsive();
  const { session, signOut } = useAuth();
  const { status, isFallback, manualLabel, enable } = useLocation();

  const [counts, setCounts] = useState({ upcoming: 0, reviews: 0 });

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      Promise.all([listAppointments(), listUserReviews()]).then(
        ([appointments, reviews]) => {
          if (cancelled) return;
          const now = new Date();
          setCounts({
            upcoming: appointments.filter((a) => isUpcoming(a, now)).length,
            reviews: reviews.length,
          });
        },
      );
      return () => {
        cancelled = true;
      };
    }, []),
  );

  const profile = session?.profile;
  const fullName = profile
    ? profile.firstName + " " + profile.lastName
    : "Votre profil";

  const handleSignOut = async () => {
    await signOut();
    router.replace(ROUTES.signIn as never);
  };

  const handleResetDemo = () => {
    Alert.alert(
      "Réinitialiser les données démo ?",
      "Rendez-vous et avis enregistrés sur cet appareil seront effacés.",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Effacer",
          style: "destructive",
          onPress: async () => {
            await resetBookingData();
            setCounts({ upcoming: 0, reviews: 0 });
          },
        },
      ],
    );
  };

  /** Dev shortcut: wipes every local trace and replays the first-run flow. */
  const handleReplayOnboarding = () => {
    Alert.alert(
      "Rejouer l'onboarding ?",
      "La session, les comptes de test, les rendez-vous et les avis locaux seront effacés.",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Tout effacer",
          style: "destructive",
          onPress: async () => {
            await signOut();
            await Promise.all([
              resetMockAuth(),
              resetBookingData(),
              clearPreferences(),
            ]);
            router.replace(ROUTES.onboarding as never);
          },
        },
      ],
    );
  };

  const locationLabel = manualLabel
    ? manualLabel + " (manuel)"
    : status === "granted" && !isFallback
      ? "Position activée"
      : "Position désactivée";

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.background.dark }}
      contentContainerStyle={{
        paddingHorizontal: gutter,
        paddingTop: insets.top + spacing.md,
        paddingBottom: Math.max(insets.bottom, spacing.md) + 96,
        gap: spacing.xl,
      }}
      showsVerticalScrollIndicator={false}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.lg,
        }}
      >
        <View
          style={{
            width: 72,
            height: 72,
            borderRadius: radius.full,
            overflow: "hidden",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: theme.background.accent,
            borderWidth: 1,
            borderColor: theme.border,
          }}
        >
          {profile?.photoUri ? (
            <Image
              source={{ uri: profile.photoUri }}
              style={{ width: 72, height: 72 }}
              contentFit="cover"
            />
          ) : (
            <Text style={[typography.h1, { color: theme.accent.warm }]}>
              {profile ? initials(fullName) : "?"}
            </Text>
          )}
        </View>

        <View style={{ flex: 1, gap: 2 }}>
          <Text
            style={[typography.h1, { color: theme.foreground.white }]}
            numberOfLines={1}
          >
            {fullName}
          </Text>
          <Text
            style={[typography.bodySmall, { color: theme.foreground.gray }]}
            numberOfLines={1}
          >
            {session?.email ?? ""}
          </Text>
        </View>
      </View>

      <View style={{ flexDirection: "row", gap: spacing.md }}>
        <Stat label="RDV à venir" value={counts.upcoming} />
        <Stat label="Avis publiés" value={counts.reviews} />
      </View>

      <Group title="Préférences">
        <Row
          icon="crosshairs-gps"
          label="Localisation"
          value={locationLabel}
          onPress={() => void enable()}
        />
        <Row
          icon="palette-outline"
          label="Thème"
          value="Clair, sombre ou système"
          onPress={() => router.push("/screens/Themes" as never)}
        />
      </Group>

      <Group title="Développement">
        <Row
          icon="gesture-swipe-horizontal"
          label="Rejouer l'onboarding"
          value="Efface la session et les comptes de test"
          onPress={handleReplayOnboarding}
        />
        <Row
          icon="restore"
          label="Réinitialiser les données démo"
          value="RDV et avis locaux"
          tone="danger"
          onPress={handleResetDemo}
        />
      </Group>

      <Pressable
        onPress={handleSignOut}
        accessibilityRole="button"
        style={({ pressed }) => ({
          alignItems: "center",
          paddingVertical: spacing.lg,
          opacity: pressed ? 0.6 : 1,
        })}
      >
        <Text style={[typography.label, { color: theme.danger }]}>
          Se déconnecter
        </Text>
      </Pressable>
    </ScrollView>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  const { theme } = useTheme();
  return (
    <View
      style={{
        flex: 1,
        padding: spacing.lg,
        borderRadius: radius.lg,
        backgroundColor: theme.background.accent,
        borderWidth: 1,
        borderColor: theme.border,
        gap: spacing.xs,
      }}
    >
      <Text style={[typography.display, { color: theme.foreground.white }]}>
        {value}
      </Text>
      <Text style={[typography.caption, { color: theme.foreground.gray }]}>
        {label}
      </Text>
    </View>
  );
}

function Group({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const { theme } = useTheme();
  return (
    <View style={{ gap: spacing.md }}>
      <Text style={[typography.overline, { color: theme.foreground.gray }]}>
        {title.toUpperCase()}
      </Text>
      <View
        style={{
          borderRadius: radius.lg,
          borderWidth: 1,
          borderColor: theme.border,
          overflow: "hidden",
        }}
      >
        {children}
      </View>
    </View>
  );
}

function Row({
  icon,
  label,
  value,
  onPress,
  tone = "default",
}: {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  label: string;
  value?: string;
  onPress: () => void;
  tone?: "default" | "danger";
}) {
  const { theme } = useTheme();
  const color = tone === "danger" ? theme.danger : theme.primary.main;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
        minHeight: 60,
        backgroundColor: pressed
          ? theme.background.accent
          : theme.background.darker,
      })}
    >
      <MaterialCommunityIcons name={icon} size={20} color={color} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text
          style={[typography.bodyMedium, { color: theme.foreground.white }]}
        >
          {label}
        </Text>
        {value ? (
          <Text style={[typography.caption, { color: theme.foreground.gray }]}>
            {value}
          </Text>
        ) : null}
      </View>
      <MaterialCommunityIcons
        name="chevron-right"
        size={18}
        color={theme.foreground.gray}
      />
    </Pressable>
  );
}

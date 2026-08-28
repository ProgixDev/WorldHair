import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AvailabilityRow } from "../components/pro/AvailabilityEditor";
import { Button } from "../components/ui/Button";
import { useResponsive } from "../constants/responsive";
import { radius, spacing } from "../constants/spacing";
import { typography } from "../constants/typography";
import { useAuth } from "../contexts/AuthContext";
import { ProProvider, usePro } from "../contexts/ProContext";
import { useTheme } from "../contexts/ThemeContext";
import { ROUTES } from "../features/auth/routing";
import type { AvailabilityDay } from "../features/pro/types";
import { coverFor, coverPlaceholder } from "../features/salons/images";

/**
 * Mandatory first-login screen after admin approval (issue #7): the coiffeur
 * fills in a cover photo and weekly hours before reaching the dashboard.
 * Self-contained — it sits outside `/pro/_layout.tsx`'s tabs, so it mounts
 * its own `ProProvider`.
 */
export default function ProShopSetupScreen() {
  return (
    <ProProvider>
      <ProShopSetup />
    </ProProvider>
  );
}

function ProShopSetup() {
  const router = useRouter();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { gutter } = useResponsive();
  const { completeShopProfile } = useAuth();
  const { profile, availability, isLoading, saveProfile, saveAvailability } =
    usePro();

  const [coverUri, setCoverUri] = useState<string | null | undefined>(
    undefined,
  );
  const [draft, setDraft] = useState<AvailabilityDay[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (profile && coverUri === undefined) setCoverUri(profile.coverUri ?? null);
  }, [profile, coverUri]);
  useEffect(() => {
    if (availability.length > 0 && !draft) setDraft(availability);
  }, [availability, draft]);

  if (isLoading || !profile || !draft)
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: theme.background.dark,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <ActivityIndicator color={theme.primary.main} />
      </View>
    );

  const hasOpenDay = draft.some((day) => day.open);

  const pickCover = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(
        "Accès aux photos refusé",
        "Autorisez l'accès à vos photos pour ajouter la vitrine du salon.",
      );
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [16, 10],
      quality: 0.85,
    });
    if (!result.canceled && result.assets.length > 0)
      setCoverUri(result.assets[0].uri);
  };

  const handleFinish = async () => {
    if (!hasOpenDay) {
      setError("Ouvrez au moins un jour dans la semaine.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      if (coverUri !== (profile.coverUri ?? null))
        await saveProfile({ ...profile, coverUri });
      await saveAvailability(draft);
      await completeShopProfile();
      router.replace(ROUTES.proDashboard as never);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.background.dark }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 120 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ height: 200 }}>
          <Image
            source={
              coverUri
                ? { uri: coverUri }
                : coverFor({ id: profile.salonId }, 900)
            }
            placeholder={coverPlaceholder(profile.salonId)}
            placeholderContentFit="cover"
            cachePolicy="memory-disk"
            style={{ flex: 1 }}
            contentFit="cover"
            transition={250}
          />
          <LinearGradient
            colors={["transparent", theme.background.dark]}
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: 0,
              height: 100,
            }}
          />
          <Pressable
            onPress={pickCover}
            accessibilityRole="button"
            accessibilityLabel="Ajouter une photo de vitrine"
            style={({ pressed }) => ({
              position: "absolute",
              top: insets.top + spacing.sm,
              right: gutter,
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.xs,
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.sm,
              borderRadius: radius.full,
              backgroundColor: theme.surface.glass,
              borderWidth: 1,
              borderColor: theme.border,
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <MaterialCommunityIcons
              name="camera-outline"
              size={16}
              color={theme.foreground.white}
            />
            <Text style={[typography.label, { color: theme.foreground.white }]}>
              Photo
            </Text>
          </Pressable>
        </View>

        <View
          style={{
            paddingHorizontal: gutter,
            gap: spacing.xl,
            marginTop: -spacing.xl,
          }}
        >
          <View style={{ gap: spacing.sm }}>
            <Text
              style={[typography.display, { color: theme.foreground.white }]}
              accessibilityRole="header"
            >
              Complétez votre profil boutique.
            </Text>
            <Text
              style={[typography.body, { color: theme.foreground.gray }]}
            >
              Avant de retrouver votre espace, ajoutez une photo et vos
              horaires — vos clients en ont besoin pour vous trouver.
            </Text>
          </View>

          <View style={{ gap: spacing.md }}>
            <Text
              style={[typography.overline, { color: theme.foreground.gray }]}
            >
              HORAIRES
            </Text>
            {draft.map((day, index) => (
              <AvailabilityRow
                key={day.weekday}
                day={day}
                onChange={(next) =>
                  setDraft((current) =>
                    (current ?? []).map((item, i) =>
                      i === index ? next : item,
                    ),
                  )
                }
              />
            ))}
          </View>

          {error ? (
            <Text style={[typography.bodySmall, { color: theme.danger }]}>
              {error}
            </Text>
          ) : null}
        </View>
      </ScrollView>

      <View
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          paddingHorizontal: gutter,
          paddingTop: spacing.md,
          paddingBottom: Math.max(insets.bottom, spacing.md),
          backgroundColor: theme.surface.raised,
          borderTopWidth: 1,
          borderColor: theme.divider,
        }}
      >
        <Button
          label="Terminer mon profil"
          onPress={handleFinish}
          loading={submitting}
        />
      </View>
    </View>
  );
}

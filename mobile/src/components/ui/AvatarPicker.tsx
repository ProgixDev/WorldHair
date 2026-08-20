import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import React, { useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import { useTheme } from "../../contexts/ThemeContext";
import { radius, spacing } from "../../constants/spacing";
import { typography } from "../../constants/typography";

interface AvatarPickerProps {
  uri?: string | null;
  onChange: (uri: string | null) => void;
  /** Copy under the circle — the photo is optional for a particulier. */
  hint?: string;
  size?: number;
}

/** Circular photo picker backed by the system photo library. */
export function AvatarPicker({
  uri,
  onChange,
  hint = "Photo optionnelle",
  size = 112,
}: AvatarPickerProps) {
  const { theme } = useTheme();
  const [busy, setBusy] = useState(false);

  const pick = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          "Accès aux photos refusé",
          "Autorisez l'accès à vos photos dans les réglages pour ajouter une image.",
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets.length > 0)
        onChange(result.assets[0].uri);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ alignItems: "center", gap: spacing.sm }}>
      <Pressable
        onPress={pick}
        disabled={busy}
        accessibilityRole="button"
        accessibilityLabel={
          uri ? "Changer la photo de profil" : "Ajouter une photo de profil"
        }
        style={({ pressed }) => ({
          width: size,
          height: size,
          borderRadius: radius.full,
          backgroundColor: theme.surface.base,
          borderWidth: uri ? 0 : 2,
          borderColor: theme.border,
          borderStyle: uri ? "solid" : "dashed",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
          opacity: pressed || busy ? 0.7 : 1,
        })}
      >
        {uri ? (
          <Image
            source={{ uri }}
            style={{ width: size, height: size }}
            contentFit="cover"
            transition={150}
          />
        ) : (
          <MaterialCommunityIcons
            name="camera-plus-outline"
            size={28}
            color={theme.foreground.gray}
          />
        )}
      </Pressable>

      <Pressable
        onPress={uri ? () => onChange(null) : pick}
        accessibilityRole="button"
        hitSlop={8}
      >
        <Text style={[typography.label, { color: theme.primary.main }]}>
          {uri ? "Retirer la photo" : "Ajouter une photo"}
        </Text>
      </Pressable>

      {hint && !uri ? (
        <Text style={[typography.caption, { color: theme.foreground.gray }]}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

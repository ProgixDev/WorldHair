import { MaterialCommunityIcons } from "@expo/vector-icons";
import React from "react";
import { Pressable, type StyleProp, type ViewStyle } from "react-native";
import { radius } from "../../constants/spacing";
import { useFavorites } from "../../contexts/FavoritesContext";
import { useTheme } from "../../contexts/ThemeContext";
import type { Salon } from "../../features/salons/types";

interface HeartButtonProps {
  salon: Salon;
  size?: number;
  /** On a photo: a dark round backdrop so the heart reads on any picture. */
  onImage?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** Adds the salon to the client's favorites, or takes it off — nothing for anyone else. */
export function HeartButton({ salon, size = 22, onImage = false, style }: HeartButtonProps) {
  const { theme } = useTheme();
  const { enabled, isFavorite, toggle } = useFavorites();
  if (!enabled) return null;
  const active = isFavorite(salon.id);

  return (
    <Pressable
      onPress={() => void toggle(salon)}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={active ? "Retirer des favoris" : "Ajouter aux favoris"}
      accessibilityState={{ selected: active }}
      style={({ pressed }) => [
        {
          width: size + 14,
          height: size + 14,
          borderRadius: radius.full,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: onImage ? "rgba(0,0,0,0.45)" : "transparent",
          opacity: pressed ? 0.7 : 1,
        },
        style,
      ]}
    >
      <MaterialCommunityIcons
        name={active ? "heart" : "heart-outline"}
        size={size}
        color={active ? theme.danger : onImage ? "#ffffff" : theme.foreground.white}
      />
    </Pressable>
  );
}

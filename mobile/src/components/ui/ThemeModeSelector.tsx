import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Theme, ThemeMode } from "../../constants/themes";

interface ThemeModeSelectorProps {
  theme: Theme;
  selectedMode: ThemeMode;
  onModeChange: (mode: ThemeMode) => void;
}

const THEME_OPTIONS: { mode: ThemeMode; label: string; icon: string }[] = [
  { mode: "system", label: "System", icon: "phone-portrait-outline" },
  { mode: "light", label: "Light", icon: "sunny-outline" },
  { mode: "dark", label: "Dark", icon: "moon-outline" },
];

export function ThemeModeSelector({
  theme,
  selectedMode,
  onModeChange,
}: ThemeModeSelectorProps) {
  const styles = makeStyles(theme);

  return (
    <View style={styles.container}>
      <View style={styles.segmentedControl}>
        {THEME_OPTIONS.map((option) => (
          <Pressable
            key={option.mode}
            style={({ pressed }) => [
              styles.segmentButton,
              selectedMode === option.mode && styles.segmentButtonActive,
              pressed && styles.pressed,
            ]}
            onPress={() => onModeChange(option.mode)}
          >
            <Ionicons
              name={option.icon as any}
              size={18}
              color={
                selectedMode === option.mode
                  ? theme.background.dark
                  : theme.foreground.gray
              }
            />
            <Text
              style={[
                styles.segmentText,
                selectedMode === option.mode && styles.segmentTextActive,
              ]}
            >
              {option.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    container: {},
    segmentedControl: {
      flexDirection: "row",
      backgroundColor: theme.background.accent,
      borderRadius: 14,
      padding: 4,
      gap: 4,
    },
    segmentButton: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 12,
      paddingHorizontal: 10,
      borderRadius: 10,
      gap: 6,
    },
    segmentButtonActive: {
      backgroundColor: theme.primary.main,
      shadowColor: theme.primary.main,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 4,
      elevation: 3,
    },
    segmentText: {
      fontSize: 13,
      fontWeight: "600",
      color: theme.foreground.gray,
    },
    segmentTextActive: {
      color: theme.background.dark,
      fontWeight: "700",
    },
    pressed: {
      opacity: 0.7,
    },
  });
}

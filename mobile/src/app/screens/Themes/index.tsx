import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import {
  Appearance,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { ThemeModeSelector } from "../../../components/ui/ThemeModeSelector";
import { ThemeVariantPreview } from "../../../components/ui/ThemeVariantPreview";
import { useResponsive } from "../../../constants/responsive";
import { MIN_TOUCH_SIZE, radius, spacing } from "../../../constants/spacing";
import {
  Theme,
  getThemeByVariantAndMode,
  themeVariants,
} from "../../../constants/themes";
import { typography } from "../../../constants/typography";
import { useTheme } from "../../../contexts/ThemeContext";

export default function ThemeSettingsScreen() {
  const { theme, themeMode, variantId, setThemeMode, setVariantId } =
    useTheme();
  const router = useRouter();
  const { gutter } = useResponsive();
  const styles = makeStyles(theme);

  const getEffectiveMode = (): "light" | "dark" => {
    if (themeMode === "system") {
      const systemScheme = Appearance.getColorScheme();
      return systemScheme === "light" ? "light" : "dark";
    }
    return themeMode;
  };

  const effectiveMode = getEffectiveMode();

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingHorizontal: gutter }]}>
        <Pressable
          style={({ pressed }) => [
            styles.headerBtn,
            pressed && { opacity: 0.6 },
          ]}
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Retour"
          hitSlop={8}
        >
          <MaterialCommunityIcons
            name="arrow-left"
            size={22}
            color={theme.foreground.white}
          />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>
          Apparence
        </Text>
        <View style={styles.headerBtn} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingHorizontal: gutter },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Mode selector */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>MODE D&apos;AFFICHAGE</Text>
          <ThemeModeSelector
            theme={theme}
            selectedMode={themeMode}
            onModeChange={setThemeMode}
          />
        </View>

        {/* Palette previews */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>PALETTE DE COULEURS</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.previewScrollContent}
          >
            {themeVariants.map((variant) => {
              const variantTheme = getThemeByVariantAndMode(
                variant.id,
                effectiveMode,
              );
              const isSelected = variantId === variant.id;

              return (
                <ThemeVariantPreview
                  key={variant.id}
                  variantTheme={variantTheme}
                  variantName={variant.name}
                  isSelected={isSelected}
                  onPress={() => setVariantId(variant.id)}
                />
              );
            })}
          </ScrollView>
        </View>
      </ScrollView>
    </View>
  );
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background.dark,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: spacing.md,
    },
    headerBtn: {
      width: MIN_TOUCH_SIZE,
      height: MIN_TOUCH_SIZE,
      borderRadius: radius.md,
      backgroundColor: "transparent",
      alignItems: "center",
      justifyContent: "center",
    },
    headerTitle: {
      ...typography.bodyMedium,
      color: theme.foreground.white,
      flex: 1,
      textAlign: "center",
      marginHorizontal: spacing.sm,
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      paddingTop: spacing.sm,
      paddingBottom: spacing.xl,
    },
    section: {
      marginBottom: spacing.xxl,
    },
    sectionHeader: {
      ...typography.overline,
      color: theme.foreground.gray,
      marginBottom: spacing.md,
      paddingHorizontal: spacing.xs,
    },
    previewScrollContent: {
      paddingVertical: spacing.sm,
      paddingLeft: spacing.xs,
      paddingRight: spacing.xl,
      gap: spacing.lg,
    },
  });
}

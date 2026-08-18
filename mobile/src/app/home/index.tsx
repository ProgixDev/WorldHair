import React, { useMemo } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useTheme } from "../../contexts/ThemeContext";
import { themeVariants, Theme } from "../../constants/themes";

type AppTheme = Theme;

interface ScreenCategory {
  id: string;
  title: string;
  description: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  screens: Screen[];
  color: string;
}

interface Screen {
  id: string;
  name: string;
  path?: string;
  status: "coming" | "ready" | "in-progress";
}

// ─── SettingRow ───────────────────────────────────────────────────────────────

interface SettingRowProps {
  icon: string;
  iconColor?: string;
  label: string;
  description?: string;
  badge?: string;
  badgeColor?: string;
  onPress?: () => void;
  showChevron?: boolean;
  isLast?: boolean;
  theme: AppTheme;
  right?: React.ReactNode;
}

function SettingRow({
  icon,
  iconColor,
  label,
  description,
  badge,
  badgeColor,
  onPress,
  showChevron = true,
  isLast,
  theme,
  right,
}: SettingRowProps) {
  const s = makeStyles(theme);
  const accentColor = iconColor ?? theme.primary.main;

  return (
    <>
      <Pressable
        style={({ pressed }) => [s.row, pressed && onPress && s.rowPressed]}
        onPress={onPress}
        disabled={!onPress}
      >
        <View style={[s.iconBadge, { backgroundColor: `${accentColor}18` }]}>
          <MaterialCommunityIcons
            name={icon as any}
            size={18}
            color={accentColor}
          />
        </View>

        <View style={s.rowText}>
          <Text style={s.rowLabel}>{label}</Text>
          {description ? <Text style={s.rowDesc}>{description}</Text> : null}
        </View>

        <View style={s.rowRight}>
          {right ?? null}
          {badge && !right ? (
            <View
              style={[
                s.badge,
                badgeColor
                  ? { backgroundColor: `${badgeColor}22` }
                  : { backgroundColor: `${theme.primary.main}18` },
              ]}
            >
              <Text
                style={[
                  s.badgeText,
                  badgeColor
                    ? { color: badgeColor }
                    : { color: theme.primary.main },
                ]}
              >
                {badge}
              </Text>
            </View>
          ) : null}
          {showChevron && onPress && !right ? (
            <MaterialCommunityIcons
              name="chevron-right"
              size={16}
              color={theme.foreground.gray}
            />
          ) : null}
        </View>
      </Pressable>
      {!isLast && <View style={s.divider} />}
    </>
  );
}

// ─── SectionCard ─────────────────────────────────────────────────────────────

interface SectionCardProps {
  label: string;
  children: React.ReactNode;
  theme: AppTheme;
}

function SectionCard({ label, children, theme }: SectionCardProps) {
  const s = makeStyles(theme);
  return (
    <View style={s.section}>
      <Text style={s.sectionLabel}>{label}</Text>
      <View style={s.card}>{children}</View>
    </View>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const s = makeStyles(theme);

  const screenCategories: ScreenCategory[] = useMemo(
    () => [
      {
        id: "auth",
        title: "Authentication",
        description: "Login, signup, and auth flows",
        icon: "lock",
        color: theme.primary.main,
        screens: [
          { id: "login", name: "Login Screen", status: "coming" },
          { id: "signup", name: "Sign Up Screen", status: "coming" },
          { id: "forget-password", name: "Forgot Password", status: "coming" },
          { id: "verification", name: "Email Verification", status: "coming" },
        ],
      },
      {
        id: "splash",
        title: "Splash Screens",
        description: "Initial loading and onboarding screens",
        icon: "flash",
        color: theme.primary.light,
        screens: [
          { id: "splash", name: "Splash Screen", status: "coming" },
          { id: "onboarding", name: "Onboarding", status: "coming" },
        ],
      },
      {
        id: "tabs",
        title: "Tab Navigation",
        description: "Bottom tab navigation screens",
        icon: "apps",
        color: theme.primary.dark,
        screens: [
          { id: "home", name: "Home Tab", status: "coming" },
          { id: "explore", name: "Explore Tab", status: "coming" },
          { id: "profile", name: "Profile Tab", status: "coming" },
        ],
      },
      {
        id: "modals",
        title: "Modals & Dialogs",
        description: "Modal screens and dialog boxes",
        icon: "square-outline",
        color: "#FF6B6B",
        screens: [
          { id: "confirm-dialog", name: "Confirm Dialog", status: "coming" },
          { id: "settings-modal", name: "Settings Modal", status: "coming" },
          { id: "filter-modal", name: "Filter Modal", status: "coming" },
        ],
      },
      {
        id: "forms",
        title: "Forms & Input",
        description: "Form screens and input components",
        icon: "file-document",
        color: "#4ECDC4",
        screens: [
          { id: "user-form", name: "User Form", status: "coming" },
          { id: "profile-edit", name: "Profile Edit", status: "coming" },
          { id: "advanced-form", name: "Advanced Form", status: "coming" },
        ],
      },
      {
        id: "ui-showcase",
        title: "UI Components",
        description: "Component showcase and design system",
        icon: "layers",
        color: "#A8E6CF",
        screens: [
          { id: "buttons", name: "Buttons", status: "coming" },
          { id: "cards", name: "Cards", status: "coming" },
          { id: "lists", name: "Lists", status: "coming" },
        ],
      },
    ],
    [theme],
  );

  const getStatusColor = (status: Screen["status"]) => {
    switch (status) {
      case "ready":
        return theme.primary.main;
      case "in-progress":
        return "#FFD93D";
      case "coming":
        return theme.foreground.gray;
      default:
        return theme.foreground.gray;
    }
  };

  const getStatusLabel = (status: Screen["status"]) => {
    switch (status) {
      case "ready":
        return "✓ Ready";
      case "in-progress":
        return "◐ In Progress";
      case "coming":
        return "○ Coming";
    }
  };

  return (
    <View style={s.container}>
      {/* Page header */}
      <View style={s.header}>
        <Text style={s.title}>Screen Template</Text>
      </View>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── OVERVIEW ─────────────────────────────── */}
        <SectionCard label="OVERVIEW" theme={theme}>
          <View style={s.overviewRow}>
            <View style={s.overviewStat}>
              <Text style={s.overviewStatValue}>{screenCategories.length}</Text>
              <Text style={s.overviewStatLabel}>Categories</Text>
            </View>
            <View style={s.overviewStatDivider} />
            <View style={s.overviewStat}>
              <Text style={s.overviewStatValue}>
                {screenCategories.reduce(
                  (sum, cat) => sum + cat.screens.length,
                  0,
                )}
              </Text>
              <Text style={s.overviewStatLabel}>Screens</Text>
            </View>
            <View style={s.overviewStatDivider} />
            <View style={s.overviewStat}>
              <Text style={s.overviewStatValue}>6</Text>
              <Text style={s.overviewStatLabel}>Status Ready</Text>
            </View>
          </View>
        </SectionCard>

        {/* ── APPEARANCE ───────────────────────────── */}
        <SectionCard label="APPEARANCE" theme={theme}>
          <SettingRow
            icon="palette"
            label="Theme Settings"
            description="Customize appearance and colors"
            onPress={() => router.push("../screens/Themes")}
            showChevron={true}
            theme={theme}
            isLast={false}
          />
        </SectionCard>

        {/* ── COMPONENTS ───────────────────────────── */}
        {screenCategories.map((category, idx) => (
          <SectionCard
            key={category.id}
            label={category.title.toUpperCase()}
            theme={theme}
          >
            {category.screens.map((screen, screenIdx) => (
              <SettingRow
                key={screen.id}
                icon={category.icon}
                iconColor={category.color}
                label={screen.name}
                description={category.description}
                badge={getStatusLabel(screen.status)}
                badgeColor={getStatusColor(screen.status)}
                onPress={() => {}}
                showChevron={false}
                isLast={screenIdx === category.screens.length - 1}
                theme={theme}
              />
            ))}
          </SectionCard>
        ))}
      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background.dark,
    },
    header: {
      paddingHorizontal: 20,
      paddingTop: 16,
      paddingBottom: 14,
    },
    title: {
      fontSize: 26,
      fontWeight: "800",
      color: theme.foreground.white,
      letterSpacing: -0.5,
    },
    scroll: {
      flex: 1,
    },
    scrollContent: {
      paddingHorizontal: 16,
      paddingBottom: 40,
      gap: 16,
    },

    // ── Section ───────────────────────────────────
    section: {
      gap: 6,
    },
    sectionLabel: {
      fontSize: 10,
      fontWeight: "700",
      color: theme.foreground.gray,
      letterSpacing: 1.2,
      paddingHorizontal: 4,
      opacity: 0.7,
      textTransform: "uppercase",
    },
    card: {
      backgroundColor: theme.background.accent,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: `${theme.foreground.gray}12`,
      overflow: "hidden",
    },

    // ── Row ───────────────────────────────────────
    row: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 14,
      paddingVertical: 13,
      gap: 12,
    },
    rowPressed: {
      backgroundColor: theme.background.darker,
    },
    iconBadge: {
      width: 34,
      height: 34,
      borderRadius: 9,
      alignItems: "center",
      justifyContent: "center",
    },
    rowText: {
      flex: 1,
      gap: 2,
    },
    rowLabel: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.foreground.white,
    },
    rowDesc: {
      fontSize: 12,
      color: theme.foreground.gray,
      lineHeight: 16,
    },
    rowRight: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    divider: {
      height: 1,
      backgroundColor: `${theme.foreground.gray}12`,
      marginLeft: 60,
    },

    // ── Badge ─────────────────────────────────────
    badge: {
      borderRadius: 7,
      paddingHorizontal: 8,
      paddingVertical: 3,
    },
    badgeText: {
      fontSize: 12,
      fontWeight: "600",
    },

    // ── Overview ──────────────────────────────────
    overviewRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 8,
    },
    overviewStat: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 16,
    },
    overviewStatValue: {
      fontSize: 18,
      fontWeight: "700",
      color: theme.foreground.white,
      marginBottom: 2,
    },
    overviewStatLabel: {
      fontSize: 11,
      color: theme.foreground.gray,
    },
    overviewStatDivider: {
      width: 1,
      backgroundColor: `${theme.foreground.gray}12`,
      height: 30,
    },
  });
}

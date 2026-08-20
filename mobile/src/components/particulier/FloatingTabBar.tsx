import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import React from "react";
import { Platform, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { radius, spacing } from "../../constants/spacing";
import { typography } from "../../constants/typography";
import { useTheme } from "../../contexts/ThemeContext";

const TABS: Record<
  string,
  { label: string; icon: keyof typeof MaterialCommunityIcons.glyphMap }
> = {
  discover: { label: "Découvrir", icon: "map-marker-radius-outline" },
  search: { label: "Recherche", icon: "magnify" },
  appointments: { label: "Mes RDV", icon: "calendar-heart" },
  profile: { label: "Profil", icon: "account-outline" },
};

/**
 * Floating pill tab bar: only the active tab shows its label, so the bar stays
 * narrow and the map keeps the screen. Sits above the gesture bar itself,
 * since the particulier routes opt out of the root layout's insets.
 */
export function FloatingTabBar({ state, navigation }: BottomTabBarProps) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        paddingBottom: Math.max(insets.bottom, spacing.md),
        paddingHorizontal: spacing.lg,
        alignItems: "center",
      }}
      pointerEvents="box-none"
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.xs,
          padding: spacing.xs,
          borderRadius: radius.full,
          backgroundColor: theme.background.accent,
          borderWidth: 1,
          borderColor: theme.border,
          ...Platform.select({
            ios: {
              shadowColor: "#000",
              shadowOpacity: 0.25,
              shadowRadius: 16,
              shadowOffset: { width: 0, height: 8 },
            },
            android: { elevation: 8 },
          }),
        }}
      >
        {state.routes.map((route, index) => {
          const tab = TABS[route.name];
          if (!tab) return null;
          const focused = state.index === index;

          return (
            <Pressable
              key={route.key}
              onPress={() => {
                const event = navigation.emit({
                  type: "tabPress",
                  target: route.key,
                  canPreventDefault: true,
                });
                if (!focused && !event.defaultPrevented)
                  navigation.navigate(route.name);
              }}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={tab.label}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: focused ? spacing.xs : 0,
                minHeight: 44,
                paddingHorizontal: focused ? spacing.lg : spacing.md,
                borderRadius: radius.full,
                backgroundColor: focused ? theme.primary.main : "transparent",
              }}
            >
              <MaterialCommunityIcons
                name={tab.icon}
                size={21}
                color={focused ? theme.primary.on : theme.foreground.gray}
              />
              {focused ? (
                <Text
                  style={[typography.label, { color: theme.primary.on }]}
                  numberOfLines={1}
                >
                  {tab.label}
                </Text>
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

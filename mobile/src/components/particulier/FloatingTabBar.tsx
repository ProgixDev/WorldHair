import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import React from "react";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { elevation, TAB_BAR_HEIGHT } from "../../constants/elevation";
import { radius, spacing } from "../../constants/spacing";
import { typography } from "../../constants/typography";
import { useTheme } from "../../contexts/ThemeContext";

const TABS: Record<
  string,
  {
    label: string;
    icon: keyof typeof MaterialCommunityIcons.glyphMap;
    activeIcon: keyof typeof MaterialCommunityIcons.glyphMap;
  }
> = {
  discover: {
    label: "Découvrir",
    icon: "map-marker-radius-outline",
    activeIcon: "map-marker-radius",
  },
  search: { label: "Recherche", icon: "magnify", activeIcon: "magnify" },
  appointments: {
    label: "Mes RDV",
    icon: "calendar-heart",
    activeIcon: "calendar-heart",
  },
  profile: {
    label: "Profil",
    icon: "account-outline",
    activeIcon: "account",
  },
};

/**
 * Floating bar with four equal columns: big icon, permanent label, and a soft
 * tint plus a top indicator on the active tab. Sits above the gesture bar
 * itself, since the particulier routes opt out of the root layout's insets.
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
      }}
      pointerEvents="box-none"
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "stretch",
          height: TAB_BAR_HEIGHT,
          paddingHorizontal: spacing.sm,
          borderRadius: radius.xl,
          backgroundColor: theme.surface.raised,
          borderWidth: 1,
          borderColor: theme.border,
          ...elevation(3, theme.shadow),
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
              style={({ pressed }) => ({
                flex: 1,
                alignItems: "center",
                justifyContent: "center",
                gap: 5,
                marginVertical: spacing.sm,
                borderRadius: radius.lg,
                backgroundColor: focused ? theme.primary.soft : "transparent",
                opacity: pressed ? 0.6 : 1,
              })}
            >
              {/* Active indicator, docked to the top of the column. */}
              <View
                style={{
                  position: "absolute",
                  top: 0,
                  width: 26,
                  height: 3,
                  borderRadius: radius.full,
                  backgroundColor: focused ? theme.primary.main : "transparent",
                }}
              />

              <MaterialCommunityIcons
                name={focused ? tab.activeIcon : tab.icon}
                size={26}
                color={focused ? theme.primary.main : theme.foreground.gray}
              />
              <Text
                style={[
                  typography.caption,
                  {
                    fontSize: 11,
                    color: focused ? theme.primary.main : theme.foreground.gray,
                  },
                ]}
                numberOfLines={1}
              >
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

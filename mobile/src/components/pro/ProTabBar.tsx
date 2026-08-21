import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import React from "react";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { elevation, TAB_BAR_HEIGHT } from "../../constants/elevation";
import { radius, spacing } from "../../constants/spacing";
import { typography } from "../../constants/typography";
import { usePro } from "../../contexts/ProContext";
import { useTheme } from "../../contexts/ThemeContext";

const TABS: Record<
  string,
  {
    label: string;
    icon: keyof typeof MaterialCommunityIcons.glyphMap;
    activeIcon: keyof typeof MaterialCommunityIcons.glyphMap;
  }
> = {
  dashboard: {
    label: "Bord",
    icon: "view-dashboard-outline",
    activeIcon: "view-dashboard",
  },
  agenda: {
    label: "Agenda",
    icon: "calendar-month-outline",
    activeIcon: "calendar-month",
  },
  salon: {
    label: "Salon",
    icon: "storefront-outline",
    activeIcon: "storefront",
  },
  reviews: { label: "Avis", icon: "star-outline", activeIcon: "star" },
  account: {
    label: "Compte",
    icon: "account-cog-outline",
    activeIcon: "account-cog",
  },
};

/**
 * Pro tab bar. Same footprint as the particulier one but gold-accented, so the
 * two spaces never look like the same app, plus a badge counting the requests
 * still waiting for a decision.
 */
export function ProTabBar({ state, navigation }: BottomTabBarProps) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { appointments } = usePro();

  const pending = appointments.filter(
    (appointment) => appointment.status === "pending",
  ).length;

  return (
    <View
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        paddingBottom: Math.max(insets.bottom, spacing.md),
        paddingHorizontal: spacing.md,
      }}
      pointerEvents="box-none"
    >
      <View
        style={{
          flexDirection: "row",
          height: TAB_BAR_HEIGHT,
          paddingHorizontal: spacing.xs,
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
          const badge = route.name === "agenda" ? pending : 0;

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
              accessibilityLabel={
                badge > 0 ? tab.label + ", " + badge + " demandes" : tab.label
              }
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
              <View
                style={{
                  position: "absolute",
                  top: 0,
                  width: 24,
                  height: 3,
                  borderRadius: radius.full,
                  backgroundColor: focused ? theme.primary.main : "transparent",
                }}
              />

              <View>
                <MaterialCommunityIcons
                  name={focused ? tab.activeIcon : tab.icon}
                  size={24}
                  color={focused ? theme.primary.main : theme.foreground.gray}
                />
                {badge > 0 ? (
                  <View
                    style={{
                      position: "absolute",
                      top: -5,
                      right: -9,
                      minWidth: 17,
                      height: 17,
                      paddingHorizontal: 4,
                      borderRadius: radius.full,
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: theme.danger,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 10,
                        lineHeight: 13,
                        color: "#ffffff",
                      }}
                    >
                      {badge}
                    </Text>
                  </View>
                ) : null}
              </View>

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

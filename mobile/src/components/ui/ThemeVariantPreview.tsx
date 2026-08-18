import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Theme } from "../../constants/themes";

interface ThemeVariantPreviewProps {
  variantTheme: Theme;
  variantName: string;
  isSelected: boolean;
  onPress: () => void;
}

export function ThemeVariantPreview({
  variantTheme,
  variantName,
  isSelected,
  onPress,
}: ThemeVariantPreviewProps) {
  const styles = makeStyles(variantTheme);

  return (
    <Pressable onPress={onPress} style={styles.previewItem}>
      {/* Phone Mockup */}
      <View
        style={[
          styles.phoneMockup,
          { backgroundColor: variantTheme.background.darker },
          isSelected && styles.phoneMockupSelected,
        ]}
      >
        {/* Status Bar */}
        <PhoneStatusBar theme={variantTheme} />

        {/* Content Area */}
        <View style={styles.phoneContent}>
          {/* Header Card */}
          <PhoneCard theme={variantTheme} />

          {/* List Items */}
          <PhoneListItems theme={variantTheme} />
        </View>

        {/* Bottom Bar Indicator */}
        <PhoneBottomBar theme={variantTheme} />

        {/* Selection Checkmark */}
        {isSelected && (
          <View
            style={[
              styles.checkmarkContainer,
              { backgroundColor: variantTheme.primary.main },
            ]}
          >
            <Ionicons
              name="checkmark"
              size={16}
              color={variantTheme.background.dark}
            />
          </View>
        )}
      </View>

      {/* Theme Name */}
      <Text style={styles.themeName}>{variantName}</Text>
    </Pressable>
  );
}

// Sub-components
function PhoneStatusBar({ theme }: { theme: Theme }) {
  return (
    <View style={styles.phoneStatusBar}>
      <View style={styles.phoneStatusBarLeft}>
        <Text
          style={[
            styles.phoneStatusBarTime,
            { color: theme.foreground.white },
          ]}
        >
          9:41
        </Text>
      </View>
      <View style={styles.phoneStatusBarRight}>
        <View
          style={[
            styles.phoneStatusBarIcon,
            { backgroundColor: theme.foreground.gray },
          ]}
        />
        <View
          style={[
            styles.phoneStatusBarIcon,
            { backgroundColor: theme.foreground.gray },
          ]}
        />
        <View
          style={[
            styles.phoneStatusBarIcon,
            { backgroundColor: theme.foreground.gray },
          ]}
        />
      </View>
    </View>
  );
}

function PhoneCard({ theme }: { theme: Theme }) {
  return (
    <View
      style={[
        styles.phoneCard,
        { backgroundColor: theme.background.accent },
      ]}
    >
      <View
        style={[
          styles.phoneCardLine,
          { backgroundColor: theme.foreground.gray, width: "40%" },
        ]}
      />
      <View
        style={[
          styles.phoneCardLine,
          {
            backgroundColor: theme.primary.main,
            width: "60%",
            height: 20,
            marginTop: 8,
          },
        ]}
      />
    </View>
  );
}

function PhoneListItems({ theme }: { theme: Theme }) {
  return (
    <View style={styles.phoneList}>
      <PhoneListItem theme={theme} opacity={1} widths={["70%", "40%"]} />
      <PhoneListItem theme={theme} opacity={0.7} widths={["60%", "35%"]} />
    </View>
  );
}

function PhoneListItem({
  theme,
  opacity,
  widths,
}: {
  theme: Theme;
  opacity: number;
  widths: [string, string];
}) {
  return (
    <View style={styles.phoneListItem}>
      <View
        style={[
          styles.phoneListIcon,
          { backgroundColor: theme.primary.main, opacity },
        ]}
      />
      <View style={{ flex: 1 }}>
        <View
          style={{
            height: 5,
            borderRadius: 3,
            opacity: 0.4,
            backgroundColor: theme.foreground.gray,
            width: widths[0] as any,
          }}
        />
        <View
          style={{
            height: 5,
            borderRadius: 3,
            backgroundColor: theme.foreground.gray,
            width: widths[1] as any,
            marginTop: 4,
            opacity: 0.5,
          }}
        />
      </View>
    </View>
  );
}

function PhoneBottomBar({ theme }: { theme: Theme }) {
  return (
    <View style={styles.phoneBottomBar}>
      <View
        style={[
          styles.phoneBottomBarIndicator,
          { backgroundColor: theme.foreground.gray },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  previewItem: {
    alignItems: "center",
  },
  phoneMockup: {
    width: 130,
    aspectRatio: 0.5,
    borderRadius: 20,
    padding: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 5,
    position: "relative",
  },
  phoneMockupSelected: {
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  phoneStatusBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  phoneStatusBarLeft: {},
  phoneStatusBarTime: {
    fontSize: 8,
    fontWeight: "600",
  },
  phoneStatusBarRight: {
    flexDirection: "row",
    gap: 3,
  },
  phoneStatusBarIcon: {
    width: 8,
    height: 5,
    borderRadius: 2,
    opacity: 0.6,
  },
  phoneContent: {
    flex: 1,
    gap: 8,
  },
  phoneCard: {
    borderRadius: 10,
    padding: 10,
  },
  phoneCardLine: {
    height: 5,
    borderRadius: 3,
    opacity: 0.4,
  },
  phoneList: {
    gap: 8,
  },
  phoneListItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  phoneListIcon: {
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  phoneBottomBar: {
    alignItems: "center",
    paddingTop: 6,
  },
  phoneBottomBarIndicator: {
    width: 32,
    height: 3,
    borderRadius: 2,
    opacity: 0.5,
  },
  checkmarkContainer: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  themeName: {
    marginTop: 10,
    fontSize: 12,
    fontWeight: "600",
    textAlign: "center",
  },
});

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    ...styles,
    phoneMockupSelected: {
      ...styles.phoneMockupSelected,
      shadowColor: theme.primary.main,
    },
    themeName: {
      ...styles.themeName,
      color: theme.foreground.white,
    },
  });
}

import React from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { radius, spacing } from "../../constants/spacing";
import { typography } from "../../constants/typography";
import { useTheme } from "../../contexts/ThemeContext";

interface BottomSheetProps {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  /** Pinned action row under the scrollable body. */
  footer?: React.ReactNode;
}

/** Shared modal shell: scrim, grabber, title, scrollable body, sticky footer. */
export function BottomSheet({
  visible,
  title,
  onClose,
  children,
  footer,
}: BottomSheetProps) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={{ flex: 1, justifyContent: "flex-end" }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <Pressable
          onPress={onClose}
          accessibilityLabel="Fermer"
          style={{ flex: 1, backgroundColor: "#00000099" }}
        />

        <View
          style={{
            backgroundColor: theme.surface.raised,
            borderTopLeftRadius: radius.xl,
            borderTopRightRadius: radius.xl,
            borderTopWidth: 1,
            borderColor: theme.border,
            paddingBottom: Math.max(insets.bottom, spacing.lg),
            maxHeight: "88%",
          }}
        >
          <View style={{ alignItems: "center", paddingVertical: spacing.md }}>
            <View
              style={{
                width: 44,
                height: 4,
                borderRadius: radius.full,
                backgroundColor: theme.border,
              }}
            />
          </View>

          <Text
            style={[
              typography.h2,
              {
                color: theme.foreground.white,
                paddingHorizontal: spacing.xl,
                paddingBottom: spacing.md,
              },
            ]}
          >
            {title}
          </Text>

          <ScrollView
            contentContainerStyle={{
              paddingHorizontal: spacing.xl,
              paddingBottom: spacing.lg,
              gap: spacing.lg,
            }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {children}
          </ScrollView>

          {footer ? (
            <View
              style={{
                flexDirection: "row",
                gap: spacing.md,
                paddingHorizontal: spacing.xl,
                paddingTop: spacing.md,
                borderTopWidth: 1,
                borderColor: theme.divider,
              }}
            >
              {footer}
            </View>
          ) : null}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

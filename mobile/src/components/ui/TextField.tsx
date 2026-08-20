import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  KeyboardTypeOptions,
  Pressable,
  StyleProp,
  Text,
  TextInput,
  View,
  ViewStyle,
} from "react-native";
import { useTheme } from "../../contexts/ThemeContext";
import { MIN_TOUCH_SIZE, radius, spacing } from "../../constants/spacing";
import { typography } from "../../constants/typography";

interface TextFieldProps {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  error?: string;
  helper?: string;
  secure?: boolean;
  keyboardType?: KeyboardTypeOptions;
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  autoComplete?: React.ComponentProps<typeof TextInput>["autoComplete"];
  textContentType?: React.ComponentProps<typeof TextInput>["textContentType"];
  multiline?: boolean;
  maxLength?: number;
  icon?: keyof typeof MaterialCommunityIcons.glyphMap;
  onBlur?: () => void;
  style?: StyleProp<ViewStyle>;
}

/**
 * Outlined field. Height is driven by `minHeight` so OS font scaling grows the
 * box instead of clipping the text.
 */
export function TextField({
  label,
  value,
  onChangeText,
  placeholder,
  error,
  helper,
  secure = false,
  keyboardType,
  autoCapitalize = "none",
  autoComplete,
  textContentType,
  multiline = false,
  maxLength,
  icon,
  onBlur,
  style,
}: TextFieldProps) {
  const { theme } = useTheme();
  const [focused, setFocused] = useState(false);
  const [revealed, setRevealed] = useState(false);

  const borderColor = error
    ? theme.danger
    : focused
      ? theme.primary.main
      : theme.border;

  return (
    <View style={[{ gap: spacing.xs }, style]}>
      <Text style={[typography.label, { color: theme.foreground.gray }]}>
        {label}
      </Text>

      <View
        style={{
          flexDirection: "row",
          alignItems: multiline ? "flex-start" : "center",
          gap: spacing.sm,
          minHeight: MIN_TOUCH_SIZE + 4,
          borderRadius: radius.md,
          borderWidth: focused || error ? 2 : 1,
          borderColor,
          backgroundColor: theme.background.accent,
          paddingHorizontal: spacing.lg,
          paddingVertical: multiline ? spacing.md : spacing.sm,
        }}
      >
        {icon ? (
          <MaterialCommunityIcons
            name={icon}
            size={20}
            color={focused ? theme.primary.main : theme.foreground.gray}
            style={multiline ? { marginTop: spacing.xs } : undefined}
          />
        ) : null}

        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={theme.foreground.gray}
          secureTextEntry={secure && !revealed}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoComplete={autoComplete}
          textContentType={textContentType}
          multiline={multiline}
          maxLength={maxLength}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setFocused(false);
            onBlur?.();
          }}
          accessibilityLabel={label}
          style={[
            typography.body,
            {
              flex: 1,
              color: theme.foreground.white,
              paddingVertical: multiline ? 0 : spacing.sm,
              minHeight: multiline ? 96 : undefined,
              textAlignVertical: multiline ? "top" : "center",
            },
          ]}
        />

        {secure ? (
          <Pressable
            onPress={() => setRevealed((r) => !r)}
            accessibilityRole="button"
            accessibilityLabel={
              revealed ? "Masquer le mot de passe" : "Afficher le mot de passe"
            }
            hitSlop={12}
          >
            <MaterialCommunityIcons
              name={revealed ? "eye-off-outline" : "eye-outline"}
              size={20}
              color={theme.foreground.gray}
            />
          </Pressable>
        ) : null}
      </View>

      {error ? (
        <Text style={[typography.caption, { color: theme.danger }]}>
          {error}
        </Text>
      ) : helper ? (
        <Text style={[typography.caption, { color: theme.foreground.gray }]}>
          {helper}
        </Text>
      ) : null}
    </View>
  );
}

import React, { useRef, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { useTheme } from "../../contexts/ThemeContext";
import { radius, spacing } from "../../constants/spacing";
import { fontFamily } from "../../constants/typography";
import { useResponsive } from "../../constants/responsive";

interface OtpInputProps {
  value: string;
  onChange: (value: string) => void;
  length?: number;
  error?: boolean;
  onComplete?: (value: string) => void;
}

/**
 * Verification-code field. One real (transparent) input backs the whole row —
 * far more reliable than N inputs juggling focus, and it lets the OS
 * autofill an SMS/email code in a single shot.
 */
export function OtpInput({
  value,
  onChange,
  length = 6,
  error = false,
  onComplete,
}: OtpInputProps) {
  const { theme } = useTheme();
  const { width } = useResponsive();
  const inputRef = useRef<TextInput>(null);
  const [focused, setFocused] = useState(false);

  // Boxes share the row: keep them square-ish but never wider than the screen.
  const boxSize = Math.max(
    40,
    Math.min(
      56,
      Math.floor((width - spacing.xl * 2 - spacing.sm * (length - 1)) / length),
    ),
  );

  const handleChange = (next: string) => {
    const digits = next.replace(/\D/g, "").slice(0, length);
    onChange(digits);
    if (digits.length === length) onComplete?.(digits);
  };

  return (
    <Pressable
      onPress={() => inputRef.current?.focus()}
      accessibilityRole="none"
      style={{ flexDirection: "row", gap: spacing.sm }}
    >
      {Array.from({ length }, (_, index) => {
        const char = value[index] ?? "";
        const isCursor =
          focused && index === Math.min(value.length, length - 1);
        return (
          <View
            key={index}
            style={{
              width: boxSize,
              minHeight: boxSize,
              borderRadius: radius.md,
              borderWidth: isCursor || error ? 2 : 1,
              borderColor: error
                ? theme.danger
                : isCursor
                  ? theme.primary.main
                  : theme.border,
              backgroundColor: theme.background.accent,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text
              style={{
                fontFamily: fontFamily.sansMedium,
                fontSize: 22,
                lineHeight: 28,
                color: theme.foreground.white,
              }}
            >
              {char}
            </Text>
          </View>
        );
      })}

      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={handleChange}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="one-time-code"
        maxLength={length}
        accessibilityLabel="Code de vérification"
        caretHidden
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          opacity: 0,
        }}
      />
    </Pressable>
  );
}

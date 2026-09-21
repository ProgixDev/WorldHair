import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import {
  Pressable,
  StyleProp,
  Text,
  TextInput,
  View,
  ViewStyle,
} from "react-native";
import { MIN_TOUCH_SIZE, radius, spacing } from "../../constants/spacing";
import { typography } from "../../constants/typography";
import { useTheme } from "../../contexts/ThemeContext";
import { normalize } from "../../features/salons/filters";
import { PHONE_COUNTRIES, phoneCountryFor } from "../../utils/phoneCountries";
import { BottomSheet } from "./BottomSheet";

interface PhoneFieldProps {
  label: string;
  /** National number only, digits — no dial code, no formatting. */
  value: string;
  onChangeText: (value: string) => void;
  /** ISO 3166-1 alpha-2, e.g. "FR". */
  country: string;
  onChangeCountry: (iso: string) => void;
  error?: string;
  helper?: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * Same shell as TextField, but the left side is a tappable country-code
 * selector (flag + dial code) instead of a static icon — picking a country
 * changes which dial code prefixes the number and which rules validate it
 * (see utils/validation.ts's isValidPhoneForCountry).
 */
export function PhoneField({
  label,
  value,
  onChangeText,
  country,
  onChangeCountry,
  error,
  helper,
  style,
}: PhoneFieldProps) {
  const { theme } = useTheme();
  const [focused, setFocused] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  const selected = phoneCountryFor(country);
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
          alignItems: "center",
          minHeight: MIN_TOUCH_SIZE + 8,
          borderRadius: radius.lg,
          borderWidth: focused || error ? 1.5 : 1,
          borderColor,
          backgroundColor: focused ? theme.surface.raised : theme.surface.base,
        }}
      >
        <Pressable
          onPress={() => setPickerOpen(true)}
          accessibilityRole="button"
          accessibilityLabel={
            "Indicatif : " + selected.name + " (+" + selected.dialCode + ")"
          }
          style={({ pressed }) => ({
            flexDirection: "row",
            alignItems: "center",
            gap: 4,
            paddingLeft: spacing.lg,
            paddingRight: spacing.md,
            paddingVertical: spacing.sm,
            opacity: pressed ? 0.6 : 1,
          })}
        >
          <Text style={{ fontSize: 20 }}>{selected.flag}</Text>
          <Text style={[typography.body, { color: theme.foreground.white }]}>
            {"+" + selected.dialCode}
          </Text>
          <MaterialCommunityIcons
            name="chevron-down"
            size={16}
            color={theme.foreground.gray}
          />
        </Pressable>

        <View
          style={{
            width: 1,
            alignSelf: "stretch",
            marginVertical: spacing.sm,
            backgroundColor: theme.border,
          }}
        />

        <TextInput
          value={value}
          onChangeText={(next) => onChangeText(next.replace(/\D/g, ""))}
          placeholder="6 12 34 56 78"
          placeholderTextColor={theme.foreground.gray}
          keyboardType="phone-pad"
          textContentType="telephoneNumber"
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          accessibilityLabel={label + " — numéro"}
          style={[
            typography.body,
            {
              flex: 1,
              color: theme.foreground.white,
              paddingVertical: spacing.sm,
              paddingHorizontal: spacing.md,
            },
          ]}
        />
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

      <CountryPickerSheet
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onPick={(iso) => {
          onChangeCountry(iso);
          setPickerOpen(false);
        }}
      />
    </View>
  );
}

function CountryPickerSheet({
  visible,
  onClose,
  onPick,
}: {
  visible: boolean;
  onClose: () => void;
  onPick: (iso: string) => void;
}) {
  const { theme } = useTheme();
  const [query, setQuery] = useState("");

  const results = useMemo(() => {
    const q = normalize(query.trim());
    if (q.length === 0) return PHONE_COUNTRIES;
    return PHONE_COUNTRIES.filter(
      (country) =>
        normalize(country.name).includes(q) || country.dialCode.includes(q),
    );
  }, [query]);

  const handleClose = () => {
    setQuery("");
    onClose();
  };

  return (
    <BottomSheet visible={visible} title="Indicatif du pays" onClose={handleClose}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.sm,
          minHeight: 52,
          paddingHorizontal: spacing.lg,
          borderRadius: radius.full,
          backgroundColor: theme.surface.base,
          borderWidth: 1,
          borderColor: theme.border,
        }}
      >
        <MaterialCommunityIcons
          name="magnify"
          size={20}
          color={theme.foreground.gray}
        />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Rechercher un pays ou un indicatif…"
          placeholderTextColor={theme.foreground.gray}
          accessibilityLabel="Rechercher un pays"
          autoCapitalize="words"
          autoCorrect={false}
          style={[
            typography.body,
            { flex: 1, color: theme.foreground.white, paddingVertical: 0 },
          ]}
        />
      </View>

      {results.length === 0 ? (
        <Text
          style={[
            typography.bodySmall,
            { color: theme.foreground.gray, paddingVertical: spacing.md },
          ]}
        >
          Aucun pays ne correspond à « {query} ».
        </Text>
      ) : (
        <View style={{ gap: spacing.xs }}>
          {results.map((country) => (
            <Pressable
              key={country.iso}
              onPress={() => onPick(country.iso)}
              accessibilityRole="button"
              style={({ pressed }) => ({
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.md,
                minHeight: 52,
                opacity: pressed ? 0.6 : 1,
              })}
            >
              <Text style={{ fontSize: 22 }}>{country.flag}</Text>
              <Text
                style={[
                  typography.body,
                  { color: theme.foreground.white, flex: 1 },
                ]}
                numberOfLines={1}
              >
                {country.name}
              </Text>
              <Text
                style={[typography.bodySmall, { color: theme.foreground.gray }]}
              >
                {"+" + country.dialCode}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
    </BottomSheet>
  );
}

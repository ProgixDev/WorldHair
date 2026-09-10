import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, Text, TextInput, View } from "react-native";
import { radius, spacing } from "../../constants/spacing";
import { typography } from "../../constants/typography";
import { useTheme } from "../../contexts/ThemeContext";
import { CITIES } from "../../features/salons/cities";
import { normalize } from "../../features/salons/filters";
import {
  CITY_SEARCH_AVAILABLE,
  searchCities,
  type CitySuggestion,
} from "../../features/salons/geocoding";
import { BottomSheet } from "../ui/BottomSheet";

const SEARCH_DEBOUNCE_MS = 300;
/** Below this, search the curated shortcuts only — not worth a network call per keystroke. */
const MIN_QUERY_LENGTH = 2;

/** What either a curated shortcut or a live search result resolves to. */
export interface PickedCity {
  label: string;
  latitude: number;
  longitude: number;
}

function curatedAsSuggestions(query: string): CitySuggestion[] {
  const q = normalize(query.trim());
  const matches = q.length === 0 ? CITIES : CITIES.filter((city) => normalize(city.label).includes(q));
  return matches.map((city) => ({
    id: city.id,
    label: city.label,
    subtitle: "France",
    latitude: city.latitude,
    longitude: city.longitude,
  }));
}

/**
 * The manual-location fallback picker — originally local to
 * `(particulier)/discover.tsx`, now shared: the onboarding location slide
 * needs the exact same list and behavior for its own "Choisir une ville" CTA.
 *
 * A real type-to-search field, not just a filter over a hardcoded 8-city
 * list: below 2 characters (or with no query at all) it shows the curated
 * French shortcuts — the cities the salon catalogue actually has coverage
 * in — but past that it searches anywhere in the world via Mapbox's
 * Geocoding API. Picking a city outside the catalogue is still honest: the
 * map just shows no salons nearby, same empty state as any under-served area.
 */
export function CityPicker({
  visible,
  onClose,
  onPick,
}: {
  visible: boolean;
  onClose: () => void;
  onPick: (city: PickedCity) => void;
}) {
  const { theme } = useTheme();
  const [query, setQuery] = useState("");
  const [remoteResults, setRemoteResults] = useState<CitySuggestion[] | null>(
    null,
  );
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    const trimmed = query.trim();
    if (!CITY_SEARCH_AVAILABLE || trimmed.length < MIN_QUERY_LENGTH) {
      setRemoteResults(null);
      setSearching(false);
      return;
    }

    setSearching(true);
    const controller = new AbortController();
    const timer = setTimeout(() => {
      searchCities(trimmed, controller.signal)
        .then((results) => {
          setRemoteResults(results);
        })
        .catch((error) => {
          // AbortError is expected — a newer keystroke cancelled this one.
          if ((error as Error)?.name !== "AbortError") setRemoteResults([]);
        })
        .finally(() => setSearching(false));
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  const results = useMemo(
    () => remoteResults ?? curatedAsSuggestions(query),
    [remoteResults, query],
  );

  const handleClose = () => {
    setQuery("");
    setRemoteResults(null);
    onClose();
  };

  const handlePick = (city: CitySuggestion) => {
    setQuery("");
    setRemoteResults(null);
    onPick({ label: city.label, latitude: city.latitude, longitude: city.longitude });
  };

  return (
    <BottomSheet visible={visible} title="Choisir une ville" onClose={handleClose}>
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
          placeholder="Rechercher une ville, partout dans le monde…"
          placeholderTextColor={theme.foreground.gray}
          accessibilityLabel="Rechercher une ville"
          autoCapitalize="words"
          autoCorrect={false}
          returnKeyType="search"
          style={[
            typography.body,
            { flex: 1, color: theme.foreground.white, paddingVertical: 0 },
          ]}
        />
        {searching ? (
          <ActivityIndicator size="small" color={theme.foreground.gray} />
        ) : query.length > 0 ? (
          <Pressable
            onPress={() => setQuery("")}
            accessibilityRole="button"
            accessibilityLabel="Effacer la recherche"
            hitSlop={10}
          >
            <MaterialCommunityIcons
              name="close-circle"
              size={18}
              color={theme.foreground.gray}
            />
          </Pressable>
        ) : null}
      </View>

      {results.length === 0 && !searching ? (
        <Text
          style={[
            typography.bodySmall,
            { color: theme.foreground.gray, paddingVertical: spacing.md },
          ]}
        >
          Aucune ville ne correspond à « {query} ».
        </Text>
      ) : (
        <View style={{ gap: spacing.xs }}>
          {results.map((city) => (
            <Pressable
              key={city.id}
              onPress={() => handlePick(city)}
              accessibilityRole="button"
              style={({ pressed }) => ({
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.md,
                minHeight: 52,
                opacity: pressed ? 0.6 : 1,
              })}
            >
              <MaterialCommunityIcons
                name="city-variant-outline"
                size={20}
                color={theme.foreground.gray}
              />
              <View style={{ flex: 1, gap: 1 }}>
                <Text style={[typography.body, { color: theme.foreground.white }]}>
                  {city.label}
                </Text>
                {city.subtitle ? (
                  <Text
                    style={[typography.caption, { color: theme.foreground.gray }]}
                    numberOfLines={1}
                  >
                    {city.subtitle}
                  </Text>
                ) : null}
              </View>
            </Pressable>
          ))}
        </View>
      )}
    </BottomSheet>
  );
}

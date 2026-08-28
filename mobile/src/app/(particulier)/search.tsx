import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  FlatList,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FilterSheet } from "../../components/particulier/FilterSheet";
import { SalonRow } from "../../components/particulier/SalonRow";
import { AdBanner } from "../../components/ui/AdBanner";
import { Chip } from "../../components/ui/Chip";
import { EmptyState } from "../../components/ui/EmptyState";
import { TAB_BAR_CLEARANCE } from "../../constants/elevation";
import { useResponsive } from "../../constants/responsive";
import { radius, spacing } from "../../constants/spacing";
import { typography } from "../../constants/typography";
import { useLocation } from "../../contexts/LocationContext";
import { useTheme } from "../../contexts/ThemeContext";
import { SALONS } from "../../features/salons/data";
import {
  activeFilterCount,
  applyFilters,
  DEFAULT_FILTERS,
  type SalonFilters,
} from "../../features/salons/filters";
import { withDistance } from "../../features/salons/geo";
import { SPECIALTIES, type SalonWithDistance } from "../../features/salons/types";
import { getAdSlot, type AdSlot } from "../../services/ads";

/** How often the ad banner is interleaved among search results. */
const AD_INTERVAL = 6;

type ResultItem =
  | { kind: "salon"; salon: SalonWithDistance }
  | { kind: "ad" };

/**
 * Text-first search: no map, a dense ranked list with a distance rail. The
 * heavy filters live in a bottom sheet so the page itself stays a single
 * scrolling column.
 */
export default function Search() {
  const router = useRouter();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { gutter } = useResponsive();
  const { coords } = useLocation();

  const [filters, setFilters] = useState<SalonFilters>(DEFAULT_FILTERS);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [resultsBanner, setResultsBanner] = useState<AdSlot | null>(null);

  useEffect(() => {
    let cancelled = false;
    getAdSlot("search_results").then((slot) => {
      if (!cancelled) setResultsBanner(slot);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const salonsWithDistance = useMemo(
    () => withDistance(SALONS, coords),
    [coords],
  );
  const results = useMemo(
    () => applyFilters(salonsWithDistance, filters),
    [salonsWithDistance, filters],
  );
  const filterCount = activeFilterCount(filters);

  const listData = useMemo<ResultItem[]>(() => {
    if (!resultsBanner?.active)
      return results.map((salon) => ({ kind: "salon", salon }));

    const items: ResultItem[] = [];
    results.forEach((salon, index) => {
      items.push({ kind: "salon", salon });
      if ((index + 1) % AD_INTERVAL === 0) items.push({ kind: "ad" });
    });
    return items;
  }, [results, resultsBanner]);

  return (
    <View style={{ flex: 1, backgroundColor: theme.background.dark }}>
      <FlatList
        data={listData}
        keyExtractor={(item, index) =>
          item.kind === "salon" ? item.salon.id : "ad-" + index
        }
        contentContainerStyle={{
          paddingHorizontal: gutter,
          paddingTop: insets.top + spacing.md,
          paddingBottom:
            Math.max(insets.bottom, spacing.md) + TAB_BAR_CLEARANCE,
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={() => (
          <View style={{ height: 1, backgroundColor: theme.border + "55" }} />
        )}
        ListHeaderComponent={
          <View style={{ gap: spacing.lg, paddingBottom: spacing.lg }}>
            <Text
              style={[typography.display, { color: theme.foreground.white }]}
              accessibilityRole="header"
            >
              Trouver{"\n"}mon coiffeur.
            </Text>

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
                value={filters.query}
                onChangeText={(query) =>
                  setFilters((current) => ({ ...current, query }))
                }
                placeholder="Salon, prestation, quartier…"
                placeholderTextColor={theme.foreground.gray}
                accessibilityLabel="Rechercher"
                returnKeyType="search"
                style={[
                  typography.body,
                  {
                    flex: 1,
                    color: theme.foreground.white,
                    paddingVertical: 0,
                  },
                ]}
              />
              {filters.query.length > 0 ? (
                <Pressable
                  onPress={() =>
                    setFilters((current) => ({ ...current, query: "" }))
                  }
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

            <View style={{ flexDirection: "row", gap: spacing.sm }}>
              <Chip
                label="Filtres"
                icon="tune-variant"
                badge={filterCount}
                selected={filterCount > 0}
                onPress={() => setSheetOpen(true)}
              />
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: spacing.sm }}
              >
                {SPECIALTIES.map((specialty) => {
                  const selected = filters.specialties.includes(specialty.id);
                  return (
                    <Chip
                      key={specialty.id}
                      label={specialty.label}
                      selected={selected}
                      onPress={() =>
                        setFilters((current) => ({
                          ...current,
                          specialties: selected
                            ? current.specialties.filter(
                                (id) => id !== specialty.id,
                              )
                            : [...current.specialties, specialty.id],
                        }))
                      }
                    />
                  );
                })}
              </ScrollView>
            </View>

            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <Text
                style={[typography.overline, { color: theme.foreground.gray }]}
              >
                {results.length +
                  (results.length > 1 ? " SALONS" : " SALON") +
                  " TROUVÉ" +
                  (results.length > 1 ? "S" : "")}
              </Text>
              {filterCount > 0 ? (
                <Pressable
                  onPress={() =>
                    setFilters({ ...DEFAULT_FILTERS, query: filters.query })
                  }
                  accessibilityRole="button"
                  hitSlop={8}
                >
                  <Text
                    style={[typography.label, { color: theme.primary.main }]}
                  >
                    Tout effacer
                  </Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            icon="magnify-close"
            title="Aucun salon trouvé"
            message="Élargissez la distance ou retirez un filtre de prestation."
            action={{
              label: "Réinitialiser les filtres",
              onPress: () => setFilters(DEFAULT_FILTERS),
            }}
          />
        }
        renderItem={({ item }) =>
          item.kind === "ad" && resultsBanner ? (
            <View style={{ paddingVertical: spacing.sm }}>
              <AdBanner slot={resultsBanner} />
            </View>
          ) : item.kind === "salon" ? (
            <SalonRow
              salon={item.salon}
              onPress={() => router.push(("/salon/" + item.salon.id) as never)}
            />
          ) : null
        }
      />

      <FilterSheet
        visible={sheetOpen}
        filters={filters}
        countFor={(draft) => applyFilters(salonsWithDistance, draft).length}
        onApply={(next) => {
          setFilters(next);
          setSheetOpen(false);
        }}
        onClose={() => setSheetOpen(false)}
      />
    </View>
  );
}

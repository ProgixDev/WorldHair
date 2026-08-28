import { MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MapCanvas } from "../../components/particulier/MapCanvas";
import { SalonCard } from "../../components/particulier/SalonCard";
import { AdBanner } from "../../components/ui/AdBanner";
import { BottomSheet } from "../../components/ui/BottomSheet";
import { Button } from "../../components/ui/Button";
import { Chip } from "../../components/ui/Chip";
import { elevation, TAB_BAR_CLEARANCE } from "../../constants/elevation";
import { useResponsive } from "../../constants/responsive";
import { radius, spacing } from "../../constants/spacing";
import { typography } from "../../constants/typography";
import { useAuth } from "../../contexts/AuthContext";
import { useLocation } from "../../contexts/LocationContext";
import { useTheme } from "../../contexts/ThemeContext";
import { CITIES } from "../../features/salons/cities";
import { SALONS } from "../../features/salons/data";
import { withDistance } from "../../features/salons/geo";
import { SPECIALTIES, type SpecialtyId } from "../../features/salons/types";
import { getAdSlot, type AdSlot } from "../../services/ads";

/**
 * Map-first home. The map owns the whole screen; everything else floats over
 * it — header, specialty chips, the salon carousel — so this tab reads nothing
 * like the list-driven search tab.
 */
export default function Discover() {
  const router = useRouter();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { width, gutter } = useResponsive();
  const { session } = useAuth();
  const {
    coords,
    status,
    isFallback,
    isLoading,
    canAskAgain,
    enable,
    setManualCoords,
    manualLabel,
  } = useLocation();

  const [specialty, setSpecialty] = useState<SpecialtyId | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [cityPickerOpen, setCityPickerOpen] = useState(false);
  const [homeBanner, setHomeBanner] = useState<AdSlot | null>(null);
  const listRef = useRef<FlatList>(null);

  useEffect(() => {
    let cancelled = false;
    getAdSlot("home_banner").then((slot) => {
      if (!cancelled) setHomeBanner(slot);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const salons = useMemo(() => {
    const withKm = withDistance(SALONS, coords);
    const filtered = specialty
      ? withKm.filter((salon) => salon.specialties.includes(specialty))
      : withKm;
    return filtered.sort((a, b) => a.distanceKm - b.distanceKm);
  }, [coords, specialty]);

  const cardWidth = width - gutter * 2;
  const snapInterval = cardWidth + spacing.md;

  const handlePinSelect = useCallback(
    (salonId: string) => {
      setSelectedId(salonId);
      const index = salons.findIndex((salon) => salon.id === salonId);
      if (index >= 0)
        listRef.current?.scrollToOffset({
          offset: index * snapInterval,
          animated: true,
        });
    },
    [salons, snapInterval],
  );

  const firstName = session?.profile?.firstName;
  const positionLabel = manualLabel
    ? manualLabel
    : status === "granted" && !isFallback
      ? "Autour de moi"
      : "Paris (approx.)";

  return (
    <View style={{ flex: 1, backgroundColor: theme.background.dark }}>
      <MapCanvas
        salons={salons}
        center={coords}
        selectedId={selectedId}
        onSelect={handlePinSelect}
        showsUserLocation={status === "granted" && !isFallback}
      />

      {/* Top scrim keeps the floating header legible over any map tile. */}
      <LinearGradient
        colors={[theme.background.dark, theme.background.dark + "00"]}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: insets.top + 150,
        }}
        pointerEvents="none"
      />

      <View
        style={{
          position: "absolute",
          top: insets.top + spacing.sm,
          left: 0,
          right: 0,
          gap: spacing.md,
        }}
        pointerEvents="box-none"
      >
        <View
          style={{
            paddingHorizontal: gutter,
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.md,
          }}
        >
          <View style={{ flex: 1, gap: 2 }}>
            <Text
              style={[typography.h2, { color: theme.foreground.white }]}
              numberOfLines={1}
            >
              {firstName ? "Bonjour " + firstName : "Bonjour"}
            </Text>
            <Pressable
              onPress={() => setCityPickerOpen(true)}
              accessibilityRole="button"
              accessibilityLabel="Changer de zone"
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.xs,
              }}
            >
              <MaterialCommunityIcons
                name="map-marker-outline"
                size={14}
                color={theme.primary.main}
              />
              <Text
                style={[typography.caption, { color: theme.foreground.gray }]}
              >
                {positionLabel +
                  " · " +
                  salons.length +
                  (salons.length > 1 ? " salons" : " salon")}
              </Text>
              <MaterialCommunityIcons
                name="chevron-down"
                size={14}
                color={theme.foreground.gray}
              />
            </Pressable>
          </View>

          <Pressable
            onPress={() => router.push("/search" as never)}
            accessibilityRole="button"
            accessibilityLabel="Rechercher un salon"
            style={({ pressed }) => [
              {
                width: 56,
                height: 56,
                borderRadius: radius.full,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: theme.surface.glass,
                borderWidth: 1,
                borderColor: theme.border,
                opacity: pressed ? 0.7 : 1,
              },
              elevation(2, theme.shadow),
            ]}
          >
            <MaterialCommunityIcons
              name="magnify"
              size={24}
              color={theme.foreground.white}
            />
          </Pressable>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: gutter,
            gap: spacing.sm,
          }}
        >
          <Chip
            label="Tout"
            selected={specialty === null}
            onPress={() => setSpecialty(null)}
          />
          {SPECIALTIES.map((item) => (
            <Chip
              key={item.id}
              label={item.label}
              selected={specialty === item.id}
              onPress={() =>
                setSpecialty((current) =>
                  current === item.id ? null : item.id,
                )
              }
            />
          ))}
        </ScrollView>
      </View>

      {/* Bottom stack: location gate, then the salon carousel. */}
      <View
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          paddingBottom:
            Math.max(insets.bottom, spacing.md) + TAB_BAR_CLEARANCE,
          gap: spacing.md,
        }}
        pointerEvents="box-none"
      >
        {isFallback ? (
          <View
            style={[
              {
                marginHorizontal: gutter,
                padding: spacing.lg,
                borderRadius: radius.xl,
                backgroundColor: theme.surface.glass,
                borderWidth: 1,
                borderColor: theme.border,
                gap: spacing.md,
              },
              elevation(3, theme.shadow),
            ]}
          >
            <View
              style={{
                flexDirection: "row",
                gap: spacing.md,
                alignItems: "center",
              }}
            >
              <MaterialCommunityIcons
                name="crosshairs-gps"
                size={22}
                color={theme.primary.main}
              />
              <View style={{ flex: 1, gap: 2 }}>
                <Text
                  style={[
                    typography.bodyMedium,
                    { color: theme.foreground.white },
                  ]}
                >
                  Activer ma position
                </Text>
                <Text
                  style={[typography.caption, { color: theme.foreground.gray }]}
                >
                  {canAskAgain
                    ? "Pour classer les salons du plus proche au plus loin."
                    : "Position refusée — choisissez une ville ou activez-la dans les réglages."}
                </Text>
              </View>
              {isLoading ? (
                <ActivityIndicator color={theme.primary.main} />
              ) : null}
            </View>

            <View style={{ flexDirection: "row", gap: spacing.sm }}>
              <Button
                label="Activer"
                icon="crosshairs-gps"
                onPress={() => void enable()}
                loading={isLoading}
                style={{ flex: 1 }}
              />
              <Button
                label="Choisir une ville"
                variant="outline"
                onPress={() => setCityPickerOpen(true)}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        ) : null}

        {homeBanner?.active ? (
          <View style={{ marginHorizontal: gutter }}>
            <AdBanner slot={homeBanner} />
          </View>
        ) : null}

        <FlatList
          ref={listRef}
          data={salons}
          keyExtractor={(salon) => salon.id}
          horizontal
          showsHorizontalScrollIndicator={false}
          snapToInterval={snapInterval}
          decelerationRate="fast"
          contentContainerStyle={{
            paddingHorizontal: gutter,
            gap: spacing.md,
          }}
          onMomentumScrollEnd={(event) => {
            const index = Math.round(
              event.nativeEvent.contentOffset.x / snapInterval,
            );
            const salon = salons[index];
            if (salon) setSelectedId(salon.id);
          }}
          ListEmptyComponent={
            <View
              style={{
                width: cardWidth,
                padding: spacing.lg,
                borderRadius: radius.xl,
                backgroundColor: theme.surface.base,
                borderWidth: 1,
                borderColor: theme.border,
              }}
            >
              <Text
                style={[typography.bodySmall, { color: theme.foreground.gray }]}
              >
                Aucun salon pour cette prestation dans la zone affichée.
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <SalonCard
              salon={item}
              width={cardWidth}
              active={item.id === selectedId}
              onPress={() => router.push(("/salon/" + item.id) as never)}
            />
          )}
        />
      </View>

      <CityPicker
        visible={cityPickerOpen}
        onClose={() => setCityPickerOpen(false)}
        onPick={(city) => {
          setManualCoords(
            { latitude: city.latitude, longitude: city.longitude },
            city.label,
          );
          setSelectedId(null);
          setCityPickerOpen(false);
        }}
      />
    </View>
  );
}

function CityPicker({
  visible,
  onClose,
  onPick,
}: {
  visible: boolean;
  onClose: () => void;
  onPick: (city: (typeof CITIES)[number]) => void;
}) {
  const { theme } = useTheme();

  return (
    <BottomSheet visible={visible} title="Choisir une ville" onClose={onClose}>
      {CITIES.map((city) => (
        <Pressable
          key={city.id}
          onPress={() => onPick(city)}
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
          <Text style={[typography.body, { color: theme.foreground.white }]}>
            {city.label}
          </Text>
        </Pressable>
      ))}
    </BottomSheet>
  );
}

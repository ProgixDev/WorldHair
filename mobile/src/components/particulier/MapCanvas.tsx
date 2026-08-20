import React, { useEffect, useRef } from "react";
import { Platform, StyleProp, Text, View, ViewStyle } from "react-native";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";
import { radius, spacing } from "../../constants/spacing";
import { typography } from "../../constants/typography";
import { useTheme } from "../../contexts/ThemeContext";
import type { Coordinates } from "../../features/salons/geo";
import { regionForSalons } from "../../features/salons/geo";
import {
  MAP_STYLE_DARK,
  MAP_STYLE_LIGHT,
} from "../../features/salons/mapStyle";
import type { SalonWithDistance } from "../../features/salons/types";
import { formatPrice } from "../../utils/date";

interface MapCanvasProps {
  salons: SalonWithDistance[];
  center: Coordinates;
  selectedId?: string | null;
  onSelect?: (salonId: string) => void;
  showsUserLocation?: boolean;
  interactive?: boolean;
  style?: StyleProp<ViewStyle>;
  /** Keeps the camera on `center` instead of framing every salon. */
  focusCenter?: boolean;
}

/**
 * Native map with price pins. Google on Android (styled to match the theme),
 * Apple Maps on iOS where custom styling is not available.
 */
export function MapCanvas({
  salons,
  center,
  selectedId = null,
  onSelect,
  showsUserLocation = false,
  interactive = true,
  style,
  focusCenter = false,
}: MapCanvasProps) {
  const { theme, themeMode } = useTheme();
  const mapRef = useRef<MapView>(null);

  const isDark =
    themeMode === "dark" ||
    (themeMode === "system" && theme.background.dark.startsWith("#0"));

  // Frame everything on first paint, then follow the selected pin.
  useEffect(() => {
    if (!mapRef.current) return;
    if (focusCenter) {
      mapRef.current.animateToRegion(
        { ...center, latitudeDelta: 0.01, longitudeDelta: 0.01 },
        400,
      );
      return;
    }
    const selected = salons.find((salon) => salon.id === selectedId);
    if (selected) {
      mapRef.current.animateToRegion(
        {
          latitude: selected.latitude,
          longitude: selected.longitude,
          latitudeDelta: 0.012,
          longitudeDelta: 0.012,
        },
        450,
      );
      return;
    }
    mapRef.current.animateToRegion(regionForSalons(salons, center), 500);
  }, [selectedId, salons, center, focusCenter]);

  return (
    <MapView
      ref={mapRef}
      style={[{ flex: 1 }, style]}
      provider={Platform.OS === "android" ? PROVIDER_GOOGLE : undefined}
      customMapStyle={isDark ? MAP_STYLE_DARK : MAP_STYLE_LIGHT}
      initialRegion={
        focusCenter
          ? { ...center, latitudeDelta: 0.01, longitudeDelta: 0.01 }
          : regionForSalons(salons, center)
      }
      showsUserLocation={showsUserLocation}
      showsMyLocationButton={false}
      showsCompass={false}
      toolbarEnabled={false}
      scrollEnabled={interactive}
      zoomEnabled={interactive}
      rotateEnabled={false}
      pitchEnabled={false}
    >
      {salons.map((salon) => {
        const selected = salon.id === selectedId;
        return (
          <Marker
            key={salon.id}
            coordinate={{
              latitude: salon.latitude,
              longitude: salon.longitude,
            }}
            onPress={() => onSelect?.(salon.id)}
            tracksViewChanges={false}
            anchor={{ x: 0.5, y: 1 }}
          >
            <View style={{ alignItems: "center" }}>
              <View
                style={{
                  paddingHorizontal: spacing.sm,
                  paddingVertical: 4,
                  borderRadius: radius.full,
                  backgroundColor: selected
                    ? theme.primary.main
                    : theme.background.accent,
                  borderWidth: 1,
                  borderColor: selected ? theme.primary.main : theme.border,
                }}
              >
                <Text
                  style={[
                    typography.caption,
                    {
                      color: selected
                        ? theme.primary.on
                        : theme.foreground.white,
                    },
                  ]}
                >
                  {formatPrice(salon.priceFrom)}
                </Text>
              </View>
              <View
                style={{
                  width: 2,
                  height: 8,
                  backgroundColor: selected ? theme.primary.main : theme.border,
                }}
              />
            </View>
          </Marker>
        );
      })}
    </MapView>
  );
}

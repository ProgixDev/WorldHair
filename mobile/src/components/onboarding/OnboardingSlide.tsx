import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { StyleProp, StyleSheet, Text, View, ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useResponsive } from "../../constants/responsive";
import { radius, spacing } from "../../constants/spacing";
import { typography } from "../../constants/typography";
import {
  SLIDE_CTA,
  type OnboardingSlideData,
  type SlidePalette,
} from "../../features/onboarding/slides";
import { Button } from "../ui/Button";
import { Pagination } from "./Pagination";

interface OnboardingSlideProps {
  slide: OnboardingSlideData;
  index: number;
  total: number;
  onPrimary: () => void;
  onSecondary?: () => void;
}

/**
 * One onboarding page: artwork, an editorial copy block, the CTA and the
 * pagination. The art always dissolves into the slide surface through a
 * gradient so the photo never ends on a hard seam.
 */
export function OnboardingSlide({
  slide,
  index,
  total,
  onPrimary,
  onSecondary,
}: OnboardingSlideProps) {
  const { width, gutter, onboardingArtHeight, space } = useResponsive();
  const insets = useSafeAreaInsets();
  const { palette } = slide;
  const fade = palette.surface + "00";

  const copy = (
    <View style={{ gap: space(spacing.lg) }}>
      <View style={{ gap: space(spacing.md) }}>
        <View
          style={{
            width: 44,
            height: 2,
            borderRadius: radius.full,
            backgroundColor: palette.rule,
          }}
        />
        <Text
          style={[typography.display, { color: palette.onSurface }]}
          accessibilityRole="header"
        >
          {slide.heading}
        </Text>
        <Text style={[typography.body, { color: palette.muted }]}>
          {slide.body}
        </Text>
      </View>

      <View style={{ gap: space(spacing.sm) }}>
        <Button
          label={slide.cta.label}
          icon={slide.cta.icon}
          onPress={onPrimary}
          background={SLIDE_CTA.background}
          color={SLIDE_CTA.label}
        />
        {slide.secondaryCta && onSecondary ? (
          <Button
            label={slide.secondaryCta.label}
            variant="ghost"
            onPress={onSecondary}
            color={palette.onSurface}
          />
        ) : null}
      </View>

      <Pagination
        index={index}
        total={total}
        activeColor={SLIDE_CTA.background}
        inactiveColor={palette.muted}
        counterColor={palette.muted}
      />
    </View>
  );

  if (slide.fullBleed) {
    return (
      <View style={{ width, flex: 1, backgroundColor: palette.surface }}>
        <ArtOrFallback
          art={slide.art}
          iconFallback={slide.iconFallback}
          palette={palette}
          style={StyleSheet.absoluteFill}
        />
        <LinearGradient
          colors={[fade, palette.surface + "cc", palette.surface]}
          locations={[0, 0.45, 0.78]}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />

        <View
          style={{
            flex: 1,
            paddingHorizontal: gutter,
            paddingTop: insets.top + spacing.xl,
            paddingBottom: insets.bottom + space(spacing.xl),
          }}
        >
          {slide.wordmark ? (
            <View style={{ alignItems: "center", gap: spacing.xs }}>
              <Text style={[typography.wordmark, { color: palette.onSurface }]}>
                {slide.wordmark.title}
              </Text>
              <Text style={[typography.overline, { color: palette.rule }]}>
                {slide.wordmark.tagline}
              </Text>
            </View>
          ) : null}

          <View style={{ flex: 1 }} />
          {copy}
        </View>
      </View>
    );
  }

  return (
    <View style={{ width, flex: 1, backgroundColor: palette.surface }}>
      <View style={{ height: onboardingArtHeight + insets.top }}>
        <ArtOrFallback
          art={slide.art}
          iconFallback={slide.iconFallback}
          palette={palette}
          style={StyleSheet.absoluteFill}
        />
        <LinearGradient
          colors={[fade, palette.surface]}
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            height: Math.round(onboardingArtHeight * 0.4),
          }}
          pointerEvents="none"
        />
      </View>

      <View
        style={{
          flex: 1,
          justifyContent: "flex-end",
          paddingHorizontal: gutter,
          paddingTop: space(spacing.lg),
          paddingBottom: insets.bottom + space(spacing.xl),
        }}
      >
        {copy}
      </View>
    </View>
  );
}

/**
 * The art panel, or — while no photo is set (the products slide before an
 * admin uploads one, issue #5) — a tinted icon panel in its place.
 */
function ArtOrFallback({
  art,
  iconFallback,
  palette,
  style,
}: {
  art: OnboardingSlideData["art"];
  iconFallback: OnboardingSlideData["iconFallback"];
  palette: SlidePalette;
  style: StyleProp<ViewStyle>;
}) {
  if (art) {
    return (
      <Image
        source={art}
        style={style as React.ComponentProps<typeof Image>["style"]}
        contentFit="cover"
        contentPosition="top center"
        transition={200}
        accessible={false}
      />
    );
  }

  return (
    <View
      style={[
        style,
        {
          backgroundColor: palette.rule + "1a",
          alignItems: "center",
          justifyContent: "center",
        },
      ]}
    >
      <MaterialCommunityIcons
        name={iconFallback ?? "image-outline"}
        size={64}
        color={palette.rule}
      />
    </View>
  );
}

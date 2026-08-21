import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useMemo, useRef, useState } from "react";
import { Animated, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MapCanvas } from "../../components/particulier/MapCanvas";
import { Button } from "../../components/ui/Button";
import { Chip } from "../../components/ui/Chip";
import { RatingStars } from "../../components/ui/RatingStars";
import { elevation } from "../../constants/elevation";
import { useResponsive } from "../../constants/responsive";
import { radius, spacing } from "../../constants/spacing";
import { typography } from "../../constants/typography";
import { useLocation } from "../../contexts/LocationContext";
import { useTheme } from "../../contexts/ThemeContext";
import {
  avatarFor,
  coverFor,
  coverPlaceholder,
  galleryFor,
} from "../../features/salons/images";
import { getSalonById } from "../../features/salons/data";
import { formatDistance, haversineKm } from "../../features/salons/geo";
import { specialtyLabel } from "../../features/salons/types";
import type { Review } from "../../features/salons/types";
import { listUserReviews, type UserReview } from "../../services/booking";
import {
  formatDuration,
  formatPrice,
  minutesToTime,
  timeAgo,
} from "../../utils/date";

const HERO_HEIGHT = 330;
const WEEKDAYS = [
  "Dimanche",
  "Lundi",
  "Mardi",
  "Mercredi",
  "Jeudi",
  "Vendredi",
  "Samedi",
];

/**
 * Salon page: parallax cover, an overlapping content sheet, and a docked
 * booking bar. Scroll-driven rather than the flat lists used by the tabs.
 */
export default function SalonDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { gutter } = useResponsive();
  const { coords } = useLocation();

  const salon = getSalonById(String(id));
  const scrollY = useRef(new Animated.Value(0)).current;
  const [userReviews, setUserReviews] = useState<UserReview[]>([]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      listUserReviews().then((all) => {
        if (!cancelled)
          setUserReviews(all.filter((review) => review.salonId === String(id)));
      });
      return () => {
        cancelled = true;
      };
    }, [id]),
  );

  const reviews = useMemo<Review[]>(() => {
    if (!salon) return [];
    const mine: Review[] = userReviews.map((review) => ({
      id: review.id,
      author: "Vous",
      rating: review.rating,
      date: review.createdAt,
      comment:
        review.comment.length > 0
          ? review.comment
          : review.tags.join(" · ") || "Avis laissé sans commentaire.",
    }));
    return [...mine, ...salon.reviews];
  }, [salon, userReviews]);

  const breakdown = useMemo(() => {
    const counts = [0, 0, 0, 0, 0];
    reviews.forEach((review) => {
      const index = Math.min(Math.max(Math.round(review.rating), 1), 5) - 1;
      counts[index] += 1;
    });
    return counts;
  }, [reviews]);

  if (!salon)
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: theme.background.dark,
          alignItems: "center",
          justifyContent: "center",
          gap: spacing.lg,
          padding: spacing.xl,
        }}
      >
        <Text style={[typography.h2, { color: theme.foreground.white }]}>
          Salon introuvable
        </Text>
        <Button label="Retour" onPress={() => router.back()} />
      </View>
    );

  const distanceKm = haversineKm(coords, {
    latitude: salon.latitude,
    longitude: salon.longitude,
  });
  const today = new Date().getDay();

  const heroTranslate = scrollY.interpolate({
    inputRange: [-HERO_HEIGHT, 0, HERO_HEIGHT],
    outputRange: [-HERO_HEIGHT / 2, 0, HERO_HEIGHT * 0.4],
  });
  const heroScale = scrollY.interpolate({
    inputRange: [-HERO_HEIGHT, 0],
    outputRange: [2, 1],
    extrapolateRight: "clamp",
  });

  return (
    <View style={{ flex: 1, backgroundColor: theme.background.dark }}>
      <Animated.View
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: HERO_HEIGHT,
          transform: [{ translateY: heroTranslate }, { scale: heroScale }],
        }}
      >
        <Image
          source={coverFor(salon, 1000)}
          placeholder={coverPlaceholder(salon.id)}
          placeholderContentFit="cover"
          cachePolicy="memory-disk"
          style={{ flex: 1 }}
          contentFit="cover"
          transition={250}
        />
        <LinearGradient
          colors={[
            theme.background.dark + "cc",
            "transparent",
            theme.background.dark,
          ]}
          locations={[0, 0.45, 1]}
          style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
        />
      </Animated.View>

      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true },
        )}
        contentContainerStyle={{
          paddingTop: HERO_HEIGHT - 40,
          paddingBottom: insets.bottom + 120,
        }}
      >
        <View
          style={{
            backgroundColor: theme.background.dark,
            borderTopLeftRadius: radius.xl,
            borderTopRightRadius: radius.xl,
            paddingHorizontal: gutter,
            paddingTop: spacing.xl,
            gap: spacing.xxl,
          }}
        >
          {/* Identity */}
          <View style={{ gap: spacing.md }}>
            <View style={{ gap: spacing.xs }}>
              <Text
                style={[typography.display, { color: theme.foreground.white }]}
                accessibilityRole="header"
              >
                {salon.name}
              </Text>
              <Text style={[typography.body, { color: theme.accent.warm }]}>
                {"avec " + salon.stylist}
              </Text>
            </View>

            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.md,
                flexWrap: "wrap",
              }}
            >
              <RatingStars value={salon.rating} showValue />
              <Text
                style={[typography.caption, { color: theme.foreground.gray }]}
              >
                {salon.reviewCount + " avis"}
              </Text>
              <View
                style={{
                  width: 3,
                  height: 3,
                  borderRadius: 2,
                  backgroundColor: theme.foreground.gray,
                }}
              />
              <Text
                style={[typography.caption, { color: theme.foreground.gray }]}
              >
                {formatDistance(distanceKm)}
              </Text>
            </View>

            <View
              style={{
                flexDirection: "row",
                gap: spacing.sm,
                flexWrap: "wrap",
              }}
            >
              {salon.badges.map((badge) => (
                <View
                  key={badge}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: spacing.xs,
                    paddingHorizontal: spacing.md,
                    paddingVertical: spacing.sm,
                    borderRadius: radius.full,
                    backgroundColor: theme.accent.warmSoft,
                  }}
                >
                  <MaterialCommunityIcons
                    name="seal-variant"
                    size={14}
                    color={theme.accent.warm}
                  />
                  <Text
                    style={[typography.label, { color: theme.accent.warm }]}
                  >
                    {badge}
                  </Text>
                </View>
              ))}
              {salon.specialties.map((specialty) => (
                <Chip
                  key={specialty}
                  label={specialtyLabel(specialty)}
                  readOnly
                />
              ))}
            </View>

            <Text style={[typography.body, { color: theme.foreground.gray }]}>
              {salon.description}
            </Text>
          </View>

          {/* Galerie */}
          <View style={{ gap: spacing.md }}>
            <Text
              style={[typography.overline, { color: theme.foreground.gray }]}
            >
              RÉALISATIONS
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: spacing.sm }}
              style={{ marginHorizontal: -gutter }}
            >
              <View style={{ width: gutter }} />
              {galleryFor(salon.id, 8).map((image, index) => (
                <Image
                  key={image.uri}
                  source={image}
                  placeholder={coverPlaceholder(salon.id + index)}
                  placeholderContentFit="cover"
                  cachePolicy="memory-disk"
                  style={{
                    width: 132,
                    height: 168,
                    borderRadius: radius.lg,
                    backgroundColor: theme.surface.sunken,
                  }}
                  contentFit="cover"
                  transition={200}
                />
              ))}
              <View style={{ width: gutter }} />
            </ScrollView>
          </View>

          {/* Prestations */}
          <Section title="Prestations">
            <View style={{ gap: spacing.sm }}>
              {salon.services.map((service) => (
                <Pressable
                  key={service.id}
                  onPress={() =>
                    router.push(
                      ("/booking/" +
                        salon.id +
                        "?serviceId=" +
                        service.id) as never,
                    )
                  }
                  accessibilityRole="button"
                  accessibilityLabel={
                    service.name + ", " + formatPrice(service.price)
                  }
                  style={({ pressed }) => [
                    {
                      flexDirection: "row",
                      alignItems: "center",
                      gap: spacing.md,
                      padding: spacing.lg,
                      borderRadius: radius.xl,
                      backgroundColor: theme.surface.raised,
                      borderWidth: 1,
                      borderColor: theme.divider,
                      opacity: pressed ? 0.75 : 1,
                    },
                    elevation(1, theme.shadow),
                  ]}
                >
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text
                      style={[
                        typography.bodyMedium,
                        { color: theme.foreground.white },
                      ]}
                    >
                      {service.name}
                    </Text>
                    <Text
                      style={[
                        typography.caption,
                        { color: theme.foreground.gray },
                      ]}
                    >
                      {formatDuration(service.durationMin) +
                        (service.description
                          ? " · " + service.description
                          : "")}
                    </Text>
                  </View>
                  <Text style={[typography.h2, { color: theme.primary.main }]}>
                    {formatPrice(service.price)}
                  </Text>
                </Pressable>
              ))}
            </View>
          </Section>

          {/* Avis */}
          <Section title="Avis récents">
            <View
              style={[
                {
                  flexDirection: "row",
                  gap: spacing.xl,
                  padding: spacing.lg,
                  borderRadius: radius.xl,
                  backgroundColor: theme.surface.raised,
                  borderWidth: 1,
                  borderColor: theme.divider,
                },
                elevation(1, theme.shadow),
              ]}
            >
              <View style={{ alignItems: "center", gap: spacing.xs }}>
                <Text
                  style={[
                    typography.display,
                    { color: theme.foreground.white },
                  ]}
                >
                  {salon.rating.toFixed(1).replace(".", ",")}
                </Text>
                <RatingStars value={salon.rating} size={13} />
              </View>

              <View style={{ flex: 1, justifyContent: "center", gap: 4 }}>
                {[5, 4, 3, 2, 1].map((stars) => {
                  const count = breakdown[stars - 1];
                  const ratio = reviews.length > 0 ? count / reviews.length : 0;
                  return (
                    <View
                      key={stars}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: spacing.sm,
                      }}
                    >
                      <Text
                        style={[
                          typography.caption,
                          { color: theme.foreground.gray, width: 10 },
                        ]}
                      >
                        {stars}
                      </Text>
                      <View
                        style={{
                          flex: 1,
                          height: 5,
                          borderRadius: radius.full,
                          backgroundColor: theme.surface.sunken,
                          overflow: "hidden",
                        }}
                      >
                        <View
                          style={{
                            width: (Math.round(ratio * 100) +
                              "%") as `${number}%`,
                            height: "100%",
                            backgroundColor: theme.accent.warm,
                          }}
                        />
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>

            <View style={{ gap: spacing.md }}>
              {reviews.slice(0, 4).map((review) => (
                <View
                  key={review.id}
                  style={{
                    gap: spacing.sm,
                    padding: spacing.lg,
                    borderRadius: radius.xl,
                    borderWidth: 1,
                    borderColor: theme.divider,
                    backgroundColor: theme.surface.base,
                  }}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: spacing.sm,
                    }}
                  >
                    <Image
                      source={avatarFor(review.author, salon.id)}
                      cachePolicy="memory-disk"
                      style={{
                        width: 34,
                        height: 34,
                        borderRadius: radius.full,
                        backgroundColor: theme.surface.sunken,
                      }}
                      contentFit="cover"
                      transition={200}
                    />
                    <Text
                      style={[
                        typography.label,
                        { color: theme.foreground.white },
                      ]}
                    >
                      {review.author}
                    </Text>
                    <RatingStars value={review.rating} size={12} />
                    <View style={{ flex: 1 }} />
                    <Text
                      style={[
                        typography.caption,
                        { color: theme.foreground.gray },
                      ]}
                    >
                      {timeAgo(review.date)}
                    </Text>
                  </View>

                  <Text
                    style={[
                      typography.bodySmall,
                      { color: theme.foreground.gray },
                    ]}
                  >
                    {review.comment}
                  </Text>

                  {review.reply ? (
                    <View
                      style={{
                        marginTop: spacing.xs,
                        paddingLeft: spacing.md,
                        borderLeftWidth: 2,
                        borderColor: theme.accent.warm,
                        gap: 2,
                      }}
                    >
                      <Text
                        style={[
                          typography.caption,
                          { color: theme.accent.warm },
                        ]}
                      >
                        {"Réponse de " + salon.stylist}
                      </Text>
                      <Text
                        style={[
                          typography.caption,
                          { color: theme.foreground.gray },
                        ]}
                      >
                        {review.reply}
                      </Text>
                    </View>
                  ) : null}
                </View>
              ))}
            </View>
          </Section>

          {/* Horaires */}
          <Section title="Horaires">
            <View
              style={{
                borderRadius: radius.xl,
                borderWidth: 1,
                borderColor: theme.divider,
                backgroundColor: theme.surface.base,
                overflow: "hidden",
              }}
            >
              {[1, 2, 3, 4, 5, 6, 0].map((weekday) => {
                const day = salon.hours.find((h) => h.weekday === weekday);
                const isToday = weekday === today;
                return (
                  <View
                    key={weekday}
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      paddingHorizontal: spacing.lg,
                      paddingVertical: spacing.md,
                      backgroundColor: isToday
                        ? theme.surface.base
                        : "transparent",
                    }}
                  >
                    <Text
                      style={[
                        isToday ? typography.label : typography.bodySmall,
                        {
                          color: isToday
                            ? theme.foreground.white
                            : theme.foreground.gray,
                        },
                      ]}
                    >
                      {WEEKDAYS[weekday]}
                    </Text>
                    <Text
                      style={[
                        typography.bodySmall,
                        {
                          color:
                            day?.opens === null || day === undefined
                              ? theme.foreground.gray
                              : theme.foreground.white,
                        },
                      ]}
                    >
                      {day?.opens === null || day === undefined
                        ? "Fermé"
                        : minutesToTime(day.opens) +
                          " – " +
                          minutesToTime(day.closes ?? 0)}
                    </Text>
                  </View>
                );
              })}
            </View>
          </Section>

          {/* Adresse */}
          <Section title="Adresse">
            <View
              style={{
                borderRadius: radius.xl,
                overflow: "hidden",
                borderWidth: 1,
                borderColor: theme.divider,
              }}
            >
              <View style={{ height: 160 }}>
                <MapCanvas
                  salons={[{ ...salon, distanceKm }]}
                  center={{
                    latitude: salon.latitude,
                    longitude: salon.longitude,
                  }}
                  interactive={false}
                  focusCenter
                />
              </View>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: spacing.md,
                  padding: spacing.lg,
                  backgroundColor: theme.surface.base,
                }}
              >
                <MaterialCommunityIcons
                  name="map-marker-outline"
                  size={20}
                  color={theme.primary.main}
                />
                <Text
                  style={[
                    typography.bodySmall,
                    { color: theme.foreground.white, flex: 1 },
                  ]}
                >
                  {salon.addressLine +
                    ", " +
                    salon.postalCode +
                    " " +
                    salon.city}
                </Text>
              </View>
            </View>
          </Section>
        </View>
      </Animated.ScrollView>

      {/* Floating back */}
      <Pressable
        onPress={() => router.back()}
        accessibilityRole="button"
        accessibilityLabel="Retour"
        style={({ pressed }) => ({
          position: "absolute",
          top: insets.top + spacing.sm,
          left: gutter,
          width: 44,
          height: 44,
          borderRadius: radius.full,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: theme.surface.glass,
          borderWidth: 1,
          borderColor: theme.border,
          opacity: pressed ? 0.7 : 1,
        })}
      >
        <MaterialCommunityIcons
          name="chevron-left"
          size={26}
          color={theme.foreground.white}
        />
      </Pressable>

      {/* Docked booking bar */}
      <View
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.lg,
          paddingHorizontal: gutter,
          paddingTop: spacing.md,
          paddingBottom: Math.max(insets.bottom, spacing.md),
          backgroundColor: theme.surface.raised,
          borderTopWidth: 1,
          borderColor: theme.divider,
          ...elevation(3, theme.shadow),
        }}
      >
        <View style={{ gap: 2 }}>
          <Text style={[typography.caption, { color: theme.foreground.gray }]}>
            à partir de
          </Text>
          <Text style={[typography.h2, { color: theme.foreground.white }]}>
            {formatPrice(salon.priceFrom)}
          </Text>
        </View>
        <Button
          label="Réserver"
          onPress={() => router.push(("/booking/" + salon.id) as never)}
          style={{ flex: 1 }}
        />
      </View>
    </View>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const { theme } = useTheme();
  return (
    <View style={{ gap: spacing.md }}>
      <Text style={[typography.overline, { color: theme.foreground.gray }]}>
        {title.toUpperCase()}
      </Text>
      {children}
    </View>
  );
}

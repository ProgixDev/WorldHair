import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
  View,
} from "react-native";
import { OnboardingSlide } from "../../components/onboarding/OnboardingSlide";
import { CityPicker } from "../../components/particulier/CityPicker";
import { useResponsive } from "../../constants/responsive";
import { useLocation } from "../../contexts/LocationContext";
import { ROUTES } from "../../features/auth/routing";
import {
  ONBOARDING_SLIDES,
  type OnboardingSlideData,
} from "../../features/onboarding/slides";
import {
  setLocationIntent,
  setOnboardingSeen,
  type LocationIntent,
} from "../../services/preferences";
import { getOnboardingProductsSlideContent } from "../../services/content";

const LAST_SLIDE = ONBOARDING_SLIDES.length - 1;

export default function Onboarding() {
  const router = useRouter();
  const { width } = useResponsive();
  const { enable, setManualCoords } = useLocation();
  const listRef = useRef<FlatList<OnboardingSlideData>>(null);
  const [index, setIndex] = useState(0);
  const [slides, setSlides] = useState(ONBOARDING_SLIDES);
  // True while the GPS CTA is waiting on the permission prompt — blocks the
  // slide advance until it's actually answered, see handlePrimary below.
  const [requestingLocation, setRequestingLocation] = useState(false);
  // "Choisir une ville" opens this instead of immediately advancing — same
  // picker `/discover` uses for its own manual-location fallback.
  const [cityPickerOpen, setCityPickerOpen] = useState(false);
  const [pendingSlideIndex, setPendingSlideIndex] = useState<number | null>(
    null,
  );
  // Slide 3 sets this before the user reaches the last slide; a direct swipe
  // past it (no CTA press) falls back to "manual".
  const [locationIntent, setStoredLocationIntent] =
    useState<LocationIntent>("manual");

  // Admin-managed copy/photo for the products slide (issue #5) — a no-op
  // today since the mock always returns the same fallback, but this is the
  // seam a real admin CMS replaces.
  useEffect(() => {
    let cancelled = false;
    getOnboardingProductsSlideContent().then((content) => {
      if (cancelled) return;
      setSlides((prev) =>
        prev.map((slide) =>
          slide.id === "products"
            ? {
                ...slide,
                heading: content.heading,
                body: content.body,
                art: content.imageUri ? { uri: content.imageUri } : null,
              }
            : slide,
        ),
      );
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Keep the current page aligned when the viewport changes (rotate / fold).
  useEffect(() => {
    listRef.current?.scrollToOffset({ offset: index * width, animated: false });
  }, [width, index]);

  const finish = useCallback(
    async (intent: LocationIntent) => {
      await Promise.all([setOnboardingSeen(true), setLocationIntent(intent)]);
      router.replace(ROUTES.signIn as never);
    },
    [router],
  );

  const goTo = useCallback(
    (next: number) => {
      setIndex(next);
      listRef.current?.scrollToOffset({ offset: next * width, animated: true });
    },
    [width],
  );

  const advanceOrFinish = useCallback(
    (slideIndex: number, intent?: LocationIntent) => {
      if (intent) setStoredLocationIntent(intent);
      if (slideIndex === LAST_SLIDE) {
        void finish(intent ?? locationIntent);
        return;
      }
      goTo(Math.min(slideIndex + 1, LAST_SLIDE));
    },
    [finish, goTo, locationIntent],
  );

  const handlePrimary = useCallback(
    async (slideIndex: number) => {
      const slide = slides[slideIndex];
      // "Activer ma position" actually prompts for it, and waits for an
      // answer before moving on — advancing first meant the OS dialog could
      // land on slide 4 (or later, once the answer was already known), which
      // read as "nothing happened" even on a real prompt.
      if (slide.cta.locationIntent === "gps") {
        setRequestingLocation(true);
        try {
          await enable();
        } finally {
          setRequestingLocation(false);
        }
      }
      advanceOrFinish(slideIndex, slide.cta.locationIntent);
    },
    [slides, enable, advanceOrFinish],
  );

  const handleSecondary = useCallback((slideIndex: number) => {
    // Only the location slide has a secondary CTA today, and it's always
    // "manual" — opens the picker rather than advancing outright, unlike
    // advanceOrFinish's other callers.
    setPendingSlideIndex(slideIndex);
    setCityPickerOpen(true);
  }, []);

  const handleMomentumEnd = (
    event: NativeSyntheticEvent<NativeScrollEvent>,
  ) => {
    const next = Math.round(event.nativeEvent.contentOffset.x / width);
    if (next !== index) setIndex(next);
  };

  return (
    <View style={{ flex: 1 }}>
      <StatusBar style={index === 0 ? "light" : "dark"} />
      <FlatList
        ref={listRef}
        data={slides}
        keyExtractor={(slide) => slide.id}
        horizontal
        pagingEnabled
        bounces={false}
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleMomentumEnd}
        getItemLayout={(_, itemIndex) => ({
          length: width,
          offset: width * itemIndex,
          index: itemIndex,
        })}
        renderItem={({ item, index: slideIndex }) => (
          <OnboardingSlide
            slide={item}
            index={slideIndex}
            total={ONBOARDING_SLIDES.length}
            primaryLoading={slideIndex === index && requestingLocation}
            onPrimary={() => void handlePrimary(slideIndex)}
            onSecondary={
              item.secondaryCta
                ? () => handleSecondary(slideIndex)
                : undefined
            }
          />
        )}
      />

      <CityPicker
        visible={cityPickerOpen}
        onClose={() => setCityPickerOpen(false)}
        onPick={(city) => {
          setManualCoords(
            { latitude: city.latitude, longitude: city.longitude },
            city.label,
          );
          setCityPickerOpen(false);
          if (pendingSlideIndex !== null) {
            advanceOrFinish(pendingSlideIndex, "manual");
            setPendingSlideIndex(null);
          }
        }}
      />
    </View>
  );
}

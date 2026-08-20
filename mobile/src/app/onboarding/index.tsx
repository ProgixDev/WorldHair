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
import { useResponsive } from "../../constants/responsive";
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

export default function Onboarding() {
  const router = useRouter();
  const { width } = useResponsive();
  const listRef = useRef<FlatList<OnboardingSlideData>>(null);
  const [index, setIndex] = useState(0);

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

  const handlePrimary = useCallback(
    (slideIndex: number) => {
      const slide = ONBOARDING_SLIDES[slideIndex];
      if (slide.cta.locationIntent) {
        // TODO: expo-location is not installed — the real permission prompt
        // belongs here. For now the intent is persisted for the home screen.
        void finish(slide.cta.locationIntent);
        return;
      }
      goTo(Math.min(slideIndex + 1, ONBOARDING_SLIDES.length - 1));
    },
    [finish, goTo],
  );

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
        data={ONBOARDING_SLIDES}
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
            onPrimary={() => handlePrimary(slideIndex)}
            onSecondary={
              item.secondaryCta
                ? () => void finish(item.secondaryCta!.locationIntent)
                : undefined
            }
          />
        )}
      />
    </View>
  );
}

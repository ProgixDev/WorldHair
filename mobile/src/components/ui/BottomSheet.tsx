import React, { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { radius, spacing } from "../../constants/spacing";
import { typography } from "../../constants/typography";
import { useTheme } from "../../contexts/ThemeContext";

interface BottomSheetProps {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  /** Pinned action row under the scrollable body. */
  footer?: React.ReactNode;
}

/** Fallback offscreen distance before the sheet's real height is known (first open, pre-layout). */
const ESTIMATED_HEIGHT = 420;
const SPRING = { damping: 24, stiffness: 260, mass: 0.9 };
const CLOSE_DURATION_MS = 220;
/** Drag past this fraction of the sheet's height, or flick faster than DISMISS_VELOCITY, to dismiss. */
const DISMISS_DISTANCE_RATIO = 0.3;
const DISMISS_VELOCITY = 800;
const MAX_BACKDROP_OPACITY = 0.6;

/**
 * Shared modal shell: scrim, grabber, title, scrollable body, sticky footer.
 *
 * Deliberately not RN's built-in `<Modal animationType="slide">` — that
 * couples the backdrop and the sheet into a single rigid transform, so the
 * scrim slams to full-dark instantly instead of fading in while the sheet
 * eases up, and there's no way to drag it back down. Backdrop opacity here
 * is *derived* from the sheet's own translateY (one shared value driving
 * both), so a spring-open, a timed-close, and a live swipe-to-dismiss all
 * keep the backdrop honestly in sync with how far the sheet actually is —
 * the same feel as Instagram's/iOS's native sheets. Swiping is confined to
 * the grabber/title header, not the whole sheet, so it never fights a
 * ScrollView's own vertical pan inside the body.
 */
export function BottomSheet({
  visible,
  title,
  onClose,
  children,
  footer,
}: BottomSheetProps) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  // The RN Modal stays mounted through the close animation, then unmounts —
  // otherwise it vanishes instantly and the close animation never gets to play.
  const [mounted, setMounted] = useState(visible);
  const [sheetHeight, setSheetHeight] = useState(ESTIMATED_HEIGHT);
  const translateY = useSharedValue(ESTIMATED_HEIGHT);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      translateY.value = sheetHeight;
      translateY.value = withSpring(0, SPRING);
    } else if (mounted) {
      translateY.value = withTiming(sheetHeight, { duration: CLOSE_DURATION_MS }, (finished) => {
        if (finished) runOnJS(setMounted)(false);
      });
    }
    // sheetHeight/mounted deliberately excluded: this effect only reacts to
    // `visible` flipping, not to a layout pass updating the measured height.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const dragHandle = Gesture.Pan()
    .onUpdate((event) => {
      if (event.translationY > 0) translateY.value = event.translationY;
    })
    .onEnd((event) => {
      const pastThreshold =
        event.translationY > sheetHeight * DISMISS_DISTANCE_RATIO ||
        event.velocityY > DISMISS_VELOCITY;
      if (pastThreshold) {
        // Flip the parent's `visible` prop and stop — the effect above
        // already handles animating a `visible → false` transition out
        // (continuing smoothly from wherever the drag left translateY) and
        // unmounting once it finishes. Driving a second timing animation
        // from here too would just fight that one.
        runOnJS(onClose)();
      } else {
        translateY.value = withSpring(0, SPRING);
      }
    });

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));
  const backdropStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      translateY.value,
      [0, sheetHeight || ESTIMATED_HEIGHT],
      [MAX_BACKDROP_OPACITY, 0],
      Extrapolation.CLAMP,
    ),
  }));

  if (!mounted) return null;

  return (
    <Modal
      visible
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <KeyboardAvoidingView
        style={{ flex: 1, justifyContent: "flex-end" }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <Animated.View
          style={[
            StyleSheet.absoluteFillObject,
            { backgroundColor: "#000" },
            backdropStyle,
          ]}
        >
          <Pressable
            onPress={onClose}
            accessibilityLabel="Fermer"
            style={StyleSheet.absoluteFillObject}
          />
        </Animated.View>

        <Animated.View
          onLayout={(event) => setSheetHeight(event.nativeEvent.layout.height)}
          style={[
            {
              backgroundColor: theme.surface.raised,
              borderTopLeftRadius: radius.xl,
              borderTopRightRadius: radius.xl,
              borderTopWidth: 1,
              borderColor: theme.border,
              paddingBottom: Math.max(insets.bottom, spacing.lg),
              maxHeight: "88%",
            },
            sheetStyle,
          ]}
        >
          <GestureDetector gesture={dragHandle}>
            <View>
              <View style={{ alignItems: "center", paddingVertical: spacing.md }}>
                <View
                  style={{
                    width: 44,
                    height: 4,
                    borderRadius: radius.full,
                    backgroundColor: theme.border,
                  }}
                />
              </View>

              <Text
                style={[
                  typography.h2,
                  {
                    color: theme.foreground.white,
                    paddingHorizontal: spacing.xl,
                    paddingBottom: spacing.md,
                  },
                ]}
              >
                {title}
              </Text>
            </View>
          </GestureDetector>

          <ScrollView
            contentContainerStyle={{
              paddingHorizontal: spacing.xl,
              paddingBottom: spacing.lg,
              gap: spacing.lg,
            }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {children}
          </ScrollView>

          {footer ? (
            <View
              style={{
                flexDirection: "row",
                gap: spacing.md,
                paddingHorizontal: spacing.xl,
                paddingTop: spacing.md,
                borderTopWidth: 1,
                borderColor: theme.divider,
              }}
            >
              {footer}
            </View>
          ) : null}
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

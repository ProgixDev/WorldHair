import { useEffect, useState } from "react";
import { Keyboard, Platform } from "react-native";

/**
 * How much bottom padding a bottom-pinned view needs to clear the keyboard.
 * 0 whenever the keyboard is down.
 *
 * Exists because React Native's own `KeyboardAvoidingView` cannot get this
 * right on an edge-to-edge Android build (`edgeToEdgeEnabled=true`), and all
 * three of its `behavior` values fail differently there:
 *
 * - `undefined` (what Expo's keyboard-handling guide suggests for Android)
 *   applies nothing at all. That is only correct when the OS resizes the
 *   window for the IME, and it does NOT under edge-to-edge — the app draws
 *   behind the system bars, and an edge-to-edge window is not resized, so the
 *   keyboard simply covers whatever sits at the bottom.
 * - `height` and `padding` both DO move it, but both leave a band of dead
 *   space behind after the keyboard closes. The cause is in
 *   `KeyboardAvoidingView`'s own Android wiring: iOS binds hide to
 *   `_onKeyboardHide`, which nulls `_keyboardEvent` and resets the offset to a
 *   clean 0, while Android binds `keyboardDidHide` to `_onKeyboardChange`,
 *   which KEEPS the event and recomputes `frame.y + frame.height - keyboardY`
 *   from the hide event's own coordinates. Edge-to-edge is what makes that
 *   subtraction land positive rather than 0: the view's frame extends to the
 *   true screen bottom, the reported `screenY` does not, and the difference
 *   survives as padding.
 *
 * Computing it here instead makes the reset unconditional — `keyboardDidHide`
 * sets exactly 0, with no coordinate arithmetic left to go wrong.
 *
 * `gap` is added on top of the reported height so the view is not flush
 * against the keyboard's top edge, which reads as the two touching. Added
 * ONLY while the keyboard is up: at rest this must return a true 0, or it
 * becomes the very band of dead space this hook exists to remove.
 */
export function useKeyboardInset(gap: number = 0): number {
  const [height, setHeight] = useState(0);

  useEffect(() => {
    // `Will` events on iOS so the padding animates in step with the keyboard
    // rather than snapping after it has finished moving; Android only emits
    // the `Did` pair.
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const show = Keyboard.addListener(showEvent, (event) => {
      setHeight(event.endCoordinates.height);
    });
    const hide = Keyboard.addListener(hideEvent, () => {
      setHeight(0);
    });

    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  return height > 0 ? height + gap : 0;
}

import { MaterialCommunityIcons } from "@expo/vector-icons";
import React from "react";
import { Alert, Pressable } from "react-native";
import { useTheme } from "../contexts/ThemeContext";
import { blockReviewAuthor } from "../features/reviews/block";

/** How a review whose author deleted their account signs (server: FORMER_CLIENT): nobody left to block. */
const FORMER_CLIENT = "Ancien client";

interface ReviewMenuProps {
  reviewId: string;
  /** The review's byline: « Camille D. ». */
  authorName: string;
  /** Not reported by this person yet: « Signaler » is offered. */
  canReport: boolean;
  onReport: () => void;
  /** Blocked: the caller reloads, and the author's reviews are gone. */
  onBlocked: () => void;
  size?: number;
}

/**
 * A review's « ⋯ »: report it (TODO.md Phase 6), or block its author
 * (App Store guideline 1.2) — after a confirmation, since every review of
 * theirs disappears for this person.
 */
export function ReviewMenu({ reviewId, authorName, canReport, onReport, onBlocked, size = 18 }: ReviewMenuProps) {
  const { theme } = useTheme();
  const canBlock = authorName !== FORMER_CLIENT;
  if (!canReport && !canBlock) return null;

  const block = async () => {
    try {
      await blockReviewAuthor(reviewId);
      onBlocked();
    } catch (err) {
      Alert.alert("Blocage impossible", err instanceof Error ? err.message : "Réessayez.");
    }
  };

  const confirmBlock = () =>
    Alert.alert(
      "Bloquer " + authorName + " ?",
      "Vous ne verrez plus aucun de ses avis. Vous pourrez le débloquer dans Mes données › Utilisateurs bloqués.",
      [
        { text: "Annuler", style: "cancel" },
        { text: "Bloquer", style: "destructive", onPress: () => void block() },
      ],
    );

  const open = () =>
    Alert.alert(authorName, undefined, [
      ...(canReport ? [{ text: "Signaler cet avis", onPress: onReport }] : []),
      ...(canBlock ? [{ text: "Bloquer " + authorName, style: "destructive" as const, onPress: confirmBlock }] : []),
      { text: "Annuler", style: "cancel" as const },
    ]);

  return (
    <Pressable
      onPress={open}
      accessibilityRole="button"
      accessibilityLabel={"Signaler ou bloquer l'avis de " + authorName}
      hitSlop={10}
    >
      <MaterialCommunityIcons name="dots-horizontal" size={size} color={theme.foreground.gray} />
    </Pressable>
  );
}

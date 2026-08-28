import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import React, { useMemo, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BottomSheet } from "../../components/ui/BottomSheet";
import { Button } from "../../components/ui/Button";
import { Chip } from "../../components/ui/Chip";
import { EmptyState } from "../../components/ui/EmptyState";
import { RatingStars } from "../../components/ui/RatingStars";
import { elevation, TAB_BAR_CLEARANCE } from "../../constants/elevation";
import { useResponsive } from "../../constants/responsive";
import { radius, spacing } from "../../constants/spacing";
import { typography } from "../../constants/typography";
import { usePro } from "../../contexts/ProContext";
import { useTheme } from "../../contexts/ThemeContext";
import { avatarFor } from "../../features/salons/images";
import type { Review } from "../../features/salons/types";
import { timeAgo } from "../../utils/date";

type Filter = "all" | "unanswered";

/**
 * Client reviews as conversation threads: the review, then the salon's answer
 * indented under it. Answering happens in a sheet so the thread list never
 * jumps around while the keyboard is up.
 */
export default function ProReviews() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { gutter } = useResponsive();
  const { replies, saveReply, deleteReply } = usePro();

  const [filter, setFilter] = useState<Filter>("all");
  const [answering, setAnswering] = useState<Review | null>(null);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);

  // No reviews backend yet ("Avis" — a separate, un-built TODO.md section) —
  // an honest empty state until then, same as the particulier-side salon page.
  const reviews = useMemo<Review[]>(() => [], []);

  const replyFor = (reviewId: string) =>
    replies.find((reply) => reply.reviewId === reviewId)?.text ??
    reviews.find((review) => review.id === reviewId)?.reply;

  const unanswered = reviews.filter((review) => !replyFor(review.id));
  const visible = filter === "all" ? reviews : unanswered;

  const average =
    reviews.length === 0
      ? 0
      : reviews.reduce((sum, review) => sum + review.rating, 0) /
        reviews.length;

  const breakdown = useMemo(() => {
    const counts = [0, 0, 0, 0, 0];
    reviews.forEach((review) => {
      counts[Math.min(Math.max(Math.round(review.rating), 1), 5) - 1] += 1;
    });
    return counts;
  }, [reviews]);

  const openAnswer = (review: Review) => {
    setDraft(replies.find((reply) => reply.reviewId === review.id)?.text ?? "");
    setAnswering(review);
  };

  const removeAnswer = (reviewId: string) =>
    Alert.alert("Supprimer la réponse ?", "Elle disparaîtra de votre fiche.", [
      { text: "Annuler", style: "cancel" },
      {
        text: "Supprimer",
        style: "destructive",
        onPress: () => void deleteReply(reviewId),
      },
    ]);

  return (
    <View style={{ flex: 1, backgroundColor: theme.background.dark }}>
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: gutter,
          paddingTop: insets.top + spacing.md,
          paddingBottom:
            Math.max(insets.bottom, spacing.md) + TAB_BAR_CLEARANCE,
          gap: spacing.xl,
        }}
        showsVerticalScrollIndicator={false}
      >
        <Text
          style={[typography.display, { color: theme.foreground.white }]}
          accessibilityRole="header"
        >
          Avis clients
        </Text>

        {/* ── Summary ──────────────────────────────────────────────────── */}
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
              style={[typography.display, { color: theme.foreground.white }]}
            >
              {average.toFixed(1).replace(".", ",")}
            </Text>
            <RatingStars value={average} size={13} />
            <Text
              style={[typography.caption, { color: theme.foreground.gray }]}
            >
              {reviews.length + " avis"}
            </Text>
          </View>

          <View style={{ flex: 1, justifyContent: "center", gap: 4 }}>
            {[5, 4, 3, 2, 1].map((stars) => {
              const ratio =
                reviews.length > 0 ? breakdown[stars - 1] / reviews.length : 0;
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
                        width: (Math.round(ratio * 100) + "%") as `${number}%`,
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

        {/* ── Filters ──────────────────────────────────────────────────── */}
        <View style={{ flexDirection: "row", gap: spacing.sm }}>
          <Chip
            label={"Tous (" + reviews.length + ")"}
            selected={filter === "all"}
            onPress={() => setFilter("all")}
          />
          <Chip
            label={"Sans réponse (" + unanswered.length + ")"}
            icon="message-alert-outline"
            selected={filter === "unanswered"}
            onPress={() => setFilter("unanswered")}
          />
        </View>

        {/* ── Threads ──────────────────────────────────────────────────── */}
        {visible.length === 0 ? (
          <EmptyState
            icon="message-check-outline"
            title="Tout est répondu"
            message="Aucun avis en attente de réponse. Beau travail."
          />
        ) : (
          visible.map((review) => {
            const reply = replyFor(review.id);
            const isMine = replies.some((item) => item.reviewId === review.id);

            return (
              <View key={review.id} style={{ gap: spacing.sm }}>
                <View
                  style={[
                    {
                      padding: spacing.lg,
                      borderRadius: radius.xl,
                      backgroundColor: theme.surface.raised,
                      borderWidth: 1,
                      borderColor: reply ? theme.divider : theme.primary.main,
                      gap: spacing.md,
                    },
                    elevation(1, theme.shadow),
                  ]}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: spacing.md,
                    }}
                  >
                    <Image
                      source={avatarFor(review.author, review.id)}
                      cachePolicy="memory-disk"
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: radius.full,
                        backgroundColor: theme.surface.sunken,
                      }}
                      contentFit="cover"
                      transition={200}
                    />
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text
                        style={[
                          typography.label,
                          { color: theme.foreground.white },
                        ]}
                      >
                        {review.author}
                      </Text>
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: spacing.sm,
                        }}
                      >
                        <RatingStars value={review.rating} size={12} />
                        <Text
                          style={[
                            typography.caption,
                            { color: theme.foreground.gray },
                          ]}
                        >
                          {timeAgo(review.date)}
                        </Text>
                      </View>
                    </View>
                  </View>

                  <Text
                    style={[
                      typography.bodySmall,
                      { color: theme.foreground.gray },
                    ]}
                  >
                    {review.comment}
                  </Text>

                  {!reply ? (
                    <Button
                      label="Répondre"
                      variant="outline"
                      icon="reply"
                      background={theme.primary.main}
                      color={theme.primary.main}
                      onPress={() => openAnswer(review)}
                    />
                  ) : null}
                </View>

                {reply ? (
                  <View
                    style={{
                      marginLeft: spacing.xl,
                      padding: spacing.lg,
                      borderRadius: radius.lg,
                      backgroundColor: theme.accent.warmSoft,
                      borderLeftWidth: 3,
                      borderColor: theme.accent.warm,
                      gap: spacing.sm,
                    }}
                  >
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: spacing.xs,
                      }}
                    >
                      <MaterialCommunityIcons
                        name="reply"
                        size={14}
                        color={theme.accent.warm}
                      />
                      <Text
                        style={[
                          typography.caption,
                          { color: theme.accent.warm, flex: 1 },
                        ]}
                      >
                        Votre réponse
                      </Text>
                      {isMine ? (
                        <>
                          <Pressable
                            onPress={() => openAnswer(review)}
                            accessibilityRole="button"
                            accessibilityLabel="Modifier la réponse"
                            hitSlop={8}
                          >
                            <MaterialCommunityIcons
                              name="pencil-outline"
                              size={16}
                              color={theme.foreground.gray}
                            />
                          </Pressable>
                          <Pressable
                            onPress={() => removeAnswer(review.id)}
                            accessibilityRole="button"
                            accessibilityLabel="Supprimer la réponse"
                            hitSlop={8}
                          >
                            <MaterialCommunityIcons
                              name="trash-can-outline"
                              size={16}
                              color={theme.danger}
                            />
                          </Pressable>
                        </>
                      ) : null}
                    </View>
                    <Text
                      style={[
                        typography.bodySmall,
                        { color: theme.foreground.white },
                      ]}
                    >
                      {reply}
                    </Text>
                  </View>
                ) : null}
              </View>
            );
          })
        )}
      </ScrollView>

      {/* ── Reply composer ─────────────────────────────────────────────── */}
      <BottomSheet
        visible={answering !== null}
        title="Répondre à l'avis"
        onClose={() => setAnswering(null)}
        footer={
          <>
            <Button
              label="Annuler"
              variant="outline"
              onPress={() => setAnswering(null)}
              style={{ flex: 1 }}
            />
            <Button
              label="Publier"
              onPress={async () => {
                if (!answering) return;
                setSaving(true);
                try {
                  await saveReply(answering.id, draft);
                  setAnswering(null);
                } finally {
                  setSaving(false);
                }
              }}
              disabled={draft.trim().length < 5}
              loading={saving}
              background={theme.primary.main}
              color={theme.primary.on}
              style={{ flex: 1.3 }}
            />
          </>
        }
      >
        {answering ? (
          <View
            style={{
              padding: spacing.lg,
              borderRadius: radius.lg,
              backgroundColor: theme.surface.base,
              gap: spacing.xs,
            }}
          >
            <Text style={[typography.label, { color: theme.foreground.white }]}>
              {answering.author}
            </Text>
            <Text
              style={[typography.bodySmall, { color: theme.foreground.gray }]}
            >
              {answering.comment}
            </Text>
          </View>
        ) : null}

        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder="Merci pour votre retour…"
          placeholderTextColor={theme.foreground.gray}
          multiline
          maxLength={400}
          accessibilityLabel="Votre réponse"
          style={[
            typography.body,
            {
              minHeight: 120,
              textAlignVertical: "top",
              color: theme.foreground.white,
              backgroundColor: theme.surface.base,
              borderRadius: radius.lg,
              borderWidth: 1,
              borderColor: theme.border,
              padding: spacing.lg,
            },
          ]}
        />
        <Text style={[typography.caption, { color: theme.foreground.gray }]}>
          {draft.length +
            "/400 — votre réponse est publique et signée du salon."}
        </Text>
      </BottomSheet>
    </View>
  );
}

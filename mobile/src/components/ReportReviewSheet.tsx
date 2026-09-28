import React, { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { spacing } from "../constants/spacing";
import { typography } from "../constants/typography";
import { useTheme } from "../contexts/ThemeContext";
import { REPORT_REASONS, reportReview, type ReportReason } from "../features/reviews/report";
import { BottomSheet } from "./ui/BottomSheet";
import { Button } from "./ui/Button";
import { Chip } from "./ui/Chip";
import { TextField } from "./ui/TextField";

interface ReportReviewSheetProps {
  /** The review being reported; `null` keeps the sheet closed. */
  reviewId: string | null;
  onClose: () => void;
  /** Sent: the caller marks the review « Signalé ». */
  onReported: (reviewId: string) => void;
}

/** "Signaler" (TODO.md Phase 6): a reason, a few words if wanted, sent once to WorldHair's moderation. */
export function ReportReviewSheet({ reviewId, onClose, onReported }: ReportReviewSheetProps) {
  const { theme } = useTheme();
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!reviewId) return;
    setReason(null);
    setDetails("");
    setError(null);
  }, [reviewId]);

  const send = async () => {
    if (!reviewId || !reason) return;
    setSending(true);
    setError(null);
    try {
      await reportReview(reviewId, reason, details);
      onReported(reviewId);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Le signalement n'a pas pu être envoyé. Réessayez.");
    } finally {
      setSending(false);
    }
  };

  return (
    <BottomSheet
      visible={reviewId !== null}
      title="Signaler cet avis"
      onClose={onClose}
      footer={
        <Button
          label={sending ? "Envoi…" : "Envoyer le signalement"}
          onPress={() => void send()}
          disabled={!reason || sending}
          style={{ flex: 1 }}
        />
      }
    >
      <View style={{ gap: spacing.lg }}>
        <Text style={[typography.bodySmall, { color: theme.foreground.gray }]}>
          L&apos;équipe WorldHair examine chaque signalement. L&apos;avis reste visible tant qu&apos;elle n&apos;a pas
          décidé.
        </Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
          {REPORT_REASONS.map((option) => (
            <Chip
              key={option.value}
              label={option.label}
              selected={reason === option.value}
              onPress={() => setReason(option.value)}
            />
          ))}
        </View>
        <TextField
          label="Précisions (facultatif)"
          value={details}
          onChangeText={setDetails}
          placeholder="Ce qui ne va pas dans cet avis"
          multiline
          maxLength={400}
          autoCapitalize="sentences"
        />
        {error ? <Text style={[typography.bodySmall, { color: theme.danger }]}>{error}</Text> : null}
      </View>
    </BottomSheet>
  );
}

import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "../../components/ui/Button";
import { Chip } from "../../components/ui/Chip";
import { RatingStars } from "../../components/ui/RatingStars";
import { useResponsive } from "../../constants/responsive";
import { radius, spacing } from "../../constants/spacing";
import { typography } from "../../constants/typography";
import { useTheme } from "../../contexts/ThemeContext";
import { useSalonSummary } from "../../features/salons/api";
import {
  listAppointments,
  salonNameFor,
  serviceNameFor,
  submitReview,
  type Appointment,
} from "../../services/booking";
import { fullDate, timeOfDay } from "../../utils/date";

const TAGS = [
  "Ponctualité",
  "Écoute",
  "Résultat",
  "Ambiance",
  "Propreté",
  "Conseils",
  "Rapport qualité-prix",
];

const RATING_LABELS = [
  "",
  "Très décevant",
  "Décevant",
  "Correct",
  "Très bien",
  "Excellent !",
];

/**
 * Rating screen: one big centred question, nothing else competing for
 * attention. No rails, no cards stack — a deliberate break from the lists.
 */
export default function LeaveReview() {
  const { appointmentId } = useLocalSearchParams<{ appointmentId: string }>();
  const router = useRouter();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { gutter } = useResponsive();

  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [rating, setRating] = useState(0);
  const [tags, setTags] = useState<string[]>([]);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Unused directly — warms the shared salon-name cache salonNameFor()/
  // serviceNameFor() below read from, and re-renders once it resolves.
  useSalonSummary(appointment?.salonId);

  useEffect(() => {
    let cancelled = false;
    listAppointments().then((all) => {
      if (!cancelled)
        setAppointment(all.find((a) => a.id === String(appointmentId)) ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [appointmentId]);

  const toggleTag = (tag: string) =>
    setTags((current) =>
      current.includes(tag)
        ? current.filter((t) => t !== tag)
        : [...current, tag],
    );

  const handleSubmit = async () => {
    if (!appointment) return;
    if (rating === 0) {
      setError("Choisissez une note pour continuer.");
      return;
    }

    setError(null);
    setSubmitting(true);
    try {
      await submitReview({
        appointmentId: appointment.id,
        salonId: appointment.salonId,
        rating,
        tags,
        comment,
      });
      router.replace("/appointments" as never);
    } catch {
      setError("Envoi impossible. Réessayez.");
    } finally {
      setSubmitting(false);
    }
  };

  const start = appointment ? new Date(appointment.startsAt) : null;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.background.dark }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: gutter,
          paddingTop: insets.top + spacing.md,
          paddingBottom: insets.bottom + spacing.xxl,
          gap: spacing.xxl,
          flexGrow: 1,
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Retour"
          hitSlop={8}
          style={{ width: 40, height: 40, justifyContent: "center" }}
        >
          <MaterialCommunityIcons
            name="chevron-left"
            size={26}
            color={theme.foreground.white}
          />
        </Pressable>

        <View style={{ alignItems: "center", gap: spacing.md }}>
          <Text
            style={[
              typography.display,
              { color: theme.foreground.white, textAlign: "center" },
            ]}
            accessibilityRole="header"
          >
            Comment{"\n"}s&apos;est passée{"\n"}la prestation ?
          </Text>
          {appointment && start ? (
            <Text
              style={[
                typography.bodySmall,
                { color: theme.foreground.gray, textAlign: "center" },
              ]}
            >
              {salonNameFor(appointment) +
                " · " +
                serviceNameFor(appointment) +
                "\n" +
                fullDate(start) +
                " à " +
                timeOfDay(start)}
            </Text>
          ) : null}
        </View>

        <View style={{ alignItems: "center", gap: spacing.md }}>
          <RatingStars
            value={rating}
            size={40}
            onChange={(value) => {
              setRating(value);
              if (error) setError(null);
            }}
          />
          <Text
            style={[
              typography.h2,
              {
                color: rating > 0 ? theme.accent.warm : theme.foreground.gray,
                minHeight: 26,
              },
            ]}
          >
            {rating > 0 ? RATING_LABELS[rating] : "Touchez une étoile"}
          </Text>
        </View>

        <View style={{ gap: spacing.md }}>
          <Text style={[typography.overline, { color: theme.foreground.gray }]}>
            CE QUI VOUS A MARQUÉ
          </Text>
          <View
            style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}
          >
            {TAGS.map((tag) => (
              <Chip
                key={tag}
                label={tag}
                selected={tags.includes(tag)}
                onPress={() => toggleTag(tag)}
              />
            ))}
          </View>
        </View>

        <View style={{ gap: spacing.md }}>
          <Text style={[typography.overline, { color: theme.foreground.gray }]}>
            VOTRE COMMENTAIRE (OPTIONNEL)
          </Text>
          <TextInput
            value={comment}
            onChangeText={setComment}
            placeholder="Racontez votre expérience en quelques mots…"
            placeholderTextColor={theme.foreground.gray}
            multiline
            maxLength={500}
            accessibilityLabel="Commentaire"
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
            {comment.length + "/500"}
          </Text>
        </View>

        {error ? (
          <Text
            style={[
              typography.bodySmall,
              { color: theme.danger, textAlign: "center" },
            ]}
          >
            {error}
          </Text>
        ) : null}

        <View style={{ gap: spacing.md, marginTop: "auto" }}>
          <Button
            label="Publier mon avis"
            onPress={handleSubmit}
            loading={submitting}
            disabled={!appointment}
          />
          <Button
            label="Plus tard"
            variant="ghost"
            onPress={() => router.back()}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

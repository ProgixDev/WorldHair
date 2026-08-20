import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Button } from "../../components/ui/Button";
import { Screen } from "../../components/ui/Screen";
import { useResponsive } from "../../constants/responsive";
import { radius, spacing } from "../../constants/spacing";
import { typography } from "../../constants/typography";
import { useAuth } from "../../contexts/AuthContext";
import { useTheme } from "../../contexts/ThemeContext";
import { ROUTES } from "../../features/auth/routing";

function formatDate(iso?: string): string {
  if (!iso) return "";
  const date = new Date(iso);
  return date.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/** Coiffeur dossier review states: awaiting a decision, or refused. */
export default function PendingReview() {
  const router = useRouter();
  const { theme } = useTheme();
  const { space } = useResponsive();
  const { session, signOut, simulateReviewOutcome } = useAuth();
  const [busy, setBusy] = useState(false);

  const rejected = session?.status === "rejected";
  const application = session?.application ?? null;

  // An approved dossier has no business sitting on this screen.
  useEffect(() => {
    if (session?.status === "active") router.replace(ROUTES.discover as never);
  }, [session?.status, router]);

  const handleSignOut = async () => {
    await signOut();
    router.replace(ROUTES.signIn as never);
  };

  const handleSimulate = async (outcome: "approved" | "rejected") => {
    setBusy(true);
    try {
      await simulateReviewOutcome(
        outcome,
        outcome === "rejected"
          ? "Le diplôme envoyé est illisible. Merci de renvoyer une photo nette."
          : undefined,
      );
      if (outcome === "approved") router.replace(ROUTES.discover as never);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen
      scroll
      centered
      footer={
        rejected ? (
          <Button
            label="Modifier mon dossier"
            onPress={() => router.replace(ROUTES.proIdentity as never)}
          />
        ) : undefined
      }
    >
      <View
        style={{ gap: space(spacing.xl), paddingVertical: space(spacing.xl) }}
      >
        <View style={{ alignItems: "center", gap: spacing.lg }}>
          <View
            style={{
              width: 88,
              height: 88,
              borderRadius: radius.full,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: theme.surface.base,
              borderWidth: 1,
              borderColor: rejected ? theme.danger : theme.primary.main,
            }}
          >
            <MaterialCommunityIcons
              name={rejected ? "alert-circle-outline" : "clock-outline"}
              size={40}
              color={rejected ? theme.danger : theme.primary.main}
            />
          </View>

          <View style={{ gap: spacing.sm }}>
            <Text
              style={[
                typography.h1,
                { color: theme.foreground.white, textAlign: "center" },
              ]}
              accessibilityRole="header"
            >
              {rejected
                ? "Dossier non validé"
                : "Compte en attente de validation"}
            </Text>
            <Text
              style={[
                typography.body,
                { color: theme.foreground.gray, textAlign: "center" },
              ]}
            >
              {rejected
                ? (session?.reviewMessage ??
                  "Un élément de votre dossier n'a pas pu être vérifié.")
                : "Notre équipe vérifie votre pièce d'identité et votre diplôme. Vous serez notifié dès que votre compte est validé."}
            </Text>
          </View>
        </View>

        {!rejected ? (
          <View style={{ gap: spacing.lg }}>
            <TimelineStep
              icon="check"
              label="Dossier envoyé"
              detail={formatDate(application?.submittedAt)}
              state="done"
            />
            <TimelineStep
              icon="progress-clock"
              label="Vérification en cours"
              detail="Réponse sous 48 h ouvrées"
              state="current"
            />
            <TimelineStep
              icon="lock-outline"
              label="Compte activé"
              detail="Agenda, prestations et réservations"
              state="todo"
            />
          </View>
        ) : null}

        {application ? (
          <View
            style={{
              padding: spacing.lg,
              borderRadius: radius.lg,
              backgroundColor: theme.surface.base,
              borderWidth: 1,
              borderColor: theme.border,
              gap: spacing.sm,
            }}
          >
            <Text
              style={[typography.overline, { color: theme.foreground.gray }]}
            >
              DOSSIER
            </Text>
            <SummaryRow label="Salon" value={application.salonName} />
            <SummaryRow
              label="Adresse"
              value={
                application.addressLine +
                ", " +
                application.postalCode +
                " " +
                application.city
              }
            />
            <SummaryRow
              label="Documents"
              value={application.documents.length + " fichiers envoyés"}
            />
          </View>
        ) : null}

        {/* Frontend-only build: no admin back-office exists yet. */}
        <View
          style={{
            padding: spacing.lg,
            borderRadius: radius.lg,
            borderWidth: 1,
            borderStyle: "dashed",
            borderColor: theme.border,
            gap: spacing.md,
          }}
        >
          <Text style={[typography.label, { color: theme.foreground.gray }]}>
            Mode démo — simuler la décision admin
          </Text>
          <View style={{ flexDirection: "row", gap: spacing.md }}>
            <Button
              label="Valider"
              variant="outline"
              onPress={() => handleSimulate("approved")}
              disabled={busy}
              style={{ flex: 1 }}
            />
            <Button
              label="Refuser"
              variant="outline"
              onPress={() => handleSimulate("rejected")}
              disabled={busy}
              color={theme.danger}
              background={theme.danger}
              style={{ flex: 1 }}
            />
          </View>
        </View>

        <Pressable
          onPress={handleSignOut}
          accessibilityRole="button"
          hitSlop={8}
          style={{ alignItems: "center", paddingVertical: spacing.sm }}
        >
          <Text style={[typography.label, { color: theme.foreground.gray }]}>
            Se déconnecter
          </Text>
        </Pressable>
      </View>
    </Screen>
  );
}

function TimelineStep({
  icon,
  label,
  detail,
  state,
}: {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  label: string;
  detail?: string;
  state: "done" | "current" | "todo";
}) {
  const { theme } = useTheme();
  const tint =
    state === "done"
      ? theme.success
      : state === "current"
        ? theme.primary.main
        : theme.foreground.gray;

  return (
    <View
      style={{ flexDirection: "row", gap: spacing.md, alignItems: "center" }}
    >
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: radius.full,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: theme.surface.base,
          borderWidth: state === "todo" ? 1 : 0,
          borderColor: theme.border,
        }}
      >
        <MaterialCommunityIcons name={icon} size={18} color={tint} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text
          style={[
            typography.bodyMedium,
            {
              color:
                state === "todo"
                  ? theme.foreground.gray
                  : theme.foreground.white,
            },
          ]}
        >
          {label}
        </Text>
        {detail ? (
          <Text style={[typography.caption, { color: theme.foreground.gray }]}>
            {detail}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  const { theme } = useTheme();
  return (
    <View style={{ flexDirection: "row", gap: spacing.md }}>
      <Text
        style={[
          typography.bodySmall,
          { color: theme.foreground.gray, width: 96 },
        ]}
      >
        {label}
      </Text>
      <Text
        style={[
          typography.bodySmall,
          { color: theme.foreground.white, flex: 1 },
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

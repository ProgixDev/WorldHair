import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Text, View } from "react-native";
import { Button } from "../../components/ui/Button";
import { Screen } from "../../components/ui/Screen";
import { radius, spacing } from "../../constants/spacing";
import { typography } from "../../constants/typography";
import { useAuth } from "../../contexts/AuthContext";
import { useTheme } from "../../contexts/ThemeContext";
import { nextRouteForSession, ROUTES } from "../../features/auth/routing";
import { routeForPresenceLink } from "../../features/presence/linking";
import {
  confirmPresence,
  normalizePresenceCode,
  presenceErrorMessage,
  type PresenceConfirmation,
} from "../../services/presence";
import { clearPendingPresenceCode, setPendingPresenceCode } from "../../services/preferences";
import { relativeDay, timeOfDay } from "../../utils/date";

type Outcome =
  | { status: "loading" }
  | { status: "done"; confirmation: PresenceConfirmation }
  | { status: "error"; message: string };

const INVALID_CODE_MESSAGE = "Ce code n'est plus valable. Demandez au salon d'en afficher un nouveau.";

/**
 * Where the salon's end-of-service QR code lands (« worldhair://rdv/CODE »,
 * from the website's /rdv page): the client confirms they were there, which
 * only proves presence (verified reviews, disputes) — payment is untouched.
 * Signed out, the code is kept and sign-in comes first; the client shell
 * resumes it (app/(particulier)/_layout.tsx).
 */
export default function PresenceLink() {
  const router = useRouter();
  const { theme } = useTheme();
  const { session, isHydrating } = useAuth();
  const { code: rawCode } = useLocalSearchParams<{ code: string }>();
  const code = normalizePresenceCode(rawCode ?? "");

  const [outcome, setOutcome] = useState<Outcome>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  // Primitives, so the session being refreshed in the background doesn't send the code twice.
  const decision = isHydrating ? null : routeForPresenceLink(session);
  const action = decision?.action ?? null;
  const route = decision && decision.action !== "confirm" ? decision.route : null;

  // Not ready to confirm: keep the code and go finish (sign-in…), or — a salon's account — say it isn't for them.
  useEffect(() => {
    if (!code || !route || action === "confirm") return;
    let current = true;
    void (async () => {
      if (action === "later") await setPendingPresenceCode(code);
      else await clearPendingPresenceCode();
      if (!current) return;
      router.replace(route as never);
      if (action === "not-for-you") {
        Alert.alert(
          "Lien pour les clients",
          "Ce code sert à un client pour confirmer sa présence à son rendez-vous : votre compte n'en a pas besoin.",
        );
      }
    })();
    return () => {
      current = false;
    };
  }, [action, route, code, router]);

  // A client whose account is ready: the server decides whether the code still holds.
  useEffect(() => {
    if (!code || action !== "confirm") return;
    let current = true;
    void clearPendingPresenceCode();
    confirmPresence(code)
      .then((confirmation) => {
        if (current) setOutcome({ status: "done", confirmation });
      })
      .catch((err: unknown) => {
        if (current) setOutcome({ status: "error", message: presenceErrorMessage(err) });
      });
    return () => {
      current = false;
    };
  }, [action, code, attempt]);

  const close = () => router.replace(nextRouteForSession(session, true) as never);
  const retry = () => {
    setOutcome({ status: "loading" });
    setAttempt((n) => n + 1);
  };

  // Hydrating, on its way to sign-in / the account's home, or waiting for the server: nothing to read yet.
  if (isHydrating || (code && (action !== "confirm" || outcome.status === "loading"))) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: theme.background.dark }}>
        <ActivityIndicator color={theme.primary.main} />
      </View>
    );
  }

  const failed = !code || outcome.status === "error";
  const confirmation = outcome.status === "done" ? outcome.confirmation : null;
  const startsAt = confirmation ? new Date(confirmation.startsAt) : null;

  return (
    <Screen
      centered
      footer={
        <View style={{ gap: spacing.sm }}>
          {confirmation ? (
            <Button label="Voir mes rendez-vous" onPress={() => router.replace(ROUTES.appointments as never)} />
          ) : (
            <>
              {code ? <Button label="Réessayer" onPress={retry} /> : null}
              <Button label="Fermer" variant={code ? "outline" : "primary"} onPress={close} />
            </>
          )}
        </View>
      }
    >
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.lg }}>
        <View
          style={{
            width: 72,
            height: 72,
            borderRadius: radius.full,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: theme.surface.base,
            borderWidth: 1,
            borderColor: failed ? theme.danger : theme.success,
          }}
        >
          <MaterialCommunityIcons
            name={failed ? "alert-circle-outline" : "check"}
            size={32}
            color={failed ? theme.danger : theme.success}
          />
        </View>

        {confirmation && startsAt ? (
          <View style={{ gap: spacing.md, alignItems: "center" }}>
            <Text style={[typography.h2, { color: theme.foreground.white, textAlign: "center" }]} accessibilityRole="header">
              Merci ! Votre rendez-vous est confirmé.
            </Text>
            <View style={{ gap: spacing.xs, alignItems: "center" }}>
              <Text style={[typography.bodyMedium, { color: theme.foreground.white, textAlign: "center" }]}>
                {confirmation.salonName}
              </Text>
              <Text style={[typography.bodySmall, { color: theme.foreground.gray, textAlign: "center" }]}>
                {confirmation.serviceName + " · " + relativeDay(startsAt) + " à " + timeOfDay(startsAt)}
              </Text>
            </View>
            <Text style={[typography.caption, { color: theme.foreground.gray, textAlign: "center" }]}>
              Vous pourrez laisser un avis depuis « Mes rendez-vous ».
            </Text>
          </View>
        ) : (
          <View style={{ gap: spacing.sm, alignItems: "center" }}>
            <Text style={[typography.h2, { color: theme.foreground.white, textAlign: "center" }]} accessibilityRole="header">
              Confirmation impossible
            </Text>
            <Text style={[typography.bodySmall, { color: theme.foreground.gray, textAlign: "center" }]}>
              {outcome.status === "error" ? outcome.message : INVALID_CODE_MESSAGE}
            </Text>
          </View>
        )}
      </View>
    </Screen>
  );
}

import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useRef, useState } from "react";
import { Alert, Pressable, Text, TextInput, View } from "react-native";
import { MyDataGroups } from "../../components/account/MyDataGroups";
import { AuthHeader } from "../../components/ui/AuthHeader";
import { Button } from "../../components/ui/Button";
import { Screen } from "../../components/ui/Screen";
import { useResponsive } from "../../constants/responsive";
import { radius, spacing } from "../../constants/spacing";
import { fontFamily, typography } from "../../constants/typography";
import { useAuth } from "../../contexts/AuthContext";
import { useTheme } from "../../contexts/ThemeContext";
import { ROUTES } from "../../features/auth/routing";
import { clearSignupIntent } from "../../services/preferences";
import {
  INVITE_CODE_LENGTH,
  joinSalon,
  normalizeInviteCode,
  staffErrorMessage,
} from "../../services/staff";

/**
 * « Rejoindre un salon » (TODO.md Phase 3): the code the salon's owner
 * makes in his app (« Équipe › Inviter ») turns this account into one of
 * his team — no dossier, no admin review, the owner vouches. Reached right
 * after sign-up (still a client account), or by a staff member no longer
 * in a salon (left, or removed by the owner).
 */
export default function JoinSalon() {
  const router = useRouter();
  const { theme } = useTheme();
  const { space } = useResponsive();
  const { session, refresh, signOut } = useAuth();

  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);

  // Out of a salon already: they were in one before.
  const wasInSalon = session?.role === "staff";

  const handleJoin = async () => {
    if (code.length !== INVITE_CODE_LENGTH) {
      setError("Le code fait 6 caractères, lettres et chiffres.");
      return;
    }
    setError(null);
    setJoining(true);
    try {
      const membership = await joinSalon(code);
      await clearSignupIntent();
      // The account is now a staff member's: re-read it so the app knows.
      await refresh().catch(() => null);
      router.replace(ROUTES.staffAgenda as never);
      Alert.alert("Bienvenue !", "Vous faites maintenant partie de l'équipe de " + membership.salonName + ".");
    } catch (err) {
      setError(staffErrorMessage(err));
    } finally {
      setJoining(false);
    }
  };

  const handleClient = async () => {
    await clearSignupIntent();
    router.replace(ROUTES.discover as never);
  };

  const handleSignOut = async () => {
    await signOut();
    router.replace(ROUTES.signIn as never);
  };

  return (
    <Screen
      scroll
      centered
      footer={<Button label="Rejoindre" onPress={() => void handleJoin()} loading={joining} />}
    >
      <View style={{ gap: space(spacing.xl), paddingBottom: space(spacing.lg) }}>
        <AuthHeader
          title="Rejoindre un salon"
          subtitle={
            wasInSalon
              ? "Vous ne faites plus partie d'un salon. Pour en rejoindre un, saisissez le code que son gérant vous donne."
              : "Saisissez le code que le gérant de votre salon vous donne : vous retrouverez ensuite vos rendez-vous ici."
          }
          showBack={false}
        />

        <View
          style={{
            flexDirection: "row",
            gap: spacing.md,
            padding: spacing.lg,
            borderRadius: radius.lg,
            backgroundColor: theme.surface.base,
            borderWidth: 1,
            borderColor: theme.divider,
          }}
        >
          <MaterialCommunityIcons name="account-group-outline" size={22} color={theme.primary.main} />
          <Text style={[typography.bodySmall, { color: theme.foreground.gray, flex: 1 }]}>
            Le gérant crée ce code dans son application, depuis{" "}
            <Text style={{ color: theme.foreground.white }}>« Équipe › Inviter »</Text>. Il ne sert qu&apos;une fois
            et reste valable 7 jours.
          </Text>
        </View>

        <View style={{ gap: spacing.md }}>
          <Text style={[typography.label, { color: theme.foreground.gray }]}>Code d&apos;invitation</Text>
          <InviteCodeInput
            value={code}
            onChange={(next) => {
              setCode(next);
              if (error) setError(null);
            }}
            error={Boolean(error)}
          />
          {error ? <Text style={[typography.bodySmall, { color: theme.danger }]}>{error}</Text> : null}
        </View>

        <View style={{ gap: spacing.xs, alignItems: "center" }}>
          {session?.role === "particulier" ? (
            <Pressable
              onPress={() => void handleClient()}
              accessibilityRole="button"
              hitSlop={8}
              style={{ paddingVertical: spacing.sm }}
            >
              <Text style={[typography.label, { color: theme.primary.main }]}>Je suis client, pas coiffeur</Text>
            </Pressable>
          ) : null}
          <Pressable
            onPress={() => void handleSignOut()}
            accessibilityRole="button"
            hitSlop={8}
            style={{ paddingVertical: spacing.sm }}
          >
            <Text style={[typography.label, { color: theme.foreground.gray }]}>Se déconnecter</Text>
          </Pressable>
        </View>

        <MyDataGroups variant="links" />
      </View>
    </Screen>
  );
}

/**
 * Six boxes over one real input, like the email code (OtpInput) — but
 * letters and digits, in capitals, however they're typed or pasted.
 */
function InviteCodeInput({
  value,
  onChange,
  error,
}: {
  value: string;
  onChange: (value: string) => void;
  error: boolean;
}) {
  const { theme } = useTheme();
  const { width } = useResponsive();
  const inputRef = useRef<TextInput>(null);
  const [focused, setFocused] = useState(false);

  const boxSize = Math.max(
    40,
    Math.min(56, Math.floor((width - spacing.xl * 2 - spacing.sm * (INVITE_CODE_LENGTH - 1)) / INVITE_CODE_LENGTH)),
  );

  return (
    <Pressable
      onPress={() => inputRef.current?.focus()}
      accessibilityRole="none"
      style={{ flexDirection: "row", gap: spacing.sm }}
    >
      {Array.from({ length: INVITE_CODE_LENGTH }, (_, index) => {
        const isCursor = focused && index === Math.min(value.length, INVITE_CODE_LENGTH - 1);
        return (
          <View
            key={index}
            style={{
              width: boxSize,
              minHeight: boxSize,
              borderRadius: radius.md,
              borderWidth: isCursor || error ? 2 : 1,
              borderColor: error ? theme.danger : isCursor ? theme.primary.main : theme.border,
              backgroundColor: theme.surface.base,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ fontFamily: fontFamily.sansMedium, fontSize: 22, lineHeight: 28, color: theme.foreground.white }}>
              {value[index] ?? ""}
            </Text>
          </View>
        );
      })}

      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={(next) => onChange(normalizeInviteCode(next))}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        autoCapitalize="characters"
        autoCorrect={false}
        autoComplete="off"
        spellCheck={false}
        accessibilityLabel="Code d'invitation du salon"
        caretHidden
        style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, opacity: 0 }}
      />
    </Pressable>
  );
}

import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { AuthHeader } from "../../components/ui/AuthHeader";
import { AvatarPicker } from "../../components/ui/AvatarPicker";
import { Button } from "../../components/ui/Button";
import { Screen } from "../../components/ui/Screen";
import { TextField } from "../../components/ui/TextField";
import { useResponsive } from "../../constants/responsive";
import { spacing } from "../../constants/spacing";
import { typography } from "../../constants/typography";
import { useAuth } from "../../contexts/AuthContext";
import { useTheme } from "../../contexts/ThemeContext";
import { resolveNextRoute } from "../../features/auth/routing";
import { AuthError } from "../../services/auth";
import { getSignupIntent } from "../../services/preferences";
import { isValidName } from "../../utils/validation";
import { MyDataGroups } from "../../components/account/MyDataGroups";

export default function ProfileSetup() {
  const router = useRouter();
  const { theme } = useTheme();
  const { space } = useResponsive();
  const { session, saveParticulierProfile } = useAuth();

  // The same screen creates the profile and edits it later, so it starts from
  // whatever the session already holds.
  const existing = session?.profile ?? null;
  const isEditing = existing !== null;
  // A salon's staff member, or someone about to join a salon (intent
  // "staff"): their salon sees this, not salons they book.
  const [joiningSalon, setJoiningSalon] = useState(false);
  useEffect(() => {
    let cancelled = false;
    void getSignupIntent().then((intent) => {
      if (!cancelled) setJoiningSalon(intent === "staff");
    });
    return () => {
      cancelled = true;
    };
  }, []);
  const isStaff = session?.role === "staff" || (joiningSalon && !isEditing);

  const [firstName, setFirstName] = useState(existing?.firstName ?? "");
  const [lastName, setLastName] = useState(existing?.lastName ?? "");
  const [photoUri, setPhotoUri] = useState<string | null>(
    existing?.photoUri ?? null,
  );
  const [errors, setErrors] = useState<{
    firstName?: string;
    lastName?: string;
  }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    const next: typeof errors = {};
    if (!isValidName(firstName)) next.firstName = "Prénom requis.";
    if (!isValidName(lastName)) next.lastName = "Nom requis.";
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setFormError(null);
    setSaving(true);
    try {
      const saved = await saveParticulierProfile({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        photoUri,
      });
      // The map for a client; the owner's code for someone joining a salon
      // (intent "staff"), or the agenda for a staff member already in one.
      if (isEditing && router.canGoBack()) router.back();
      else router.replace((await resolveNextRoute(saved, true)) as never);
    } catch (err) {
      setFormError(
        err instanceof AuthError
          ? err.message
          : "Enregistrement impossible. Réessayez.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen
      scroll
      centered
      footer={
        <Button
          label={isEditing ? "Enregistrer" : "Terminer"}
          onPress={handleSubmit}
          loading={saving}
        />
      }
    >
      <View
        style={{ gap: space(spacing.xl), paddingBottom: space(spacing.lg) }}
      >
        <AuthHeader
          title={isEditing ? "Modifier mon profil" : "Votre profil"}
          subtitle={
            isStaff
              ? "Ces informations sont visibles par votre salon."
              : isEditing
                ? "Ces informations sont visibles par les salons que vous réservez."
                : "Pour que les coiffeurs sachent qui ils accueillent."
          }
          showBack={isEditing}
        />

        <AvatarPicker uri={photoUri} onChange={setPhotoUri} />

        <View style={{ gap: spacing.lg }}>
          <TextField
            label="Prénom"
            value={firstName}
            onChangeText={setFirstName}
            placeholder="Camille"
            autoCapitalize="words"
            autoComplete="given-name"
            textContentType="givenName"
            icon="account-outline"
            error={errors.firstName}
          />
          <TextField
            label="Nom"
            value={lastName}
            onChangeText={setLastName}
            placeholder="Durand"
            autoCapitalize="words"
            autoComplete="family-name"
            textContentType="familyName"
            icon="account-outline"
            error={errors.lastName}
          />
        </View>

        {formError ? (
          <Text style={[typography.bodySmall, { color: theme.danger }]}>
            {formError}
          </Text>
        ) : null}

        {isEditing ? null : <MyDataGroups variant="links" />}
      </View>
    </Screen>
  );
}

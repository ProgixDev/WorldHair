import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { Text, View } from "react-native";
import { AuthHeader } from "../../../components/ui/AuthHeader";
import { Button } from "../../../components/ui/Button";
import { Checkbox } from "../../../components/ui/Checkbox";
import { Screen } from "../../../components/ui/Screen";
import { UploadSlot } from "../../../components/ui/UploadSlot";
import { useResponsive } from "../../../constants/responsive";
import { radius, spacing } from "../../../constants/spacing";
import { typography } from "../../../constants/typography";
import { useAuth } from "../../../contexts/AuthContext";
import { useTheme } from "../../../contexts/ThemeContext";
import { ROUTES } from "../../../features/auth/routing";
import {
  PRO_WIZARD_STEPS,
  useProApplication,
} from "../../../features/pro/ProApplicationContext";

/** Step 3 of the coiffeur signup: identity document + diploma, then submit. */
export default function ProDocuments() {
  const router = useRouter();
  const { theme } = useTheme();
  const { space } = useResponsive();
  const { draft, update, reset } = useProApplication();
  const { submitProApplication } = useAuth();

  const [certified, setCertified] = useState(false);
  const [errors, setErrors] = useState<{
    identity?: string;
    diploma?: string;
    certified?: string;
  }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    const next: typeof errors = {};
    if (!draft.identity) next.identity = "Pièce d'identité requise.";
    if (!draft.diploma) next.diploma = "Diplôme ou certification requis.";
    if (!certified) next.certified = "Confirmez l'exactitude de vos documents.";
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setFormError(null);
    setSubmitting(true);
    try {
      await submitProApplication({
        firstName: draft.firstName.trim(),
        lastName: draft.lastName.trim(),
        phone: draft.phone.trim(),
        salonName: draft.salonName.trim(),
        description: draft.description.trim(),
        addressLine: draft.addressLine.trim(),
        postalCode: draft.postalCode.trim(),
        city: draft.city.trim(),
        documents: [draft.identity!, draft.diploma!],
      });
      reset();
      router.replace(ROUTES.pending as never);
    } catch {
      setFormError("Envoi impossible. Réessayez.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen
      scroll
      centered
      footer={
        <Button
          label="Envoyer mon dossier"
          onPress={handleSubmit}
          loading={submitting}
        />
      }
    >
      <View
        style={{ gap: space(spacing.xl), paddingBottom: space(spacing.lg) }}
      >
        <AuthHeader
          title="Vos justificatifs"
          subtitle="Deux documents suffisent pour faire valider votre compte."
          step={{ current: 3, total: PRO_WIZARD_STEPS }}
        />

        <View style={{ gap: spacing.lg }}>
          <UploadSlot
            kind="identity"
            title="Pièce d'identité"
            description="Carte d'identité, passeport ou titre de séjour — JPG, PNG ou PDF."
            icon="card-account-details-outline"
            document={draft.identity}
            onChange={(identity) => {
              update({ identity });
              setErrors((e) => ({ ...e, identity: undefined }));
            }}
            error={errors.identity}
          />
          <UploadSlot
            kind="diploma"
            title="Diplôme ou certification"
            description="CAP coiffure, BP ou équivalent — JPG, PNG ou PDF."
            icon="school-outline"
            document={draft.diploma}
            onChange={(diploma) => {
              update({ diploma });
              setErrors((e) => ({ ...e, diploma: undefined }));
            }}
            error={errors.diploma}
          />
        </View>

        <View
          style={{
            flexDirection: "row",
            gap: spacing.md,
            padding: spacing.lg,
            borderRadius: radius.lg,
            backgroundColor: theme.background.accent,
            borderWidth: 1,
            borderColor: theme.border,
          }}
        >
          <MaterialCommunityIcons
            name="shield-lock-outline"
            size={20}
            color={theme.primary.main}
          />
          <Text
            style={[
              typography.caption,
              { color: theme.foreground.gray, flex: 1 },
            ]}
          >
            Vos documents servent uniquement à la vérification de votre compte
            et ne sont jamais publiés. Ils restent sur votre appareil tant
            qu&apos;aucun serveur n&apos;est connecté.
          </Text>
        </View>

        <Checkbox
          checked={certified}
          onChange={(value) => {
            setCertified(value);
            setErrors((e) => ({ ...e, certified: undefined }));
          }}
          error={errors.certified}
          accessibilityLabel="Je certifie que mes documents sont authentiques"
        >
          <Text
            style={[typography.bodySmall, { color: theme.foreground.gray }]}
          >
            Je certifie que ces documents sont authentiques et
            m&apos;appartiennent.
          </Text>
        </Checkbox>

        {formError ? (
          <Text style={[typography.bodySmall, { color: theme.danger }]}>
            {formError}
          </Text>
        ) : null}
      </View>
    </Screen>
  );
}

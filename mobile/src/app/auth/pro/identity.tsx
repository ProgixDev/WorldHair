import { useRouter } from "expo-router";
import React, { useState } from "react";
import { View } from "react-native";
import { AuthHeader } from "../../../components/ui/AuthHeader";
import { Button } from "../../../components/ui/Button";
import { Screen } from "../../../components/ui/Screen";
import { TextField } from "../../../components/ui/TextField";
import { useResponsive } from "../../../constants/responsive";
import { spacing } from "../../../constants/spacing";
import { ROUTES } from "../../../features/auth/routing";
import {
  PRO_WIZARD_STEPS,
  useProApplication,
} from "../../../features/pro/ProApplicationContext";
import { isValidName, isValidPhoneFr } from "../../../utils/validation";

/** Step 1 of the coiffeur signup: who you are. */
export default function ProIdentity() {
  const router = useRouter();
  const { space } = useResponsive();
  const { draft, update } = useProApplication();

  const [errors, setErrors] = useState<{
    firstName?: string;
    lastName?: string;
    phone?: string;
  }>({});

  const handleNext = () => {
    const next: typeof errors = {};
    if (!isValidName(draft.firstName)) next.firstName = "Prénom requis.";
    if (!isValidName(draft.lastName)) next.lastName = "Nom requis.";
    if (!isValidPhoneFr(draft.phone))
      next.phone = "Numéro de téléphone français invalide.";
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    router.push(ROUTES.proSalon as never);
  };

  return (
    <Screen
      scroll
      centered
      footer={<Button label="Continuer" onPress={handleNext} />}
    >
      <View
        style={{ gap: space(spacing.xl), paddingBottom: space(spacing.lg) }}
      >
        <AuthHeader
          title="Vos informations"
          subtitle="Elles ne sont visibles que par notre équipe de validation."
          showBack={false}
          step={{ current: 1, total: PRO_WIZARD_STEPS }}
        />

        <View style={{ gap: spacing.lg }}>
          <TextField
            label="Prénom"
            value={draft.firstName}
            onChangeText={(firstName) => update({ firstName })}
            placeholder="Camille"
            autoCapitalize="words"
            autoComplete="given-name"
            textContentType="givenName"
            icon="account-outline"
            error={errors.firstName}
          />
          <TextField
            label="Nom"
            value={draft.lastName}
            onChangeText={(lastName) => update({ lastName })}
            placeholder="Durand"
            autoCapitalize="words"
            autoComplete="family-name"
            textContentType="familyName"
            icon="account-outline"
            error={errors.lastName}
          />
          <TextField
            label="Téléphone"
            value={draft.phone}
            onChangeText={(phone) => update({ phone })}
            placeholder="06 12 34 56 78"
            keyboardType="phone-pad"
            autoComplete="tel"
            textContentType="telephoneNumber"
            icon="phone-outline"
            error={errors.phone}
            helper="Utilisé uniquement pour la validation de votre dossier."
          />
        </View>
      </View>
    </Screen>
  );
}

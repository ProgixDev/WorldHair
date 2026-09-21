import { useRouter } from "expo-router";
import React, { useState } from "react";
import { View } from "react-native";
import { AuthHeader } from "../../../components/ui/AuthHeader";
import { Button } from "../../../components/ui/Button";
import { PhoneField } from "../../../components/ui/PhoneField";
import { Screen } from "../../../components/ui/Screen";
import { TextField } from "../../../components/ui/TextField";
import { useResponsive } from "../../../constants/responsive";
import { spacing } from "../../../constants/spacing";
import { ROUTES } from "../../../features/auth/routing";
import {
  PRO_WIZARD_STEPS,
  useProApplication,
} from "../../../features/pro/ProApplicationContext";
import type { CountryCode } from "libphonenumber-js/min";
import { isValidName, isValidPhoneForCountry } from "../../../utils/validation";

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
    if (!isValidPhoneForCountry(draft.phone, draft.phoneCountry as CountryCode))
      next.phone = "Numéro de téléphone invalide pour ce pays.";
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
          <PhoneField
            label="Téléphone"
            value={draft.phone}
            onChangeText={(phone) => update({ phone })}
            country={draft.phoneCountry}
            onChangeCountry={(phoneCountry) => update({ phoneCountry })}
            error={errors.phone}
            helper="Utilisé uniquement pour la validation de votre dossier."
          />
        </View>
      </View>
    </Screen>
  );
}

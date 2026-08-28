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
import { isValidName } from "../../../utils/validation";

/** Step 2 of the coiffeur signup: the salon itself (where it is comes next). */
export default function ProSalon() {
  const router = useRouter();
  const { space } = useResponsive();
  const { draft, update } = useProApplication();

  const [errors, setErrors] = useState<{
    salonName?: string;
  }>({});

  const handleNext = () => {
    const next: typeof errors = {};
    if (!isValidName(draft.salonName)) next.salonName = "Nom du salon requis.";
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    router.push(ROUTES.proZone as never);
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
          title="Votre salon"
          subtitle="Ces informations apparaîtront sur votre fiche publique."
          step={{ current: 2, total: PRO_WIZARD_STEPS }}
        />

        <View style={{ gap: spacing.lg }}>
          <TextField
            label="Nom du salon"
            value={draft.salonName}
            onChangeText={(salonName) => update({ salonName })}
            placeholder="Studio W"
            autoCapitalize="words"
            icon="storefront-outline"
            error={errors.salonName}
          />
          <TextField
            label="Présentation"
            value={draft.description}
            onChangeText={(description) => update({ description })}
            placeholder="Coupe, coloration, coiffure afro… racontez votre univers."
            autoCapitalize="sentences"
            multiline
            maxLength={400}
            helper={draft.description.length + "/400 caractères — optionnel."}
          />
        </View>
      </View>
    </Screen>
  );
}

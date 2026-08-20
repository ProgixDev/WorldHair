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
import { isValidName, isValidPostalCodeFr } from "../../../utils/validation";

/** Step 2 of the coiffeur signup: the salon and where it is. */
export default function ProSalon() {
  const router = useRouter();
  const { space, isExpanded } = useResponsive();
  const { draft, update } = useProApplication();

  const [errors, setErrors] = useState<{
    salonName?: string;
    addressLine?: string;
    postalCode?: string;
    city?: string;
  }>({});

  const handleNext = () => {
    const next: typeof errors = {};
    if (!isValidName(draft.salonName)) next.salonName = "Nom du salon requis.";
    if (draft.addressLine.trim().length < 5)
      next.addressLine = "Adresse incomplète.";
    if (!isValidPostalCodeFr(draft.postalCode))
      next.postalCode = "Code postal à 5 chiffres.";
    if (!isValidName(draft.city)) next.city = "Ville requise.";
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    router.push(ROUTES.proDocuments as never);
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
          <TextField
            label="Adresse"
            value={draft.addressLine}
            onChangeText={(addressLine) => update({ addressLine })}
            placeholder="12 rue des Lilas"
            autoCapitalize="words"
            autoComplete="street-address"
            textContentType="fullStreetAddress"
            icon="map-marker-outline"
            error={errors.addressLine}
          />

          <View
            style={{
              flexDirection: isExpanded ? "row" : "column",
              gap: spacing.lg,
            }}
          >
            <TextField
              label="Code postal"
              value={draft.postalCode}
              onChangeText={(postalCode) =>
                update({ postalCode: postalCode.replace(/\D/g, "") })
              }
              placeholder="75011"
              keyboardType="number-pad"
              maxLength={5}
              textContentType="postalCode"
              error={errors.postalCode}
              style={isExpanded ? { flex: 1 } : undefined}
            />
            <TextField
              label="Ville"
              value={draft.city}
              onChangeText={(city) => update({ city })}
              placeholder="Paris"
              autoCapitalize="words"
              textContentType="addressCity"
              error={errors.city}
              style={isExpanded ? { flex: 2 } : undefined}
            />
          </View>
        </View>
      </View>
    </Screen>
  );
}

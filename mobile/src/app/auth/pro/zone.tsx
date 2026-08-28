import { useRouter } from "expo-router";
import React, { useState } from "react";
import { View } from "react-native";
import { AuthHeader } from "../../../components/ui/AuthHeader";
import { Button } from "../../../components/ui/Button";
import { Screen } from "../../../components/ui/Screen";
import {
  SegmentedControl,
  type SegmentOption,
} from "../../../components/ui/SegmentedControl";
import { TextField } from "../../../components/ui/TextField";
import { UploadSlot } from "../../../components/ui/UploadSlot";
import { useResponsive } from "../../../constants/responsive";
import { spacing } from "../../../constants/spacing";
import { ROUTES } from "../../../features/auth/routing";
import {
  PRO_WIZARD_STEPS,
  useProApplication,
} from "../../../features/pro/ProApplicationContext";
import type { PracticeZone } from "../../../services/auth";
import { isValidName, isValidPostalCodeFr } from "../../../utils/validation";

const ZONE_OPTIONS: SegmentOption<PracticeZone>[] = [
  { value: "salon", label: "En salon", hint: "Adresse fixe" },
  { value: "domicile", label: "À domicile", hint: "Vous vous déplacez" },
];

/** Step 3 of the coiffeur signup: where the service happens (issue #6). */
export default function ProZone() {
  const router = useRouter();
  const { space, isExpanded } = useResponsive();
  const { draft, update } = useProApplication();

  const [errors, setErrors] = useState<{
    addressLine?: string;
    postalCode?: string;
    city?: string;
    invoice?: string;
    travelRadiusKm?: string;
  }>({});

  const handleNext = () => {
    const next: typeof errors = {};
    if (draft.practiceZone === "salon") {
      if (draft.addressLine.trim().length < 5)
        next.addressLine = "Adresse incomplète.";
      if (!isValidPostalCodeFr(draft.postalCode))
        next.postalCode = "Code postal à 5 chiffres.";
      if (!isValidName(draft.city)) next.city = "Ville requise.";
      if (!draft.invoice)
        next.invoice = "Facture société requise pour prouver le local.";
    } else {
      const km = Number(draft.travelRadiusKm);
      if (!draft.travelRadiusKm.trim() || !Number.isFinite(km) || km <= 0)
        next.travelRadiusKm = "Rayon de déplacement requis.";
    }
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
          title="Votre zone de pratique"
          subtitle="Où recevez-vous ou intervenez-vous auprès de vos clients ?"
          step={{ current: 3, total: PRO_WIZARD_STEPS }}
        />

        <SegmentedControl
          options={ZONE_OPTIONS}
          value={draft.practiceZone}
          onChange={(practiceZone) => {
            update({ practiceZone });
            setErrors({});
          }}
        />

        {draft.practiceZone === "salon" ? (
          <View style={{ gap: spacing.lg }}>
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

            <UploadSlot
              kind="invoice"
              title="Facture société"
              description="Facture ou bail au nom de votre société, prouvant votre local — JPG, PNG ou PDF."
              icon="file-document-outline"
              document={draft.invoice}
              onChange={(invoice) => {
                update({ invoice });
                setErrors((e) => ({ ...e, invoice: undefined }));
              }}
              error={errors.invoice}
            />
          </View>
        ) : (
          <TextField
            label="Rayon de déplacement (km)"
            value={draft.travelRadiusKm}
            onChangeText={(travelRadiusKm) =>
              update({ travelRadiusKm: travelRadiusKm.replace(/\D/g, "") })
            }
            placeholder="15"
            keyboardType="number-pad"
            maxLength={3}
            error={errors.travelRadiusKm}
            helper="Distance maximale que vous acceptez de parcourir chez vos clients."
          />
        )}
      </View>
    </Screen>
  );
}

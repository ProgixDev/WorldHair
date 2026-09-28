import { useRouter } from "expo-router";
import React, { useState } from "react";
import { Alert, Share, Text, View } from "react-native";
import { spacing } from "../../constants/spacing";
import { typography } from "../../constants/typography";
import { useAuth } from "../../contexts/AuthContext";
import { useTheme } from "../../contexts/ThemeContext";
import { ROUTES } from "../../features/auth/routing";
import { LEGAL_PAGES, openLegalPage } from "../../features/legal/terms";
import { accountErrorMessage, deleteMyAccount, exportMyData } from "../../services/account";
import { BottomSheet } from "../ui/BottomSheet";
import { Button } from "../ui/Button";
import { Group, Row } from "../ui/SettingsList";

/** What deleting the account does, as each side reads it. */
const CONSEQUENCES: Record<"particulier" | "coiffeur", string[]> = {
  particulier: [
    "Vos rendez-vous à venir sont annulés et intégralement remboursés ; les salons sont prévenus.",
    "Votre profil, vos favoris et vos préférences sont effacés.",
    "Vos rendez-vous passés restent chez les salons sans votre nom, et vos avis restent publiés comme « Ancien client ».",
  ],
  coiffeur: [
    "Vos rendez-vous à venir sont annulés et vos clients intégralement remboursés et prévenus.",
    "Ce qui vous est dû pour vos rendez-vous passés vous est versé, et votre abonnement prend fin.",
    "Votre salon disparaît de WorldHair, avec vos photos, vos avis et vos justificatifs.",
  ],
};

/**
 * « Mes données » and « Informations légales » (TODO.md Phase 8), at the
 * bottom of the client's profile and of the salon's account: export
 * everything WorldHair holds, delete the account, read the legal pages.
 */
export function MyDataGroups() {
  const { theme } = useTheme();
  const router = useRouter();
  const { session, signOut } = useAuth();
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const role = session?.role === "coiffeur" ? "coiffeur" : "particulier";

  const handleExport = async () => {
    setExporting(true);
    try {
      await Share.share({ title: "Mes données WorldHair", message: await exportMyData() });
    } catch {
      Alert.alert("Export impossible", "Vérifiez votre connexion et réessayez.");
    } finally {
      setExporting(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    setError(null);
    try {
      await deleteMyAccount();
      setSheetOpen(false);
      await signOut();
      router.replace(ROUTES.signIn as never);
      Alert.alert("Compte supprimé", "Votre compte WorldHair et vos données ont été supprimés.");
    } catch (err) {
      setError(accountErrorMessage(err));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <Group title="Mes données">
        <Row
          icon="download-outline"
          label={exporting ? "Préparation…" : "Exporter mes données"}
          value="Une copie de vos données, au format JSON"
          onPress={() => void handleExport()}
        />
        <Row
          icon="account-remove-outline"
          label="Supprimer mon compte"
          tone="danger"
          onPress={() => {
            setError(null);
            setSheetOpen(true);
          }}
          isLast
        />
      </Group>

      <Group title="Informations légales">
        {LEGAL_PAGES.map((item, index) => (
          <Row
            key={item.page}
            icon={item.page === "confidentialite" ? "shield-lock-outline" : "file-document-outline"}
            label={item.label}
            onPress={() => void openLegalPage(item.page)}
            isLast={index === LEGAL_PAGES.length - 1}
          />
        ))}
      </Group>

      <BottomSheet
        visible={sheetOpen}
        title="Supprimer mon compte"
        onClose={() => {
          if (!deleting) setSheetOpen(false);
        }}
        footer={
          <Button
            label={deleting ? "Suppression…" : "Supprimer définitivement"}
            onPress={() => void handleDelete()}
            loading={deleting}
            background={theme.danger}
            style={{ flex: 1 }}
          />
        }
      >
        <View style={{ gap: spacing.md }}>
          <Text style={[typography.body, { color: theme.foreground.white }]}>
            La suppression est définitive et ne peut pas être annulée.
          </Text>
          {CONSEQUENCES[role].map((line) => (
            <Text key={line} style={[typography.bodySmall, { color: theme.foreground.gray }]}>
              {"• " + line}
            </Text>
          ))}
          <Text style={[typography.bodySmall, { color: theme.foreground.gray }]}>
            Vous pouvez d&apos;abord exporter vos données.
          </Text>
          {error ? <Text style={[typography.bodySmall, { color: theme.danger }]}>{error}</Text> : null}
        </View>
      </BottomSheet>
    </>
  );
}

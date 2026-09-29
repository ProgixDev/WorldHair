import * as WebBrowser from "expo-web-browser";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { Alert, Share, Text, View } from "react-native";
import { spacing } from "../../constants/spacing";
import { typography } from "../../constants/typography";
import { useAuth } from "../../contexts/AuthContext";
import { useTheme } from "../../contexts/ThemeContext";
import { ROUTES } from "../../features/auth/routing";
import { LEGAL_PAGES, openLegalPage } from "../../features/legal/terms";
import {
  accountErrorMessage,
  accountStillExists,
  deleteMyAccount,
  exportLink,
  exportMyData,
  SHAREABLE_EXPORT_CHARS,
} from "../../services/account";
import { BottomSheet } from "../ui/BottomSheet";
import { Button } from "../ui/Button";
import { Group, Row } from "../ui/SettingsList";

/** What deleting the account does, as each side reads it. */
const CONSEQUENCES: Record<"particulier" | "coiffeur", string[]> = {
  particulier: [
    "Vos rendez-vous à venir sont annulés et intégralement remboursés, et les salons prévenus — sauf ceux dont le délai d'annulation est passé, qui restent dus au salon.",
    "Votre profil, vos favoris et vos préférences sont effacés.",
    "Vos rendez-vous passés restent chez les salons, sans votre nom ni vos messages, et vos avis restent publiés comme « Ancien client ».",
  ],
  coiffeur: [
    "Vos rendez-vous à venir sont annulés, vos clients intégralement remboursés et prévenus.",
    "Ce qui vous est dû pour vos rendez-vous passés vous est versé (vos encaissements doivent être actifs), et votre abonnement prend fin sans remboursement de la période en cours.",
    "Votre salon disparaît de WorldHair, avec vos photos, vos avis et vos justificatifs.",
  ],
};

/**
 * « Mes données » and « Informations légales » (TODO.md Phase 8): export
 * everything WorldHair holds, delete the account, read the legal pages.
 * As settings rows at the bottom of the profile and the salon's account;
 * as a few links wherever else a signed-in user can be held (a dossier
 * under review, an ended subscription, new terms to accept…).
 */
export function MyDataGroups({ variant = "rows" }: { variant?: "rows" | "links" }) {
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
      const json = await exportMyData();
      // Too large for the share sheet: the same file, downloaded in the browser.
      if (json.length > SHAREABLE_EXPORT_CHARS) await WebBrowser.openBrowserAsync(await exportLink());
      else await Share.share({ title: "Mes données WorldHair", message: json });
    } catch {
      Alert.alert("Export impossible", "Vérifiez votre connexion et réessayez.");
    } finally {
      setExporting(false);
    }
  };

  const leave = async () => {
    setSheetOpen(false);
    await signOut();
    router.replace(ROUTES.signIn as never);
    Alert.alert("Compte supprimé", "Votre compte WorldHair et vos données ont été supprimés.");
  };

  const handleDelete = async () => {
    setDeleting(true);
    setError(null);
    try {
      await deleteMyAccount();
      await leave();
    } catch (err) {
      // No answer, but the server may well have finished (a long deletion, the app sent to the background).
      if (!(await accountStillExists())) await leave();
      else setError(accountErrorMessage(err));
    } finally {
      setDeleting(false);
    }
  };

  const openSheet = () => {
    setError(null);
    setSheetOpen(true);
  };

  const sheet = (
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
  );

  if (variant === "links") {
    const link = (label: string, onPress: () => void, danger = false) => (
      <Text
        key={label}
        onPress={onPress}
        accessibilityRole="link"
        style={[typography.caption, { color: danger ? theme.danger : theme.foreground.gray, textDecorationLine: "underline" }]}
      >
        {label}
      </Text>
    );
    return (
      <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "center", columnGap: spacing.lg, rowGap: spacing.sm }}>
        {link(exporting ? "Préparation…" : "Exporter mes données", () => void handleExport())}
        {link("Supprimer mon compte", openSheet, true)}
        {link("CGU", () => void openLegalPage("cgu"))}
        {link("Confidentialité", () => void openLegalPage("confidentialite"))}
        {sheet}
      </View>
    );
  }

  return (
    <>
      <Group title="Mes données">
        <Row
          icon="download-outline"
          label={exporting ? "Préparation…" : "Exporter mes données"}
          value="Une copie de vos données, au format JSON"
          onPress={() => void handleExport()}
        />
        <Row icon="account-remove-outline" label="Supprimer mon compte" tone="danger" onPress={openSheet} isLast />
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

      {sheet}
    </>
  );
}

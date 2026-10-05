import React from "react";
import { Share, Text, View } from "react-native";
import { radius, spacing } from "../../../constants/spacing";
import { fontFamily, typography } from "../../../constants/typography";
import { useTheme } from "../../../contexts/ThemeContext";
import { inviteLink, inviteShareMessage, inviteValidity } from "../../../features/pro/team";
import type { SalonInvite } from "../../../features/pro/types";
import { BottomSheet } from "../../ui/BottomSheet";
import { Button } from "../../ui/Button";
import { QrCode } from "../../ui/QrCode";

const STEPS = [
  "Faites-lui scanner ce QR code avec l'appareil photo de son téléphone, ou envoyez-lui le lien par WhatsApp ou SMS.",
  "WorldHair s'ouvre sur « Rejoindre un salon », le code déjà rempli. Sans compte, il en crée un en choisissant « Coiffeur ».",
  "Il apparaît ici, dans votre équipe : réglez ses horaires et ses congés.",
];

/** Sends a code with the share sheet (WhatsApp, SMS…); dismissing it isn't a failure. */
export async function shareInvite(salonName: string, invite: SalonInvite): Promise<void> {
  try {
    await Share.share({ message: inviteShareMessage(salonName, invite) });
  } catch {
    // Nothing shared: the code stays on screen to read out or copy.
  }
}

/**
 * A code to join the salon, big enough to read out over the phone, with
 * how long it lasts and how to use it. It's the only way into the team: the
 * owner vouches for whoever he gives it to (TODO.md Phase 3).
 */
export function InviteSheet({
  invite,
  salonName,
  visible,
  onClose,
}: {
  invite: SalonInvite | null;
  salonName: string;
  visible: boolean;
  onClose: () => void;
}) {
  const { theme } = useTheme();
  const link = invite ? inviteLink(invite.code) : null;

  return (
    <BottomSheet
      visible={visible && invite !== null}
      title="Code d'invitation"
      onClose={onClose}
      footer={
        <>
          <Button label="Fermer" variant="outline" onPress={onClose} style={{ flex: 1 }} />
          <Button
            label="Partager"
            icon="share-variant-outline"
            onPress={() => {
              if (invite) void shareInvite(salonName, invite);
            }}
            background={theme.primary.main}
            color={theme.primary.on}
            style={{ flex: 1.3 }}
          />
        </>
      }
    >
      {invite ? (
        <>
          <View
            style={{
              alignItems: "center",
              gap: spacing.sm,
              paddingVertical: spacing.xl,
              paddingHorizontal: spacing.lg,
              borderRadius: radius.lg,
              backgroundColor: theme.surface.sunken,
              borderWidth: 1,
              borderColor: theme.divider,
            }}
          >
            {link ? <QrCode value={link} size={196} /> : null}
            {/* Selectable: a long press copies it, exactly as typed in the app. */}
            <Text
              selectable
              accessibilityLabel={"Code " + invite.code.split("").join(" ")}
              style={[
                typography.display,
                { fontFamily: fontFamily.sansBold, letterSpacing: 6, color: theme.foreground.white },
              ]}
            >
              {invite.code}
            </Text>
            <Text style={[typography.caption, { color: theme.foreground.gray, textAlign: "center" }]}>
              {inviteValidity(invite.expiresAt) + " · une seule utilisation"}
            </Text>
            {link ? (
              <Text selectable style={[typography.caption, { color: theme.primary.main, textAlign: "center" }]}>
                {link}
              </Text>
            ) : null}
          </View>

          <View style={{ gap: spacing.sm }}>
            {STEPS.map((step, index) => (
              <View key={step} style={{ flexDirection: "row", gap: spacing.md }}>
                <Text style={[typography.label, { color: theme.primary.main, width: 16 }]}>{index + 1}</Text>
                <Text style={[typography.bodySmall, { color: theme.foreground.gray, flex: 1 }]}>{step}</Text>
              </View>
            ))}
          </View>
        </>
      ) : null}
    </BottomSheet>
  );
}

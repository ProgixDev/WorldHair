import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import React, { useState } from "react";
import { ActivityIndicator, Alert, Pressable, Text, View } from "react-native";
import { useTheme } from "../../contexts/ThemeContext";
import { radius, spacing } from "../../constants/spacing";
import { typography } from "../../constants/typography";
import type { ProDocument, ProDocumentKind } from "../../services/auth";

interface UploadSlotProps {
  kind: ProDocumentKind;
  title: string;
  description: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  document: ProDocument | null;
  onChange: (document: ProDocument | null) => void;
  error?: string;
}

const MAX_BYTES = 10 * 1024 * 1024;

function formatSize(bytes?: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + " Ko";
  return (bytes / (1024 * 1024)).toFixed(1) + " Mo";
}

function isImage(document: ProDocument): boolean {
  return (document.mimeType ?? "").startsWith("image/");
}

/**
 * One required document (pièce d'identité / diplôme). Accepts a photo from the
 * library or a PDF from the file browser; the file only ever stays on-device
 * until a backend exists to receive it.
 */
export function UploadSlot({
  kind,
  title,
  description,
  icon,
  document,
  onChange,
  error,
}: UploadSlotProps) {
  const { theme } = useTheme();
  const [busy, setBusy] = useState(false);

  const reject = (message: string) => Alert.alert("Fichier refusé", message);

  const pickPhoto = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          "Accès aux photos refusé",
          "Autorisez l'accès à vos photos dans les réglages pour envoyer ce document.",
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 0.9,
      });
      if (result.canceled || result.assets.length === 0) return;

      const asset = result.assets[0];
      if (asset.fileSize && asset.fileSize > MAX_BYTES) {
        reject("10 Mo maximum par document.");
        return;
      }

      onChange({
        kind,
        name: asset.fileName ?? title + ".jpg",
        uri: asset.uri,
        mimeType: asset.mimeType ?? "image/jpeg",
        size: asset.fileSize ?? null,
      });
    } finally {
      setBusy(false);
    }
  };

  const pickFile = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["application/pdf", "image/*"],
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled || result.assets.length === 0) return;

      const asset = result.assets[0];
      if (asset.size && asset.size > MAX_BYTES) {
        reject("10 Mo maximum par document.");
        return;
      }

      onChange({
        kind,
        name: asset.name,
        uri: asset.uri,
        mimeType: asset.mimeType ?? null,
        size: asset.size ?? null,
      });
    } finally {
      setBusy(false);
    }
  };

  const borderColor = error
    ? theme.danger
    : document
      ? theme.primary.main
      : theme.border;

  return (
    <View style={{ gap: spacing.xs }}>
      <View
        style={{
          borderRadius: radius.lg,
          borderWidth: document ? 1 : 2,
          borderStyle: document ? "solid" : "dashed",
          borderColor,
          backgroundColor: theme.surface.base,
          padding: spacing.lg,
          gap: spacing.md,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.md,
          }}
        >
          {document && isImage(document) ? (
            <Image
              source={{ uri: document.uri }}
              style={{ width: 48, height: 48, borderRadius: radius.sm }}
              contentFit="cover"
            />
          ) : (
            <View
              style={{
                width: 48,
                height: 48,
                borderRadius: radius.sm,
                backgroundColor: theme.background.darker,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <MaterialCommunityIcons
                name={document ? "file-check-outline" : icon}
                size={24}
                color={document ? theme.primary.main : theme.foreground.gray}
              />
            </View>
          )}

          <View style={{ flex: 1, gap: 2 }}>
            <Text
              style={[typography.bodyMedium, { color: theme.foreground.white }]}
            >
              {title}
            </Text>
            <Text
              style={[typography.caption, { color: theme.foreground.gray }]}
              numberOfLines={2}
            >
              {document
                ? [document.name, formatSize(document.size)]
                    .filter(Boolean)
                    .join(" · ")
                : description}
            </Text>
          </View>

          {busy ? <ActivityIndicator color={theme.primary.main} /> : null}
        </View>

        <View style={{ flexDirection: "row", gap: spacing.sm }}>
          {document ? (
            <>
              <SlotAction
                icon="swap-horizontal"
                label="Remplacer"
                onPress={pickFile}
              />
              <SlotAction
                icon="trash-can-outline"
                label="Retirer"
                onPress={() => onChange(null)}
                tone="danger"
              />
            </>
          ) : (
            <>
              <SlotAction
                icon="image-outline"
                label="Photo"
                onPress={pickPhoto}
              />
              <SlotAction
                icon="file-pdf-box"
                label="Fichier PDF"
                onPress={pickFile}
              />
            </>
          )}
        </View>
      </View>

      {error ? (
        <Text style={[typography.caption, { color: theme.danger }]}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

function SlotAction({
  icon,
  label,
  onPress,
  tone = "default",
}: {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  label: string;
  onPress: () => void;
  tone?: "default" | "danger";
}) {
  const { theme } = useTheme();
  const color = tone === "danger" ? theme.danger : theme.primary.main;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => ({
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: spacing.xs,
        minHeight: 40,
        borderRadius: radius.full,
        borderWidth: 1,
        borderColor: color,
        paddingHorizontal: spacing.md,
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <MaterialCommunityIcons name={icon} size={16} color={color} />
      <Text style={[typography.label, { color }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

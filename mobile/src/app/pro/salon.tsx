import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ServiceEditor } from "../../components/pro/ServiceEditor";
import { Button } from "../../components/ui/Button";
import { Chip } from "../../components/ui/Chip";
import { CityField } from "../../components/ui/CityField";
import { PhoneField } from "../../components/ui/PhoneField";
import { Group, RowShell } from "../../components/ui/SettingsList";
import { TextField } from "../../components/ui/TextField";
import { elevation, TAB_BAR_CLEARANCE } from "../../constants/elevation";
import { useResponsive } from "../../constants/responsive";
import { radius, spacing } from "../../constants/spacing";
import { typography } from "../../constants/typography";
import { usePro } from "../../contexts/ProContext";
import { useTheme } from "../../contexts/ThemeContext";
import type { GalleryPhoto, ProProfile, ProService } from "../../features/pro/types";
import { coverFor, coverPlaceholder } from "../../features/salons/images";
import {
  SPECIALTIES,
  specialtyLabel,
  type SpecialtyId,
} from "../../features/salons/types";
import { newServiceId } from "../../services/pro";
import { formatDuration, formatPrice, minutesToTime } from "../../utils/date";
import { isValidPostalCodeFr } from "../../utils/validation";

/** Mirrors GALLERY_MAX_PHOTOS in server/src/salon/salon.service.ts. */
const GALLERY_MAX = 12;

/**
 * "Mon salon": the public page as the coiffeur edits it — cover, pitch,
 * address — then the price list. An editor, not a browser: everything is a
 * field or a row with actions.
 */
export default function ProSalonPage() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { gutter } = useResponsive();
  const {
    profile,
    services,
    gallery,
    availability,
    isLoading,
    saveProfile,
    saveService,
    deleteService,
    addGalleryPhoto,
    deleteGalleryPhoto,
  } = usePro();

  const [draft, setDraft] = useState<ProProfile | null>(null);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<ProService | null>(null);
  const [addingPhoto, setAddingPhoto] = useState(false);
  const [removingPhotoId, setRemovingPhotoId] = useState<string | null>(null);
  const [errors, setErrors] = useState<{ postalCode?: string }>({});

  useEffect(() => {
    if (profile && !draft) setDraft(profile);
  }, [profile, draft]);

  const dirty = useMemo(
    () =>
      Boolean(
        draft && profile && JSON.stringify(draft) !== JSON.stringify(profile),
      ),
    [draft, profile],
  );

  if (isLoading || !profile || !draft)
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: theme.background.dark,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <ActivityIndicator color={theme.primary.main} />
      </View>
    );

  const patch = (values: Partial<ProProfile>) =>
    setDraft((current) => (current ? { ...current, ...values } : current));

  const pickCover = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(
        "Accès aux photos refusé",
        "Autorisez l'accès à vos photos pour changer la vitrine du salon.",
      );
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [16, 10],
      quality: 0.85,
    });
    if (!result.canceled && result.assets.length > 0)
      patch({ coverUri: result.assets[0].uri });
  };

  const pickGalleryPhoto = async () => {
    if (gallery.length >= GALLERY_MAX) {
      Alert.alert(
        "Galerie complète",
        GALLERY_MAX + " photos maximum — retirez-en une avant d'en ajouter une nouvelle.",
      );
      return;
    }
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(
        "Accès aux photos refusé",
        "Autorisez l'accès à vos photos pour ajouter une réalisation.",
      );
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.85,
    });
    if (result.canceled || result.assets.length === 0) return;

    setAddingPhoto(true);
    try {
      const asset = result.assets[0];
      await addGalleryPhoto(asset.uri, asset.mimeType);
    } catch {
      Alert.alert("Envoi impossible", "Réessayez.");
    } finally {
      setAddingPhoto(false);
    }
  };

  const removeGalleryPhoto = (photo: GalleryPhoto) =>
    Alert.alert("Retirer cette photo ?", undefined, [
      { text: "Annuler", style: "cancel" },
      {
        text: "Retirer",
        style: "destructive",
        onPress: async () => {
          setRemovingPhotoId(photo.id);
          try {
            await deleteGalleryPhoto(photo);
          } finally {
            setRemovingPhotoId(null);
          }
        },
      },
    ]);

  const save = async () => {
    // Postal code is optional (no required-field marker) but genuinely has
    // one correct shape (French postal codes are always 5 digits), so it's
    // still worth catching here. Phone deliberately ISN'T checked against
    // isValidPhoneForCountry here — that validates against formal
    // per-country numbering-plan assignment, which rejects real working
    // numbers it doesn't recognize (confirmed against a real one during
    // testing). Unlike signup (identity verification), this is just a
    // public contact number — joinPhone's own parse-or-fallback already
    // produces a reasonable E.164 shape either way, and the server only
    // checks that shape (see update-salon-profile.dto.ts).
    const next: typeof errors = {};
    if (draft.postalCode && !isValidPostalCodeFr(draft.postalCode))
      next.postalCode = "Code postal à 5 chiffres.";
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setSaving(true);
    try {
      await saveProfile(draft);
    } catch {
      Alert.alert("Enregistrement impossible", "Vérifiez vos informations et réessayez.");
    } finally {
      setSaving(false);
    }
  };

  const removeService = (service: ProService) =>
    Alert.alert(
      "Supprimer cette prestation ?",
      service.name + " ne sera plus réservable.",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Supprimer",
          style: "destructive",
          onPress: () => void deleteService(service.id),
        },
      ],
    );

  const toggleSpecialty = (id: SpecialtyId) =>
    patch({
      specialties: draft.specialties.includes(id)
        ? draft.specialties.filter((item) => item !== id)
        : [...draft.specialties, id],
    });

  return (
    <View style={{ flex: 1, backgroundColor: theme.background.dark }}>
      <ScrollView
        contentContainerStyle={{
          paddingBottom:
            Math.max(insets.bottom, spacing.md) +
            TAB_BAR_CLEARANCE +
            (dirty ? 72 : 0),
        }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Cover ────────────────────────────────────────────────────── */}
        <View style={{ height: 220 }}>
          <Image
            source={
              draft.coverUri
                ? { uri: draft.coverUri }
                : coverFor({ id: draft.salonId }, 900)
            }
            placeholder={coverPlaceholder(draft.salonId)}
            placeholderContentFit="cover"
            cachePolicy="memory-disk"
            style={{ flex: 1 }}
            contentFit="cover"
            transition={250}
          />
          <LinearGradient
            colors={["transparent", theme.background.dark]}
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: 0,
              height: 120,
            }}
          />

          <Pressable
            onPress={pickCover}
            accessibilityRole="button"
            accessibilityLabel="Changer la photo de vitrine"
            style={({ pressed }) => ({
              position: "absolute",
              top: insets.top + spacing.sm,
              right: gutter,
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.xs,
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.sm,
              borderRadius: radius.full,
              backgroundColor: theme.surface.glass,
              borderWidth: 1,
              borderColor: theme.border,
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <MaterialCommunityIcons
              name="camera-outline"
              size={16}
              color={theme.foreground.white}
            />
            <Text style={[typography.label, { color: theme.foreground.white }]}>
              Photo
            </Text>
          </Pressable>
        </View>

        <View
          style={{
            paddingHorizontal: gutter,
            gap: spacing.xl,
            marginTop: -spacing.xl,
          }}
        >
          {/* ── Presentation ───────────────────────────────────────────── */}
          <View style={{ gap: spacing.lg }}>
            <Text
              style={[typography.overline, { color: theme.foreground.gray }]}
            >
              PAGE DE PRÉSENTATION
            </Text>

            <TextField
              label="Nom du salon"
              value={draft.name}
              onChangeText={(name) => patch({ name })}
              autoCapitalize="words"
              icon="storefront-outline"
            />
            <TextField
              label="Accroche"
              value={draft.tagline}
              onChangeText={(tagline) => patch({ tagline })}
              placeholder="Coupe sur-mesure & couleur douce"
              autoCapitalize="sentences"
              maxLength={60}
              helper={draft.tagline.length + "/60 — visible sous le nom."}
            />
            <TextField
              label="Description"
              value={draft.description}
              onChangeText={(description) => patch({ description })}
              multiline
              maxLength={400}
              autoCapitalize="sentences"
              helper={draft.description.length + "/400 caractères."}
            />
            <PhoneField
              label="Téléphone"
              value={draft.phone}
              onChangeText={(phone) => patch({ phone })}
              country={draft.phoneCountry}
              onChangeCountry={(phoneCountry) => patch({ phoneCountry })}
            />
            <TextField
              label="Adresse"
              value={draft.addressLine}
              onChangeText={(addressLine) => patch({ addressLine })}
              autoCapitalize="words"
              icon="map-marker-outline"
            />
            <View style={{ flexDirection: "row", gap: spacing.md }}>
              <TextField
                label="Code postal"
                value={draft.postalCode}
                onChangeText={(postalCode) => {
                  patch({ postalCode: postalCode.replace(/\D/g, "") });
                  setErrors((e) => ({ ...e, postalCode: undefined }));
                }}
                keyboardType="number-pad"
                maxLength={5}
                error={errors.postalCode}
                style={{ flex: 1 }}
              />
              <CityField
                label="Ville"
                value={draft.city}
                onChangeText={(city) => patch({ city })}
                onPickCoords={({ latitude, longitude }) =>
                  patch({ latitude, longitude })
                }
                style={{ flex: 1.6 }}
              />
            </View>

            <View style={{ gap: spacing.sm }}>
              <Text
                style={[typography.label, { color: theme.foreground.gray }]}
              >
                Spécialités
              </Text>
              <View
                style={{
                  flexDirection: "row",
                  flexWrap: "wrap",
                  gap: spacing.sm,
                }}
              >
                {SPECIALTIES.map((specialty) => (
                  <Chip
                    key={specialty.id}
                    label={specialty.label}
                    selected={draft.specialties.includes(specialty.id)}
                    onPress={() => toggleSpecialty(specialty.id)}
                  />
                ))}
              </View>
            </View>
          </View>

          {/* ── Gallery ("Réalisations") ───────────────────────────────── */}
          <View style={{ gap: spacing.md }}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <Text
                style={[typography.overline, { color: theme.foreground.gray }]}
              >
                {"RÉALISATIONS (" + gallery.length + ")"}
              </Text>
              <Pressable
                onPress={pickGalleryPhoto}
                disabled={addingPhoto}
                accessibilityRole="button"
                accessibilityLabel="Ajouter une photo"
                hitSlop={8}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: spacing.xs,
                  opacity: addingPhoto ? 0.6 : 1,
                }}
              >
                {addingPhoto ? (
                  <ActivityIndicator size="small" color={theme.primary.main} />
                ) : (
                  <MaterialCommunityIcons
                    name="plus-circle"
                    size={18}
                    color={theme.primary.main}
                  />
                )}
                <Text style={[typography.label, { color: theme.primary.main }]}>
                  Ajouter
                </Text>
              </Pressable>
            </View>

            {gallery.length === 0 ? (
              <View
                style={{
                  padding: spacing.lg,
                  borderRadius: radius.xl,
                  borderWidth: 1,
                  borderStyle: "dashed",
                  borderColor: theme.border,
                }}
              >
                <Text
                  style={[
                    typography.bodySmall,
                    { color: theme.foreground.gray },
                  ]}
                >
                  Aucune photo. Montrez vos réalisations à vos futurs clients.
                </Text>
              </View>
            ) : (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: spacing.sm }}
              >
                {gallery.map((photo) => (
                  <View key={photo.id} style={{ width: 110, height: 140 }}>
                    <Image
                      source={{ uri: photo.url }}
                      cachePolicy="memory-disk"
                      style={{
                        flex: 1,
                        borderRadius: radius.lg,
                        backgroundColor: theme.surface.sunken,
                      }}
                      contentFit="cover"
                      transition={200}
                      onError={(e) =>
                        console.warn("Gallery photo failed to load", photo.url, e.error)
                      }
                    />
                    <Pressable
                      onPress={() => removeGalleryPhoto(photo)}
                      disabled={removingPhotoId === photo.id}
                      accessibilityRole="button"
                      accessibilityLabel="Retirer cette photo"
                      hitSlop={8}
                      style={{
                        position: "absolute",
                        top: spacing.xs,
                        right: spacing.xs,
                        width: 26,
                        height: 26,
                        borderRadius: radius.full,
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: theme.surface.glass,
                      }}
                    >
                      {removingPhotoId === photo.id ? (
                        <ActivityIndicator size="small" color={theme.foreground.white} />
                      ) : (
                        <MaterialCommunityIcons
                          name="close"
                          size={15}
                          color={theme.foreground.white}
                        />
                      )}
                    </Pressable>
                  </View>
                ))}
              </ScrollView>
            )}
          </View>

          {/* ── Services ───────────────────────────────────────────────── */}
          <View style={{ gap: spacing.md }}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <Text
                style={[typography.overline, { color: theme.foreground.gray }]}
              >
                {"PRESTATIONS (" + services.length + ")"}
              </Text>
              <Pressable
                onPress={() =>
                  setEditing({
                    id: newServiceId(),
                    name: "",
                    price: 40,
                    durationMin: 45,
                    specialty: draft.specialties[0] ?? "coupe",
                  })
                }
                accessibilityRole="button"
                accessibilityLabel="Ajouter une prestation"
                hitSlop={8}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: spacing.xs,
                }}
              >
                <MaterialCommunityIcons
                  name="plus-circle"
                  size={18}
                  color={theme.primary.main}
                />
                <Text style={[typography.label, { color: theme.primary.main }]}>
                  Ajouter
                </Text>
              </Pressable>
            </View>

            {services.length === 0 ? (
              <View
                style={{
                  padding: spacing.lg,
                  borderRadius: radius.xl,
                  borderWidth: 1,
                  borderStyle: "dashed",
                  borderColor: theme.border,
                }}
              >
                <Text
                  style={[
                    typography.bodySmall,
                    { color: theme.foreground.gray },
                  ]}
                >
                  Aucune prestation. Ajoutez-en une pour être réservable.
                </Text>
              </View>
            ) : (
              services.map((service) => (
                <View
                  key={service.id}
                  style={[
                    {
                      flexDirection: "row",
                      alignItems: "center",
                      gap: spacing.md,
                      padding: spacing.lg,
                      borderRadius: radius.xl,
                      backgroundColor: theme.surface.raised,
                      borderWidth: 1,
                      borderColor: theme.divider,
                    },
                    elevation(1, theme.shadow),
                  ]}
                >
                  <View style={{ flex: 1, gap: 3 }}>
                    <Text
                      style={[
                        typography.bodyMedium,
                        { color: theme.foreground.white },
                      ]}
                      numberOfLines={1}
                    >
                      {service.name}
                    </Text>
                    <Text
                      style={[
                        typography.caption,
                        { color: theme.foreground.gray },
                      ]}
                    >
                      {formatDuration(service.durationMin) +
                        " · " +
                        specialtyLabel(service.specialty)}
                    </Text>
                  </View>

                  <Text style={[typography.h2, { color: theme.accent.warm }]}>
                    {formatPrice(service.price)}
                  </Text>

                  <Pressable
                    onPress={() => setEditing(service)}
                    accessibilityRole="button"
                    accessibilityLabel={"Modifier " + service.name}
                    hitSlop={6}
                  >
                    <MaterialCommunityIcons
                      name="pencil-outline"
                      size={19}
                      color={theme.foreground.gray}
                    />
                  </Pressable>
                  <Pressable
                    onPress={() => removeService(service)}
                    accessibilityRole="button"
                    accessibilityLabel={"Supprimer " + service.name}
                    hitSlop={6}
                  >
                    <MaterialCommunityIcons
                      name="trash-can-outline"
                      size={19}
                      color={theme.danger}
                    />
                  </Pressable>
                </View>
              ))
            )}
          </View>

          {/* ── Hours summary ──────────────────────────────────────────── */}
          <View style={{ gap: spacing.md }}>
            <Group title="Horaires">
              {[1, 2, 3, 4, 5, 6, 0].map((weekday, index) => {
                const day = availability.find(
                  (item) => item.weekday === weekday,
                );
                const label = [
                  "Dimanche",
                  "Lundi",
                  "Mardi",
                  "Mercredi",
                  "Jeudi",
                  "Vendredi",
                  "Samedi",
                ][weekday];
                const isOpen = Boolean(day?.open);
                return (
                  <RowShell
                    key={weekday}
                    icon="clock-outline"
                    label={label}
                    value={
                      isOpen && day
                        ? minutesToTime(day.opens) +
                          " – " +
                          minutesToTime(day.closes)
                        : "Fermé"
                    }
                    valueColor={
                      isOpen ? theme.foreground.white : theme.foreground.gray
                    }
                    isLast={index === 6}
                  />
                );
              })}
            </Group>
            <Text
              style={[typography.caption, { color: theme.foreground.gray }]}
            >
              Les horaires se modifient depuis l&apos;onglet Agenda.
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* ── Save bar ───────────────────────────────────────────────────── */}
      {dirty ? (
        <View
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom:
              Math.max(insets.bottom, spacing.md) + TAB_BAR_CLEARANCE - 12,
            paddingHorizontal: gutter,
          }}
        >
          <Button
            label="Enregistrer les modifications"
            onPress={save}
            loading={saving}
            background={theme.primary.main}
            color={theme.primary.on}
          />
        </View>
      ) : null}

      {/* ── Service editor ─────────────────────────────────────────────── */}
      <ServiceEditor
        service={editing}
        onClose={() => setEditing(null)}
        onSave={async (service) => {
          await saveService(service);
          setEditing(null);
        }}
      />
    </View>
  );
}

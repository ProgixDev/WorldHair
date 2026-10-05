import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { radius, spacing } from "../../constants/spacing";
import { typography } from "../../constants/typography";
import { useTheme } from "../../contexts/ThemeContext";
import { defaultPick, staffLabel } from "../../features/pro/staffPick";
import type { StaffCandidate } from "../../features/pro/types";
import { listStaffCandidates, proErrorMessage } from "../../services/pro";

/**
 * « Qui s'en occupe ? » (TODO.md Phase 3): the salon's team for one booking,
 * as the server sees it at that time — only the people free then can be
 * picked. Opens on the person the booking has when they're still free.
 */
export function StaffPicker({
  appointmentId,
  selected,
  onSelect,
}: {
  appointmentId: string;
  selected: string | null;
  onSelect: (staffId: string | null) => void;
}) {
  const { theme } = useTheme();
  const [candidates, setCandidates] = useState<StaffCandidate[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let current = true;
    setCandidates(null);
    setError(null);
    listStaffCandidates(appointmentId)
      .then((list) => {
        if (!current) return;
        setCandidates(list);
        onSelect(defaultPick(list));
      })
      .catch((err) => current && setError(proErrorMessage(err)));
    return () => {
      current = false;
    };
    // `onSelect` is the parent's setter: the list loads once per booking.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appointmentId]);

  if (error) {
    return <Text style={[typography.bodySmall, { color: theme.danger }]}>{error}</Text>;
  }
  if (!candidates) {
    return <ActivityIndicator color={theme.primary.main} />;
  }

  return (
    <View style={{ gap: spacing.sm }}>
      {candidates.map((candidate) => {
        const isSelected = candidate.staffId === selected;
        return (
          <Pressable
            key={candidate.staffId}
            onPress={() => candidate.free && onSelect(candidate.staffId)}
            disabled={!candidate.free}
            accessibilityRole="radio"
            accessibilityState={{ selected: isSelected, disabled: !candidate.free }}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.md,
              padding: spacing.md,
              borderRadius: radius.lg,
              borderWidth: 1.5,
              borderColor: isSelected ? theme.primary.main : theme.divider,
              backgroundColor: theme.surface.base,
              opacity: candidate.free ? 1 : 0.5,
            }}
          >
            <MaterialCommunityIcons
              name={isSelected ? "radiobox-marked" : "radiobox-blank"}
              size={22}
              color={isSelected ? theme.primary.main : theme.foreground.gray}
            />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[typography.label, { color: theme.foreground.white }]}>{staffLabel(candidate)}</Text>
              <Text style={[typography.caption, { color: theme.foreground.gray }]}>
                {!candidate.free
                  ? "Pas disponible à cette heure"
                  : candidate.held
                    ? "Prévu pour ce rendez-vous"
                    : "Disponible"}
              </Text>
            </View>
          </Pressable>
        );
      })}
      {candidates.every((candidate) => !candidate.free) ? (
        <Text style={[typography.bodySmall, { color: theme.danger }]}>
          Personne n&apos;est disponible à cette heure : déplacez le rendez-vous ou refusez la demande.
        </Text>
      ) : null}
    </View>
  );
}

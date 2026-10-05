import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ClosuresSheet } from "../../components/pro/ClosuresSheet";
import { InviteSheet, shareInvite } from "../../components/pro/team/InviteSheet";
import { MemberAvatar } from "../../components/pro/team/MemberAvatar";
import { MemberSheet } from "../../components/pro/team/MemberSheet";
import { Button } from "../../components/ui/Button";
import { elevation, TAB_BAR_CLEARANCE } from "../../constants/elevation";
import { useResponsive } from "../../constants/responsive";
import { radius, spacing } from "../../constants/spacing";
import { typography } from "../../constants/typography";
import { usePro } from "../../contexts/ProContext";
import { useTheme } from "../../contexts/ThemeContext";
import { inviteValidity, memberName, weekSummary } from "../../features/pro/team";
import { inviteBlockedMessage, inviteRefusal, teamUsageLabel } from "../../features/pro/tiers";
import type { SalonInvite, StaffMember } from "../../features/pro/types";
import { createInvite, listInvites, proErrorMessage, revokeInvite } from "../../services/pro";

/**
 * One sheet slides away before the next comes up: two RN Modals presented
 * at once don't stack reliably on iOS. Just past BottomSheet's close (220 ms).
 */
const SHEET_SWAP_MS = 300;

/**
 * « Équipe » (TODO.md Phase 3): the salon's people, the owner first. The
 * owner invites a coiffeur with a one-use code (their only way in), and
 * sets each person's bookings, week and congés from their sheet. Clients
 * never choose: their bookings go to whoever is free.
 */
export default function ProTeamScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { gutter } = useResponsive();
  const { profile, team, subscription, isLoading, refreshTeam, refreshSubscription } = usePro();

  /** `null` while the first read is on its way. */
  const [invites, setInvites] = useState<SalonInvite[] | null>(null);
  const [invitesError, setInvitesError] = useState<string | null>(null);
  const [teamError, setTeamError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [shownInvite, setShownInvite] = useState<SalonInvite | null>(null);
  const [inviteVisible, setInviteVisible] = useState(false);

  const [selected, setSelected] = useState<StaffMember | null>(null);
  const [memberVisible, setMemberVisible] = useState(false);
  const [closuresVisible, setClosuresVisible] = useState(false);
  const swapTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(swapTimer.current), []);

  // The sheet follows the live team, so a switch or a saved week shows at
  // once; the last copy stays on screen while it closes after a removal.
  const liveMember = useMemo(
    () => (selected ? (team.find((person) => person.id === selected.id) ?? selected) : null),
    [team, selected],
  );

  // The formula sets how many people the salon holds, owner included; each
  // code still open keeps a place for whoever it will let in. The server
  // decides in the end (a 409 `TEAM_FULL`), this only spares a refused tap.
  const tier = subscription?.tier ?? "solo";
  const space = { limit: subscription?.teamLimit ?? 1, members: team.length, openInvites: invites?.length ?? 0 };
  const inviteBlocked = inviteBlockedMessage({ ...space, tier });

  const loadInvites = useCallback(async () => {
    try {
      setInvites(await listInvites());
      setInvitesError(null);
    } catch (err) {
      setInvitesError(proErrorMessage(err, "Les codes n'ont pas pu être chargés. Tirez vers le bas pour réessayer."));
    }
  }, []);

  // The formula too: the owner may have changed it on the website since the
  // last visit. A stale one is no reason to fail, hence the catch.
  const reloadTeam = useCallback(
    () =>
      Promise.all([refreshTeam(), refreshSubscription().catch(() => undefined)]).then(
        () => setTeamError(null),
        () => setTeamError("L'équipe n'a pas pu être actualisée. Vérifiez votre connexion."),
      ),
    [refreshTeam, refreshSubscription],
  );

  // Someone may have joined, or a code been used, since the last visit. A
  // ref, as `refreshTeam` is a new function on each change of the pro data.
  const reloadTeamRef = useRef(reloadTeam);
  useEffect(() => {
    reloadTeamRef.current = reloadTeam;
  }, [reloadTeam]);
  useFocusEffect(
    useCallback(() => {
      void loadInvites();
      void reloadTeamRef.current();
    }, [loadInvites]),
  );

  const refresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([reloadTeam(), loadInvites()]);
    } finally {
      setRefreshing(false);
    }
  };

  const invite = async () => {
    setCreating(true);
    setCreateError(null);
    try {
      const created = await createInvite();
      setInvites((current) => [created, ...(current ?? []).filter((item) => item.code !== created.code)]);
      setShownInvite(created);
      setInviteVisible(true);
    } catch (err) {
      // Refused for want of a place although the screen showed one: say so,
      // and read the team, the codes and the formula again.
      const refusal = inviteRefusal(err, tier);
      setCreateError(refusal ?? proErrorMessage(err, "Le code n'a pas pu être créé. Réessayez."));
      if (refusal) void Promise.all([reloadTeam(), loadInvites()]);
    } finally {
      setCreating(false);
    }
  };

  const revoke = async (code: string) => {
    setRevoking(code);
    try {
      setInvites(await revokeInvite(code));
      if (shownInvite?.code === code) setInviteVisible(false);
    } catch (err) {
      Alert.alert("Action impossible", proErrorMessage(err));
    } finally {
      setRevoking(null);
    }
  };

  const confirmRevoke = (item: SalonInvite) =>
    Alert.alert("Annuler ce code ?", item.code + " ne permettra plus de rejoindre votre salon.", [
      { text: "Garder", style: "cancel" },
      { text: "Annuler le code", style: "destructive", onPress: () => void revoke(item.code) },
    ]);

  const openMember = (person: StaffMember) => {
    setSelected(person);
    setMemberVisible(true);
  };

  const swapSheets = (next: () => void) => {
    clearTimeout(swapTimer.current);
    swapTimer.current = setTimeout(next, SHEET_SWAP_MS);
  };

  const openClosures = () => {
    setMemberVisible(false);
    swapSheets(() => setClosuresVisible(true));
  };

  // Back to the person's sheet, where « Congés » was opened from.
  const closeClosures = () => {
    setClosuresVisible(false);
    swapSheets(() => setMemberVisible(true));
  };

  const salonName = profile?.name ?? "";
  const nobodyBookable = team.length > 0 && !team.some((person) => person.takesBookings);

  return (
    <View style={{ flex: 1, backgroundColor: theme.background.dark }}>
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: gutter,
          paddingTop: insets.top + spacing.md,
          paddingBottom: Math.max(insets.bottom, spacing.md) + TAB_BAR_CLEARANCE,
          gap: spacing.xl,
        }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void refresh()}
            tintColor={theme.primary.main}
            colors={[theme.primary.main]}
            progressViewOffset={insets.top}
          />
        }
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
          <Pressable
            onPress={() => router.navigate("/pro/account" as never)}
            accessibilityRole="button"
            accessibilityLabel="Retour"
            hitSlop={8}
          >
            <MaterialCommunityIcons name="chevron-left" size={26} color={theme.foreground.white} />
          </Pressable>
          <Text style={[typography.display, { color: theme.foreground.white }]} accessibilityRole="header">
            Équipe
          </Text>
        </View>

        {isLoading ? (
          <ActivityIndicator color={theme.primary.main} />
        ) : (
          <>
            {/* ── Members ──────────────────────────────────────────────── */}
            <View style={{ gap: spacing.md }}>
              <Text style={[typography.overline, { color: theme.foreground.gray }]}>
                {team.length > 1 ? team.length + " PERSONNES" : "VOTRE ÉQUIPE"}
              </Text>

              {nobodyBookable ? (
                <View
                  style={{
                    flexDirection: "row",
                    gap: spacing.sm,
                    padding: spacing.md,
                    borderRadius: radius.lg,
                    backgroundColor: theme.accent.warmSoft,
                  }}
                >
                  <MaterialCommunityIcons name="alert-circle-outline" size={18} color={theme.accent.warm} />
                  <Text style={[typography.bodySmall, { color: theme.foreground.white, flex: 1 }]}>
                    Personne ne prend de rendez-vous : vos clients ne peuvent pas réserver. Activez « Prend des
                    rendez-vous » pour au moins une personne.
                  </Text>
                </View>
              ) : null}

              {team.length > 0 ? (
                <View
                  style={[
                    {
                      borderRadius: radius.xl,
                      borderWidth: 1,
                      borderColor: theme.divider,
                      overflow: "hidden",
                    },
                    elevation(1, theme.shadow),
                  ]}
                >
                  {team.map((person, index) => (
                    <MemberRow
                      key={person.id}
                      member={person}
                      isLast={index === team.length - 1}
                      onPress={() => openMember(person)}
                    />
                  ))}
                </View>
              ) : null}

              {teamError ? (
                <Text style={[typography.caption, { color: theme.danger }]}>{teamError}</Text>
              ) : null}

              {team.length <= 1 && !inviteBlocked ? (
                <View
                  style={{
                    padding: spacing.lg,
                    borderRadius: radius.xl,
                    borderWidth: 1,
                    borderStyle: "dashed",
                    borderColor: theme.border,
                    gap: spacing.sm,
                  }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
                    <MaterialCommunityIcons name="account-group-outline" size={22} color={theme.primary.main} />
                    <Text style={[typography.h2, { color: theme.foreground.white, flex: 1 }]}>
                      Travaillez à plusieurs
                    </Text>
                  </View>
                  <Text style={[typography.bodySmall, { color: theme.foreground.gray }]}>
                    Invitez les coiffeurs de votre salon : les réservations de vos clients se répartissent entre
                    vous selon qui est libre, et chacun a son propre agenda, ses horaires et ses congés.
                  </Text>
                </View>
              ) : null}
            </View>

            {/* ── Invite ───────────────────────────────────────────────── */}
            <View style={{ gap: spacing.sm }}>
              <Text style={[typography.label, { color: theme.foreground.white, textAlign: "center" }]}>
                {teamUsageLabel(space)}
              </Text>
              {inviteBlocked ? (
                <View
                  style={{
                    flexDirection: "row",
                    gap: spacing.sm,
                    padding: spacing.md,
                    borderRadius: radius.lg,
                    backgroundColor: theme.surface.raised,
                    borderWidth: 1,
                    borderColor: theme.divider,
                  }}
                >
                  <MaterialCommunityIcons name="information-outline" size={18} color={theme.foreground.gray} />
                  <Text style={[typography.bodySmall, { color: theme.foreground.white, flex: 1 }]}>
                    {inviteBlocked}
                  </Text>
                </View>
              ) : (
                <>
                  <Button
                    label="Inviter un coiffeur"
                    icon="account-plus-outline"
                    onPress={() => void invite()}
                    loading={creating}
                    background={theme.primary.main}
                    color={theme.primary.on}
                  />
                  <Text style={[typography.caption, { color: theme.foreground.gray, textAlign: "center" }]}>
                    Un code à lui envoyer, valable 7 jours et une seule fois.
                  </Text>
                </>
              )}
              {/* Once the screen knows it's full, its own explanation says it all. */}
              {createError && !inviteBlocked ? (
                <Text style={[typography.caption, { color: theme.danger, textAlign: "center" }]}>{createError}</Text>
              ) : null}
            </View>

            {/* ── Codes still usable ───────────────────────────────────── */}
            <View style={{ gap: spacing.md }}>
              <Text style={[typography.overline, { color: theme.foreground.gray }]}>CODES EN COURS</Text>
              {invitesError ? (
                <Text style={[typography.bodySmall, { color: theme.danger }]}>{invitesError}</Text>
              ) : invites === null ? (
                <ActivityIndicator color={theme.primary.main} />
              ) : invites.length === 0 ? (
                <Text style={[typography.bodySmall, { color: theme.foreground.gray }]}>
                  Aucun code en cours. Un code utilisé ou expiré disparaît d&apos;ici.
                </Text>
              ) : (
                invites.map((item) => (
                  <InviteRow
                    key={item.code}
                    invite={item}
                    revoking={revoking === item.code}
                    onShow={() => {
                      setShownInvite(item);
                      setInviteVisible(true);
                    }}
                    onShare={() => void shareInvite(salonName, item)}
                    onRevoke={() => confirmRevoke(item)}
                  />
                ))
              )}
            </View>
          </>
        )}
      </ScrollView>

      <MemberSheet
        member={liveMember}
        visible={memberVisible}
        onClose={() => setMemberVisible(false)}
        onOpenClosures={openClosures}
      />

      <ClosuresSheet
        visible={closuresVisible}
        onClose={closeClosures}
        staffId={liveMember?.id}
        personName={liveMember ? memberName(liveMember) : undefined}
      />

      <InviteSheet
        invite={shownInvite}
        salonName={salonName}
        visible={inviteVisible}
        onClose={() => setInviteVisible(false)}
      />
    </View>
  );
}

/** A person of the team: who they are, their week in a few words, and whether clients can book them. */
function MemberRow({ member, isLast, onPress }: { member: StaffMember; isLast: boolean; onPress: () => void }) {
  const { theme } = useTheme();
  const name = memberName(member);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={name + (member.isOwner ? ", vous" : "") + ". Horaires, congés et rendez-vous."}
    >
      {({ pressed }) => (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.md,
            paddingHorizontal: spacing.lg,
            paddingVertical: spacing.md,
            minHeight: 72,
            borderBottomWidth: isLast ? 0 : 1,
            borderColor: theme.divider,
            backgroundColor: pressed ? theme.surface.raised : theme.surface.base,
          }}
        >
          <MemberAvatar member={member} />
          <View style={{ flex: 1, gap: 2 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
              <Text style={[typography.bodyMedium, { color: theme.foreground.white, flexShrink: 1 }]} numberOfLines={1}>
                {name}
              </Text>
              {member.isOwner ? (
                <View
                  style={{
                    paddingHorizontal: spacing.sm,
                    paddingVertical: 2,
                    borderRadius: radius.full,
                    backgroundColor: theme.primary.soft,
                  }}
                >
                  <Text style={[typography.caption, { color: theme.primary.main, fontSize: 10 }]}>
                    Vous · propriétaire
                  </Text>
                </View>
              ) : null}
            </View>
            <Text style={[typography.caption, { color: theme.foreground.gray }]} numberOfLines={1}>
              {weekSummary(member.availability)}
            </Text>
            {member.takesBookings ? null : (
              <Text style={[typography.caption, { color: theme.accent.warm }]}>Ne prend pas de rendez-vous</Text>
            )}
          </View>
          <MaterialCommunityIcons name="chevron-right" size={18} color={theme.foreground.gray} />
        </View>
      )}
    </Pressable>
  );
}

/** A code not used yet: tap to show it big again, share it, or cancel it. */
function InviteRow({
  invite,
  revoking,
  onShow,
  onShare,
  onRevoke,
}: {
  invite: SalonInvite;
  revoking: boolean;
  onShow: () => void;
  onShare: () => void;
  onRevoke: () => void;
}) {
  const { theme } = useTheme();

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
        padding: spacing.md,
        paddingLeft: spacing.lg,
        borderRadius: radius.lg,
        backgroundColor: theme.surface.raised,
        borderWidth: 1,
        borderColor: theme.divider,
      }}
    >
      <Pressable
        onPress={onShow}
        accessibilityRole="button"
        accessibilityLabel={"Afficher le code " + invite.code.split("").join(" ")}
        style={{ flex: 1, gap: 2 }}
      >
        <Text style={[typography.h2, { color: theme.foreground.white, letterSpacing: 3 }]}>{invite.code}</Text>
        <Text style={[typography.caption, { color: theme.foreground.gray }]}>{inviteValidity(invite.expiresAt)}</Text>
      </Pressable>
      <Pressable
        onPress={onShare}
        accessibilityRole="button"
        accessibilityLabel={"Partager le code " + invite.code}
        hitSlop={8}
      >
        <MaterialCommunityIcons name="share-variant-outline" size={20} color={theme.primary.main} />
      </Pressable>
      {revoking ? (
        <ActivityIndicator color={theme.danger} />
      ) : (
        <Pressable
          onPress={onRevoke}
          accessibilityRole="button"
          accessibilityLabel={"Annuler le code " + invite.code}
          hitSlop={8}
        >
          <Text style={[typography.label, { color: theme.danger }]}>Annuler</Text>
        </Pressable>
      )}
    </View>
  );
}

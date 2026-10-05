import { isAxiosError } from "axios";
import type { SubscriptionTier } from "./types";

/**
 * The two formulas a salon subscribes to (TODO.md Phase 3): « Solo », the
 * owner alone, and « Équipe », five people in all, owner included. They're
 * sold on the website only — App Store rule: the app states what the salon
 * has and what it allows, never a button or a link to buy. Pure, so it's
 * tested without a screen.
 */

export function tierLabel(tier: SubscriptionTier): string {
  return tier === "team" ? "Équipe" : "Solo";
}

export interface TeamSpace {
  /** People the formula allows, the owner included. */
  limit: number;
  members: number;
  /** Codes made and not used yet: each holds a place. */
  openInvites: number;
}

/** Places left for an invite; `over`: the team is bigger than the formula (a downgrade kept everyone). */
export function teamPlaces({ limit, members, openInvites }: TeamSpace): { free: number; over: boolean } {
  return { free: Math.max(0, limit - members - openInvites), over: members > limit };
}

/** "2 personnes sur 5 · 1 code en cours", or « Vous seul » for a salon of one on Solo. */
export function teamUsageLabel({ limit, members, openInvites }: TeamSpace): string {
  const people =
    members <= 1 && limit <= 1
      ? "Vous seul"
      : // "3 sur 1" would read as a mistake: past the limit, just the headcount.
        members > limit
        ? members + " personnes"
        : members + (members > 1 ? " personnes" : " personne") + " sur " + limit;
  return openInvites > 0 ? people + " · " + openInvites + (openInvites > 1 ? " codes" : " code") + " en cours" : people;
}

/** Why « Inviter un coiffeur » is replaced by a sentence; `null` while a place is free. */
export function inviteBlockedMessage(space: TeamSpace & { tier: SubscriptionTier }): string | null {
  const { free, over } = teamPlaces(space);
  if (over) return "Votre formule ne couvre plus toute l'équipe : personne ne peut être ajouté.";
  if (free > 0) return null;
  if (space.tier === "solo") {
    return "Votre formule Solo est pour une seule personne. Inviter vos collaborateurs demande la formule Équipe.";
  }
  if (space.members >= space.limit) return "Votre équipe est au complet (" + space.limit + " personnes).";
  // Not full of people: the codes still open hold what's left.
  return "Les places restantes sont réservées par des codes en cours. Annulez-en un pour inviter quelqu'un d'autre.";
}

/**
 * The server refused a code (409 TEAM_FULL) although the screen showed a
 * place — someone joined, or the formula dropped, meanwhile. `null` for any
 * other failure (the generic message then).
 */
export function inviteRefusal(err: unknown, tier: SubscriptionTier): string | null {
  if (!isAxiosError(err) || err.response?.status !== 409) return null;
  const body = err.response.data as { message?: unknown } | undefined;
  const message = typeof body?.message === "string" ? body.message : "";
  if (!message.startsWith("TEAM_FULL")) return null;
  return tier === "solo"
    ? "Votre formule Solo est pour une seule personne. Inviter vos collaborateurs demande la formule Équipe : changez de formule, puis réessayez."
    : "Votre équipe est au complet. Retirez quelqu'un ou annulez un code en cours pour faire de la place.";
}

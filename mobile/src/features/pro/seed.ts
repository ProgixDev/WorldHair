import { getSalonById } from "../salons/data";
import type { ProAppointment, ProService, Subscription } from "./types";

/**
 * Demo data for the coiffeur area. The pro account is attached to a catalogue
 * salon so its photos, rating and client reviews are the same ones a
 * particulier sees. Everything below is derived from fixed tables — no
 * randomness, so the dashboard numbers stay put between launches.
 */

export const DEMO_PRO_SALON_ID = "studio-w";

const CLIENTS: { id: string; name: string; isNew: boolean }[] = [
  { id: "c1", name: "Camille Durand", isNew: false },
  { id: "c2", name: "Inès Bouchard", isNew: false },
  { id: "c3", name: "Thomas Lefèvre", isNew: true },
  { id: "c4", name: "Fatou Sarr", isNew: false },
  { id: "c5", name: "Lina Mercier", isNew: false },
  { id: "c6", name: "Malik Rahmani", isNew: true },
  { id: "c7", name: "Élodie Vidal", isNew: false },
  { id: "c8", name: "Sarah Kessler", isNew: false },
  { id: "c9", name: "Manon Girard", isNew: true },
  { id: "c10", name: "Antoine Fournier", isNew: false },
  { id: "c11", name: "Yasmine Ouali", isNew: false },
  { id: "c12", name: "Paul Étienne", isNew: true },
  { id: "c13", name: "Chloé Nguyen", isNew: false },
  { id: "c14", name: "Rachid Belkacem", isNew: false },
];

const NOTES = [
  "Je voudrais garder la longueur, juste rafraîchir.",
  "Idéalement en fin de journée si possible.",
  "Première fois chez vous, on m'a beaucoup recommandé le salon.",
  "Même chose que la dernière fois.",
  "J'ai un événement le lendemain, je compte sur vous !",
];

/** dayOffset is relative to today; hour/minute set the start. */
interface Slot {
  client: number;
  serviceIndex: number;
  dayOffset: number;
  hour: number;
  minute: number;
  status: ProAppointment["status"];
  note?: number;
}

const SLOTS: Slot[] = [
  // ── Pending requests, waiting for a decision ─────────────────────────
  {
    client: 2,
    serviceIndex: 0,
    dayOffset: 1,
    hour: 11,
    minute: 0,
    status: "pending",
    note: 2,
  },
  {
    client: 5,
    serviceIndex: 1,
    dayOffset: 2,
    hour: 16,
    minute: 30,
    status: "pending",
    note: 1,
  },
  {
    client: 8,
    serviceIndex: 2,
    dayOffset: 4,
    hour: 10,
    minute: 0,
    status: "pending",
    note: 0,
  },
  {
    client: 11,
    serviceIndex: 0,
    dayOffset: 6,
    hour: 14,
    minute: 0,
    status: "pending",
    note: 4,
  },

  // ── Confirmed, upcoming ──────────────────────────────────────────────
  {
    client: 0,
    serviceIndex: 0,
    dayOffset: 0,
    hour: 10,
    minute: 0,
    status: "confirmed",
  },
  {
    client: 1,
    serviceIndex: 1,
    dayOffset: 0,
    hour: 12,
    minute: 30,
    status: "confirmed",
  },
  {
    client: 3,
    serviceIndex: 2,
    dayOffset: 0,
    hour: 16,
    minute: 0,
    status: "confirmed",
    note: 3,
  },
  {
    client: 4,
    serviceIndex: 0,
    dayOffset: 1,
    hour: 9,
    minute: 30,
    status: "confirmed",
  },
  {
    client: 6,
    serviceIndex: 1,
    dayOffset: 1,
    hour: 14,
    minute: 30,
    status: "confirmed",
  },
  {
    client: 7,
    serviceIndex: 0,
    dayOffset: 3,
    hour: 11,
    minute: 30,
    status: "confirmed",
  },
  {
    client: 9,
    serviceIndex: 2,
    dayOffset: 5,
    hour: 15,
    minute: 0,
    status: "confirmed",
  },
  {
    client: 12,
    serviceIndex: 1,
    dayOffset: 8,
    hour: 10,
    minute: 30,
    status: "confirmed",
  },
  {
    client: 13,
    serviceIndex: 0,
    dayOffset: 12,
    hour: 17,
    minute: 0,
    status: "confirmed",
  },

  // ── History ──────────────────────────────────────────────────────────
  {
    client: 0,
    serviceIndex: 1,
    dayOffset: -5,
    hour: 10,
    minute: 0,
    status: "done",
  },
  {
    client: 4,
    serviceIndex: 0,
    dayOffset: -6,
    hour: 15,
    minute: 30,
    status: "done",
  },
  {
    client: 2,
    serviceIndex: 2,
    dayOffset: -8,
    hour: 9,
    minute: 30,
    status: "cancelled",
  },
  {
    client: 7,
    serviceIndex: 0,
    dayOffset: -9,
    hour: 13,
    minute: 0,
    status: "done",
  },
  {
    client: 10,
    serviceIndex: 1,
    dayOffset: -11,
    hour: 11,
    minute: 0,
    status: "done",
  },
  {
    client: 5,
    serviceIndex: 0,
    dayOffset: -13,
    hour: 16,
    minute: 30,
    status: "done",
  },
  {
    client: 1,
    serviceIndex: 2,
    dayOffset: -15,
    hour: 14,
    minute: 0,
    status: "done",
  },
  {
    client: 9,
    serviceIndex: 0,
    dayOffset: -17,
    hour: 10,
    minute: 30,
    status: "refused",
  },
  {
    client: 3,
    serviceIndex: 1,
    dayOffset: -19,
    hour: 12,
    minute: 0,
    status: "done",
  },
  {
    client: 13,
    serviceIndex: 0,
    dayOffset: -21,
    hour: 17,
    minute: 30,
    status: "done",
  },
  {
    client: 6,
    serviceIndex: 2,
    dayOffset: -24,
    hour: 9,
    minute: 0,
    status: "done",
  },
  {
    client: 8,
    serviceIndex: 1,
    dayOffset: -26,
    hour: 15,
    minute: 0,
    status: "done",
  },
  {
    client: 11,
    serviceIndex: 0,
    dayOffset: -29,
    hour: 11,
    minute: 30,
    status: "done",
  },
  {
    client: 12,
    serviceIndex: 2,
    dayOffset: -33,
    hour: 16,
    minute: 0,
    status: "done",
  },
  {
    client: 0,
    serviceIndex: 0,
    dayOffset: -37,
    hour: 10,
    minute: 0,
    status: "done",
  },
  {
    client: 10,
    serviceIndex: 1,
    dayOffset: -41,
    hour: 14,
    minute: 30,
    status: "done",
  },
  {
    client: 4,
    serviceIndex: 2,
    dayOffset: -45,
    hour: 9,
    minute: 30,
    status: "done",
  },
  {
    client: 7,
    serviceIndex: 0,
    dayOffset: -52,
    hour: 13,
    minute: 30,
    status: "done",
  },
];

export function seedProServices(): ProService[] {
  return (
    getSalonById(DEMO_PRO_SALON_ID)?.services.map((service) => ({
      ...service,
    })) ?? []
  );
}

export function seedAppointments(services: ProService[]): ProAppointment[] {
  if (services.length === 0) return [];

  return SLOTS.map((slot, index) => {
    const client = CLIENTS[slot.client % CLIENTS.length];
    const service = services[slot.serviceIndex % services.length];
    const startsAt = new Date();
    startsAt.setDate(startsAt.getDate() + slot.dayOffset);
    startsAt.setHours(slot.hour, slot.minute, 0, 0);

    return {
      id: "pro_apt_" + index,
      serviceId: service.id,
      clientName: client.name,
      clientId: client.id,
      startsAt: startsAt.toISOString(),
      durationMin: service.durationMin,
      price: service.price,
      status: slot.status,
      note: slot.note !== undefined ? NOTES[slot.note] : undefined,
      isNewClient: client.isNew,
    };
  });
}

export function seedSubscription(): Subscription {
  const trialEndsAt = new Date();
  trialEndsAt.setDate(trialEndsAt.getDate() + 30);
  const renewsAt = new Date(trialEndsAt);

  return {
    plan: "monthly",
    status: "trial",
    trialEndsAt: trialEndsAt.toISOString(),
    renewsAt: renewsAt.toISOString(),
  };
}

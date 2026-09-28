import type { SupabaseClient } from "@supabase/supabase-js";
import { parisParts, parisTime } from "../../src/common/utils/paris-time";

/**
 * Real reviews for seeded salons. A salon's stars are computed from its
 * non-hidden reviews (refresh_salon_rating() in schema.sql), so demo salons
 * only look reviewed if they have actual review rows — each one on a real,
 * already-past appointment, exactly like a review left through the app.
 *
 * The authors are six seeded client accounts (`client.<name>@worldhair.app`,
 * same password as every demo account), separate from demo.particulier so
 * that account keeps its own past appointments free to review by hand.
 */

const PASSWORD = "Demo1234!";

const REVIEWERS = [
  { email: "client.camille@worldhair.app", firstName: "Camille", lastName: "Durand" },
  { email: "client.lea@worldhair.app", firstName: "Léa", lastName: "Martin" },
  { email: "client.ines@worldhair.app", firstName: "Inès", lastName: "Haddad" },
  { email: "client.thomas@worldhair.app", firstName: "Thomas", lastName: "Petit" },
  { email: "client.aicha@worldhair.app", firstName: "Aïcha", lastName: "Traoré" },
  { email: "client.julien@worldhair.app", firstName: "Julien", lastName: "Moreau" },
];

/** Tags must stay within REVIEW_TAGS (src/reviews/dto/create-review.dto.ts). */
const FIVE_STAR = [
  { comment: "Super accueil et résultat au top, je reviendrai sans hésiter.", tags: ["Résultat", "Ambiance"] },
  { comment: "Très à l'écoute, elle a pris le temps de comprendre ce que je voulais.", tags: ["Écoute", "Conseils"] },
  { comment: "Salon propre, rendez-vous à l'heure et une coupe parfaite.", tags: ["Ponctualité", "Propreté", "Résultat"] },
  { comment: "Excellents conseils pour l'entretien à la maison. Merci !", tags: ["Conseils"] },
  { comment: "Rapport qualité-prix imbattable dans le quartier.", tags: ["Rapport qualité-prix"] },
];

const FOUR_STAR = [
  { comment: "Bon résultat, un peu d'attente à l'arrivée.", tags: ["Résultat"] },
  { comment: "Contente de ma couleur, l'ambiance est agréable.", tags: ["Ambiance", "Résultat"] },
  { comment: "Travail soigné, prix un peu élevé mais justifié.", tags: ["Résultat"] },
];

function hash(value: string): number {
  let out = 7;
  for (let i = 0; i < value.length; i++) out = (out * 31 + value.charCodeAt(i)) % 99991;
  return out;
}

async function findExistingUserId(supabase: SupabaseClient, email: string): Promise<string | null> {
  let page = 1;
  for (;;) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const found = data.users.find((user) => user.email === email);
    if (found) return found.id;
    if (data.users.length < 200) return null;
    page += 1;
  }
}

/** Creates (or finds) the six review authors and returns their profile ids. */
export async function upsertReviewers(supabase: SupabaseClient): Promise<string[]> {
  const ids: string[] = [];
  for (const reviewer of REVIEWERS) {
    let id = await findExistingUserId(supabase, reviewer.email);
    if (!id) {
      const { data, error } = await supabase.auth.admin.createUser({
        email: reviewer.email,
        password: PASSWORD,
        email_confirm: true,
      });
      if (error) throw error;
      id = data.user.id;
    }
    const { error: profileError } = await supabase
      .from("profiles")
      .update({ first_name: reviewer.firstName, last_name: reviewer.lastName })
      .eq("id", id);
    if (profileError) throw profileError;
    ids.push(id);
  }
  return ids;
}

/**
 * Replaces this salon's seeded reviews with 3 to 6 fresh ones whose average
 * lands on `targetRating` (e.g. 4.8), each on its own past, confirmed
 * appointment with one of the salon's real services. Stable per `salonKey`.
 */
export async function seedSalonReviews(
  supabase: SupabaseClient,
  params: { coiffeurId: string; salonKey: string; targetRating: number; reviewerIds: string[] },
): Promise<number> {
  const { coiffeurId, salonKey, targetRating, reviewerIds } = params;

  const { data: services, error: servicesError } = await supabase
    .from("coiffeur_services")
    .select()
    .eq("profile_id", coiffeurId);
  if (servicesError) throw servicesError;
  if (!services || services.length === 0) return 0;

  // Re-runs replace rather than pile up: deleting the appointments cascades to their reviews.
  const { error: deleteError } = await supabase
    .from("appointments")
    .delete()
    .eq("coiffeur_id", coiffeurId)
    .in("particulier_id", reviewerIds);
  if (deleteError) throw deleteError;

  const seed = hash(salonKey);
  const count = 3 + (seed % 4);
  const fourStars = Math.min(count, Math.max(0, Math.round((5 - targetRating) * count)));
  const today = parisParts(new Date());

  for (let i = 0; i < count; i++) {
    const rating = i < count - fourStars ? 5 : 4;
    const pool = rating === 5 ? FIVE_STAR : FOUR_STAR;
    const text = pool[(seed + i) % pool.length];
    const service = services[(seed + i) % services.length];

    let daysAgo = 8 + i * 11 + (seed % 5);
    const candidate = new Date(Date.UTC(today.year, today.month - 1, today.day - daysAgo));
    if (candidate.getUTCDay() === 0) daysAgo += 1; // most salons are closed on Sunday
    const startsAt = parisTime(today.year, today.month, today.day - daysAgo, 10 + (i % 3) * 2, 0);
    const bookedAt = new Date(startsAt.getTime() - 3 * 86_400_000).toISOString();
    const reviewedAt = new Date(startsAt.getTime() + 86_400_000).toISOString();

    const { data: appointment, error: appointmentError } = await supabase
      .from("appointments")
      .insert({
        particulier_id: reviewerIds[(seed + i) % reviewerIds.length],
        coiffeur_id: coiffeurId,
        service_id: service.id,
        service_name: service.name,
        price: service.price,
        duration_min: service.duration_min,
        starts_at: startsAt.toISOString(),
        status: "confirmed",
        created_at: bookedAt,
      })
      .select("id, particulier_id")
      .single();
    if (appointmentError) throw appointmentError;

    const { error: reviewError } = await supabase.from("reviews").insert({
      appointment_id: appointment.id,
      particulier_id: appointment.particulier_id,
      coiffeur_id: coiffeurId,
      rating,
      tags: text.tags,
      comment: text.comment,
      status: "visible",
      created_at: reviewedAt,
      updated_at: reviewedAt,
    });
    if (reviewError) throw reviewError;
  }
  return count;
}

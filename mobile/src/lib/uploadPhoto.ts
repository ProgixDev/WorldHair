import { supabase } from "./supabase";

const BUCKET = "user-photos";

function extensionFor(uri: string, mimeType?: string | null): string {
  const fromUri = uri.split(".").pop();
  if (fromUri && fromUri.length <= 4 && !fromUri.includes("/")) return fromUri.toLowerCase();
  return mimeType === "image/png" ? "png" : "jpg";
}

/** Already an uploaded/remote URL — no need to re-upload it. */
export function isRemoteUrl(uri: string): boolean {
  return uri.startsWith("http://") || uri.startsWith("https://");
}

/**
 * Uploads a local image (from expo-image-picker) to the public `user-photos`
 * Storage bucket at `{uid}/<kind>.<ext>` and returns the resulting public
 * URL. Shared by the particulier avatar and a coiffeur's salon cover — same
 * bucket, same per-user-prefix RLS (see server/_variants/supabase/schema.sql).
 */
export async function uploadUserPhoto(
  userId: string,
  kind: "avatar" | "salon-cover",
  localUri: string,
  mimeType?: string | null,
): Promise<string> {
  const extension = extensionFor(localUri, mimeType);
  const path = `${userId}/${kind}.${extension}`;
  // ArrayBuffer, not Blob: Supabase documents Blob/File/FormData uploads as
  // not working in React Native (they fail or land as 0-byte objects).
  const body = await (await fetch(localUri)).arrayBuffer();

  const { error } = await supabase.storage.from(BUCKET).upload(path, body, {
    upsert: true,
    contentType: mimeType ?? (extension === "png" ? "image/png" : "image/jpeg"),
  });
  if (error) throw error;

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

/**
 * Uploads one "Réalisations" gallery photo to `{uid}/gallery/<random>.<ext>`
 * — a distinct path per photo, unlike avatar/salon-cover's one fixed slot
 * per kind, since a coiffeur has several of these. Same public bucket: its
 * RLS only checks the first path segment (the uid), so the extra `gallery/`
 * subfolder needs no policy change (see schema.sql).
 */
export async function uploadGalleryPhoto(
  userId: string,
  localUri: string,
  mimeType?: string | null,
): Promise<{ url: string; storagePath: string }> {
  const extension = extensionFor(localUri, mimeType);
  const path =
    `${userId}/gallery/${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}.${extension}`;
  const body = await (await fetch(localUri)).arrayBuffer();

  const { error } = await supabase.storage.from(BUCKET).upload(path, body, {
    contentType: mimeType ?? (extension === "png" ? "image/png" : "image/jpeg"),
  });
  if (error) throw error;

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return { url: data.publicUrl, storagePath: path };
}

/** Removes a gallery photo's Storage object — best-effort, called before the server's own row delete. */
export async function removeGalleryPhotoFile(storagePath: string): Promise<void> {
  await supabase.storage.from(BUCKET).remove([storagePath]);
}

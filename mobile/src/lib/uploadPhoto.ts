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

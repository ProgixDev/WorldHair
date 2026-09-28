import { SupabaseClient } from '@supabase/supabase-js';
import { slices } from './slices';

/** Entries per Storage `list` call. */
const LIST_PAGE = 100;

/**
 * Every file under `folder` in `bucket`, sub-folders included (a gallery,
 * say): Storage lists one folder at a time, a sub-folder as an entry
 * without an id.
 */
export async function filesUnder(client: SupabaseClient, bucket: string, folder: string): Promise<string[]> {
  const files: string[] = [];
  for (let offset = 0; ; offset += LIST_PAGE) {
    const { data, error } = await client.storage.from(bucket).list(folder, { limit: LIST_PAGE, offset });
    if (error) {
      throw new Error(`Couldn't list ${bucket}/${folder}: ${error.message}`);
    }
    for (const entry of data) {
      const path = `${folder}/${entry.name}`;
      // A folder comes back without an id (typed as a string all the same).
      if (!entry.id) files.push(...(await filesUnder(client, bucket, path)));
      else files.push(path);
    }
    if (data.length < LIST_PAGE) return files;
  }
}

/** Deletes every file under `folder` in `bucket`. Answers how many went. */
export async function removeFolder(client: SupabaseClient, bucket: string, folder: string): Promise<number> {
  const files = await filesUnder(client, bucket, folder);
  for (const slice of slices(files)) {
    const { error } = await client.storage.from(bucket).remove(slice);
    if (error) {
      throw new Error(`Couldn't delete files in ${bucket}/${folder}: ${error.message}`);
    }
  }
  return files.length;
}

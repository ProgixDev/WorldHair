/** Ids per `in` filter: a longer list would overflow the request's URL. */
export const IDS_PER_QUERY = 100;

/** `items` cut into runs of at most `size`, in order. */
export function slices<T>(items: T[], size = IDS_PER_QUERY): T[][] {
  const result: T[][] = [];
  for (let start = 0; start < items.length; start += size) result.push(items.slice(start, start + size));
  return result;
}

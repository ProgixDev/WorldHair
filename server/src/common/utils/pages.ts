import { InternalServerErrorException } from '@nestjs/common';

/** PostgREST's max rows per answer (Supabase → API settings). */
export const PAGE_ROWS = 1000;

/**
 * Every row of a query, however many: page after page (`page(from, to)`
 * applies `.range(from, to)` to an ordered query) until a short one.
 */
export async function allPages<T>(
  page: (from: number, to: number) => PromiseLike<{ data: unknown; error: { message: string } | null }>,
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_ROWS) {
    const { data, error } = await page(from, from + PAGE_ROWS - 1);
    if (error) {
      throw new InternalServerErrorException(error.message);
    }
    const chunk = data as T[];
    rows.push(...chunk);
    if (chunk.length < PAGE_ROWS) return rows;
  }
}

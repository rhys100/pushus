/**
 * Paging past PostgREST's row ceiling.
 *
 * `supabase/config.toml` sets `max_rows = 1000`. That ceiling is applied
 * SILENTLY — an unbounded select returns exactly 1000 rows and no error, so a
 * member with a long history would receive a truncated "complete" export and
 * nothing anywhere would say so. Every full-history read must page.
 */

/** Stay under max_rows so a page is never itself truncated. */
export const PAGE_SIZE = 500

/** Refuse to spin forever if a caller's query is not deterministically ordered. */
const MAX_PAGES = 200

export type PageFetcher<T> = (from: number, to: number) => Promise<T[]>

/**
 * Read every row by walking `.range()` windows.
 *
 * The caller's query MUST have a deterministic total order (e.g.
 * `.order('logged_for').order('logged_at').order('id')`). Offset paging over a
 * non-deterministic order can repeat or skip rows between pages, which would
 * corrupt an export in a way that looks like real data.
 */
export async function fetchAllPages<T>(fetchPage: PageFetcher<T>): Promise<T[]> {
  const all: T[] = []

  for (let page = 0; page < MAX_PAGES; page += 1) {
    const from = page * PAGE_SIZE
    const rows = await fetchPage(from, from + PAGE_SIZE - 1)

    all.push(...rows)

    // A short page means we reached the end. An exactly-full page is ambiguous,
    // so it costs one more round trip to be sure.
    if (rows.length < PAGE_SIZE) {
      return all
    }
  }

  return all
}

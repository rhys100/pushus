import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Streak freezes were writable straight from the client. `streak_freezes_insert_self`
 * checked only `user_id = auth.uid()` and active membership, while the client
 * supplied BOTH `week_start` and `used_on` — so a member could protect any date,
 * past or future, from a browser console, and the UNIQUE (user_id, group_id,
 * week_start) index did not help because they chose that column too.
 *
 * The RLS suite that would normally cover this self-skips without Supabase
 * service credentials, so these are static guards that run everywhere.
 */
describe('streak freeze write path', () => {
  const migrationsDir = resolve(process.cwd(), 'supabase/migrations')
  const allSql = readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .map((f) => readFileSync(resolve(migrationsDir, f), 'utf8'))
    .join('\n')

  const hook = readFileSync(resolve(process.cwd(), 'src/hooks/useStreaks.ts'), 'utf8')

  it('revokes direct member writes to streak_freezes', () => {
    expect(allSql).toMatch(/DROP POLICY IF EXISTS streak_freezes_insert_self/)
    expect(allSql).toMatch(/DROP POLICY IF EXISTS streak_freezes_update_self/)
    expect(allSql).toMatch(/REVOKE INSERT, UPDATE, DELETE ON public\.streak_freezes FROM authenticated/)
  })

  it('exposes a definer RPC that takes no caller-supplied date', () => {
    const fn = allSql.match(
      /CREATE OR REPLACE FUNCTION public\.use_streak_freeze\(([^)]*)\)/,
    )?.[1]

    expect(fn, 'use_streak_freeze is missing').toBeTruthy()
    // Only the group id. Accepting a date is precisely the bug.
    expect(fn).toMatch(/p_group_id uuid/)
    expect(fn).not.toMatch(/date/i)
  })

  it('derives the protected day from the group timezone, never the server clock', () => {
    const body = allSql.match(
      /CREATE OR REPLACE FUNCTION public\.use_streak_freeze[\s\S]*?\$\$;/,
    )?.[0]

    expect(body).toMatch(/public\.group_local_date\(p_group_id\)/)

    // Strip `--` comments before the negative assertion: the function's own
    // comment names the pattern it is avoiding, and a warning about a mistake
    // must not read as the mistake.
    const code = (body ?? '').replace(/--[^\n]*/g, '')
    expect(code).not.toMatch(/now\(\)::date/)
  })

  it('enforces one freeze per week server-side', () => {
    const body = allSql.match(
      /CREATE OR REPLACE FUNCTION public\.use_streak_freeze[\s\S]*?\$\$;/,
    )?.[0]

    expect(body).toMatch(/already been used for this week/i)
  })

  it('is not callable by anon or PUBLIC', () => {
    // PostgREST exposes every function in `public`, and EXECUTE is granted to
    // PUBLIC by default — a definer function taking a group id must revoke it.
    expect(allSql).toMatch(/REVOKE ALL ON FUNCTION public\.use_streak_freeze\(uuid\) FROM PUBLIC/)
    expect(allSql).toMatch(/REVOKE ALL ON FUNCTION public\.use_streak_freeze\(uuid\) FROM anon/)
    expect(allSql).toMatch(/GRANT EXECUTE ON FUNCTION public\.use_streak_freeze\(uuid\) TO authenticated/)
  })

  it('leaves no direct client insert into streak_freezes', () => {
    expect(hook).not.toMatch(/from\(['"]streak_freezes['"]\)\s*\.\s*insert/)
    expect(hook).toMatch(/rpc\(['"]use_streak_freeze['"]/)
  })
})

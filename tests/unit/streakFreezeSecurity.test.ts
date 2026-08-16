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

describe('earned freeze bonuses (0049)', () => {
  const migrationsDir = resolve(process.cwd(), 'supabase/migrations')
  const allSql = readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .map((f) => readFileSync(resolve(migrationsDir, f), 'utf8'))
    .join('\n')

  /**
   * The LAST definition wins — use_streak_freeze is defined in 0048 and
   * redefined in 0049, and matching the first would assert against the
   * superseded version.
   */
  const fnBody = (name: string) => {
    const matches = [
      ...allSql.matchAll(
        new RegExp(`CREATE OR REPLACE FUNCTION public\\.${name}[\\s\\S]*?\\$\\$;`, 'g'),
      ),
    ]
    return matches.at(-1)?.[0] ?? ''
  }

  const grantBody = fnBody('grant_earned_streak_freezes')
  const spendBody = fnBody('use_streak_freeze')

  it('drops the old signature before changing the return type', () => {
    // 0048 declared RETURNS public.streak_freezes. CREATE OR REPLACE cannot
    // change a return type — Postgres errors rather than replacing. Scoped to
    // the 0049 file: `RETURNS jsonb` appears in earlier migrations too.
    const migration = readFileSync(
      resolve(migrationsDir, '0049_earned_streak_freeze_bonus.sql'),
      'utf8',
    )

    const dropIndex = migration.indexOf(
      'DROP FUNCTION IF EXISTS public.use_streak_freeze(uuid)',
    )
    const redefineIndex = migration.indexOf(
      'CREATE OR REPLACE FUNCTION public.use_streak_freeze(p_group_id uuid)',
    )

    expect(dropIndex).toBeGreaterThan(-1)
    expect(redefineIndex).toBeGreaterThan(dropIndex)
  })

  it('spends the free weekly entitlement before a hard-earned bonus', () => {
    const weekly = spendBody.indexOf("'weekly'")
    const bonus = spendBody.indexOf("'bonus'")

    expect(weekly).toBeGreaterThan(-1)
    expect(bonus).toBeGreaterThan(weekly)
  })

  it('keeps freezes cosmetic — no reps and no XP are written', () => {
    // Locked rule: "Freezes do not add fake pushups — cosmetic protection only".
    for (const body of [grantBody, spendBody]) {
      expect(body).not.toMatch(/INSERT INTO public\.pushup_entries/)
      expect(body).not.toMatch(/user_xp_ledger/)
    }
  })

  it('caps how many bonuses can be banked', () => {
    expect(grantBody).toContain('freeze_max_banked')
    expect(grantBody).toMatch(/v_held < v_max_banked/)
  })

  it('is idempotent, so repeated grants cannot double-award', () => {
    expect(grantBody).toMatch(/ON CONFLICT \(user_id, group_id, earned_for_week\) DO NOTHING/)
  })

  it('uses group-local dates rather than the server clock', () => {
    expect(grantBody).toContain('public.group_local_date(p_group_id)')
    expect(grantBody.replace(/--[^\n]*/g, '')).not.toMatch(/now\(\)::date/)
  })

  it('reads injury episodes with the columns that actually exist', () => {
    // injury_episodes (0035) is per-USER with no group_id, and its date columns
    // are `since` / `ended` — not started_on / ended_on.
    expect(grantBody).toMatch(/FROM public\.injury_episodes/)
    expect(grantBody).not.toMatch(/ie\.group_id/)
    expect(grantBody).not.toMatch(/started_on|ended_on/)
  })

  it('keeps the bonus table writable only through the definer functions', () => {
    expect(allSql).toMatch(/GRANT SELECT ON public\.streak_freeze_bonuses TO authenticated/)
    expect(allSql).not.toMatch(
      /GRANT[^;]*INSERT[^;]*ON public\.streak_freeze_bonuses TO authenticated/,
    )
  })

  it('does not expose the new functions to anon or PUBLIC', () => {
    for (const fn of ['grant_earned_streak_freezes', 'streak_freeze_state']) {
      expect(allSql).toContain(`REVOKE ALL ON FUNCTION public.${fn}(uuid) FROM PUBLIC`)
      expect(allSql).toContain(`REVOKE ALL ON FUNCTION public.${fn}(uuid) FROM anon`)
    }
  })
})

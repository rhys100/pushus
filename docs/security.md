---
type: Note
title: PushUS security
description: Knowledge page for push-ups-app/docs/security.md.
tags: [push-ups-app]
updated: 2026-07-20
---

# PushUS security

## Row Level Security (RLS)

Every table with group-scoped data has RLS enabled. Policies enforce:

- **Active members** can read group data for their groups
- **Pending members** cannot read entries, leaderboards, feeds, or member lists
- **Outsiders** cannot read any private group data

**Slice 1A gate:** `npm run test:rls` must pass before group-data UI ships.

## Write path

Mutations go through RPCs where possible:

- `bank_pushups`, `undo_last_entry`, entry edit/delete
- All call `can_group_write(group_id)` — Slice 1A stub; extended in Slice 1B

Frontend role checks are **UX only**. Never trust the client for authorization.

## Keys and secrets

| Key | Where | Never |
|-----|-------|-------|
| Anon key | Frontend `.env` | Commit to git |
| Service role key | Supabase Edge Functions / server only | Frontend, git, public docs |
| Stripe secret + webhook secret | Edge Functions (Slice 1B) | Frontend, git |

Copy `.env.example` to `.env` locally. Add `.env` to gitignore (already configured).

## Stripe webhooks (Slice 1B)

- Verify signature using raw request body
- Idempotent processing via `billing_events.stripe_event_id`
- Service role for DB updates only inside Edge Functions

## Reporting vulnerabilities

Do not open public issues for security bugs. Contact maintainers privately.

## Streak freezes (fixed in 0048)

Members could write `public.streak_freezes` rows directly. The
`streak_freezes_insert_self` policy (0004) checked only `user_id = auth.uid()`
and active group membership, while the client supplied **both** `week_start`
and `used_on`. Nothing server-side tied those two columns together or bounded
the protected date, so from a browser console a member could protect any date —
past or future — and mint one row per arbitrary `week_start`. The
`UNIQUE (user_id, group_id, week_start)` index gives no protection because the
attacker chooses that column too.

The "one freeze per week" and "yesterday only" rules existed **only in client
JavaScript** (`resolveFreezeStatus`), so a forged streak was trivially
achievable and would feed badges and the group board.

Migration `0048_streak_freeze_rpc.sql` drops the INSERT/UPDATE policies, revokes
INSERT/UPDATE/DELETE on the table from `authenticated`, and moves spending
behind `public.use_streak_freeze(p_group_id uuid)` — a SECURITY DEFINER RPC that
takes **no date at all**. It derives the protected day from
`group_local_date(p_group_id)`, enforces one-per-week, and refuses to protect a
day that was already logged. SELECT is unchanged so the Badges card can still
show whether a freeze is available.

Streak semantics are untouched: a freeze remains a row with `used_on` set,
neither streak walker changed, no reps and no XP are written.

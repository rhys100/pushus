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

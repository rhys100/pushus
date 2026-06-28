# PushUS private beta hardening

Operational notes for the small-group private beta launch.

## Access control

Private beta is enforced in Postgres, not just the UI.

| Control | Mechanism |
|---------|-----------|
| Private beta flag | `deployment_settings.private_beta_enabled` (default `true` after migration `0008`) |
| Approved organisers | `beta_allowed_emails` table |
| Invite-only joins | `request_join_group` requires invite code when private beta is on |
| Group creation | `create_group` requires allowlist (or existing membership) during private beta |
| Profile onboarding | `complete_onboarding_profile` RPC checks `user_has_app_access()` |
| Direct profile updates | RLS blocks profile writes when private beta is on and user lacks access |

### Add an approved organiser email

Run in Supabase SQL Editor:

```sql
INSERT INTO public.beta_allowed_emails (email)
VALUES ('you@example.com')
ON CONFLICT (email) DO NOTHING;
```

Replace with the real organiser email before inviting the first group owner. Only service-role / dashboard SQL can write this table; the app never exposes allowlist management in the UI for beta.

### Add a beta tester via invite

No allowlist entry needed. Share:

`https://www.pushus.app/join/YOUR_INVITE_CODE`

Flow: sign in → profile setup → join group instantly via invite link.

### Block random public usage

Users who sign in without allowlist or valid invite see `/private-beta`.

They cannot:

- complete onboarding (`complete_onboarding_profile` fails)
- create a group (`create_group` fails)
- join without invite code (`request_join_group` fails)

## Deploy checklist

1. Apply migration: `npx supabase db push`
2. Insert organiser email(s) into `beta_allowed_emails`
3. Confirm `private_beta_enabled = true`
4. Confirm auth redirect URLs include `www.pushus.app`, apex `pushus.app`, and fallback Pages URL
5. Rebuild Cloudflare Pages with latest frontend
6. Run phone spot-check (see `community-beta.md` section 6)

## Manual test steps (Rhys)

- [ ] Random email sign-in → private beta screen (no app access)
- [ ] Allowlisted email → can create group
- [ ] Invite link on phone → profile → today → log push-ups
- [ ] Magic link login on production domain
- [ ] Google login on production domain (or clear error if disabled)
- [ ] Leaderboard and activity update after logging
- [ ] Pending/outsider cannot read group data

## Remaining risks

- Supabase Auth still allows account creation; access is gated after sign-in. To block sign-ups entirely, disable sign-ups in Supabase Auth settings.
- Profile onboarding completion is tracked in localStorage; clearing storage repeats onboarding UI (server profile still exists).
- `beta_allowed_emails` is managed via SQL until an admin UI exists.

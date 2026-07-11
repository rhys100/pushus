# iOS PWA email OTP auth handoff

## Goal

Create the Supabase session inside the installed iOS PWA. Safari and Home Screen apps
use isolated storage, so a magic link opened in Safari cannot sign in the PWA.

## Built

- Login sends the existing Supabase passwordless email.
- The member enters the six-digit code in PushUS.
- `verifyOtp({ email, token, type: 'email' })` creates the session in the current
  PWA/browser storage context.
- Code input supports iOS one-time-code autofill and formatted paste.
- Send and verify calls stop blocking the UI after 10 seconds.
- The retired Cache Storage token bridge is no longer read or written; its cache is
  removed per browser context.

## Production rollout order

Auth template and client must overlap safely:

1. Push the hybrid template (or paste `supabase/templates/magic_link_hybrid_rollout.html` in
   **Authentication → Email Templates → Magic Link**). Subject: `Your PushUS sign-in code`.
   Or: `SUPABASE_ACCESS_TOKEN=... npm run auth:push-email-template -- --template hybrid`
2. Send a production test email. Confirm it contains both a six-digit code and browser
   link. Existing production login must still work.
3. Merge/deploy the client branch.
4. Confirm the deployed Login page says **Email me a sign-in code**.
5. Push the code-only template:
   `SUPABASE_ACCESS_TOKEN=... npm run auth:push-email-template`
   (HTML from `magic_link.html`, plain text from `magic_link.txt` for the dashboard Text tab).
6. On a real iPhone Home Screen install: request email, enter code in the PWA,
   force-close, reopen, and confirm the member stays signed in.

Do not deploy the code-only template before the client. Do not deploy the client while
the old link-only template remains.

## Rollback

1. Restore `magic_link_hybrid_rollout.html` in hosted Supabase.
2. Confirm an email contains both code and link.
3. Revert the client only after the hybrid template is live.

No database rollback is required.

## Verification completed

- `npx tsc -b`
- `npm test` — 458 tests passed
- `npm run lint` — 0 errors (existing warnings only)
- `npm run build`
- `npx playwright test e2e/email-otp.spec.ts --project=chromium` — 2 passed
- Relevant login/join smoke tests — 2 passed
- Browser test confirmed session is stored in `sb-127-auth-token` and survives reload.

## Still requires Rhys

- Explicit approval to change the hosted Supabase email template.
- Real iPhone spot-check after the staged rollout.

This is auth/security work. It is not final ship until the hosted template and real-device
check pass.

# Open in installed app prompt

When a member opens PushUS in a **mobile browser tab** but already has the app
installed (or we can reasonably infer it), we show a bottom dock nudging them to
open the installed app instead. Installed launches get more reliable push
reminders and a full-screen experience.

This is easy to break without noticing, so it has a guard test and this doc.

## Where it lives

| Piece | File |
|-------|------|
| Visibility + platform logic | `src/lib/pwaOpenAppPrompt.ts` |
| Launch handling | `src/lib/pwaOpenInApp.ts` |
| Dock UI | `src/components/PwaOpenAppPrompt.tsx` |
| Show/hide hook | `src/hooks/usePwaOpenAppPrompt.ts` |
| Manifest | `public/manifest.json` (+ legacy `manifest.webmanifest`) |
| Tests | `tests/unit/pwaOpenAppPrompt.test.ts`, `tests/unit/pwaOpenInApp.test.ts`, `tests/unit/pwaManifest.test.ts` |

## Behaviour

- **Android:** primary button **Open in app** calls `openInstalledPwa()`, which
  uses `window.open(inScopeHttpsUrl, '_blank', 'noopener,noreferrer')`. There is
  no `launchPwa()` API — the installed WebAPK intercepts in-scope https URLs
  opened in a **new browsing context**.

  **Never use** `window.location.href`, `location.assign`, SPA `navigate()`, or
  `intent://` with https fallback for this flow — they stay in the browser tab.

  Install detection uses `navigator.getInstalledRelatedApps()` (Android Chrome
  84+). The manifest declares `related_applications` with `platform: "webapp"`
  and `url: "/manifest.json"`.
- **iOS:** Safari cannot detect or open the home-screen app programmatically —
  honest numbered home-screen steps only.
- **Standalone:** suppress the dock when `display-mode: standalone`.
- **Don't remind me again:** permanent dismiss (per account, localStorage).
- **Open in app:** snoozes the dock for the current visit only.

## Critical UI invariant — do not regress

On member tab routes (`/today`, `/leaderboard`, `/activity`, `/group`,
`/settings`) the open-app dock **must** sit above the bottom nav via
`bottom-[var(--bottom-nav-height)]`. Source of truth:
`PWA_OPEN_APP_PROMPT_BOTTOM_NAV_PATHS` in `src/lib/pwaOpenAppPrompt.ts`.

## Checked before every PR

`npm test` runs `tests/unit/pwaOpenAppPrompt.test.ts` and
`tests/unit/pwaOpenInApp.test.ts`.

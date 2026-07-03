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
| Launch / intent handling | `src/lib/pwaOpenInApp.ts` |
| Dock UI | `src/components/PwaOpenAppPrompt.tsx` |
| Show/hide hook | `src/hooks/usePwaOpenAppPrompt.ts` |
| Tests | `tests/unit/pwaOpenAppPrompt.test.ts`, `tests/unit/pwaOpenAppPromptStorage.test.ts` |

## Behaviour

- **Android:** the primary button is **Open in app**. It calls `openInstalledPwa()`
  which uses `window.open` then an Android **intent URL** fallback so Chrome can
  launch the installed WebAPK instead of reloading the tab. If Chrome shows an
  app picker, the member chooses PushUS.
- **iOS:** Safari cannot switch to a home-screen app, so there is **no** fake
  open button — just honest numbered steps to tap the home-screen icon.
- **Don't remind me again:** permanent dismiss (per account, localStorage).
- **Open in app:** snoozes the dock for the current visit only; it returns on
  `pageshow` / tab visibility when the member is back in the browser.

We only show it once install is inferred (`isPwaLikelyInstalledForOpenPrompt`):
known-installed, push enabled, a dismissed iOS install prompt, or Android never
offering an install prompt.

## Critical UI invariant — do not regress

On member tab routes (`/today`, `/leaderboard`, `/activity`, `/group`,
`/settings`) the app renders a **fixed bottom navigation bar**. The open-app dock
is also fixed to the bottom, so it **must be offset above the nav** with
`bottom-[var(--bottom-nav-height)]`. If it sits at `bottom-0`, the dock's action
buttons render **behind the nav bar and become untappable** — the prompt text
still shows, so it looks like the button "disappeared".

This is exactly what happened once `/today` started showing the prompt but was
missing from the offset list. The source of truth is now
`PWA_OPEN_APP_PROMPT_BOTTOM_NAV_PATHS` / `pwaOpenAppPromptSitsAboveBottomNav()`
in `src/lib/pwaOpenAppPrompt.ts`.

Routes **without** a bottom nav (e.g. `/group/billing`, `/group/create`,
`/about`, `/join`) keep the dock at the screen bottom.

## Checked before every PR

`npm test` runs `tests/unit/pwaOpenAppPrompt.test.ts`, which asserts:

1. The prompt shows on `/today` and all member tab routes.
2. The dock is offset above the nav on every member tab route (incl. `/today`).
3. The dock stays at the screen bottom on routes without a bottom nav.

If you add a new bottom-nav route or change the Log page layout, update
`PWA_OPEN_APP_PROMPT_BOTTOM_NAV_PATHS` and keep these tests green.

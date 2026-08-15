---
type: Spec
title: Android APK (Trusted Web Activity)
description: How the PushUS Android app is built, signed, verified and shipped.
tags: [push-ups-app, android, pwa, release]
updated: 2026-08-15
---

# Android APK (Trusted Web Activity)

PushUS ships on Android as a **Trusted Web Activity** (TWA): a thin native
wrapper that opens `https://www.pushus.app` full-screen in the user's browser
engine, with no URL bar and no browser chrome. It is the same app the PWA
serves — there is no second codebase, no second release train, and a web deploy
updates the Android app the moment users reopen it.

## Why a TWA rather than a rebuild

- **One codebase.** The wrapper contains no Java or Kotlin of our own. Every
  screen, every query and every migration is the code already in `src/`.
- **Updates without the Play review queue.** A Cloudflare Pages deploy is live
  in the Android app immediately; the APK only needs re-releasing when the
  wrapper itself changes (icon, package id, target SDK).
- **Push reminders keep working.** `DelegationService` in the manifest lets the
  wrapper post the web app's push notifications under the PushUS name and icon
  instead of the browser's.
- The alternative — Capacitor or a native rewrite — would add a build target,
  a plugin surface and a second set of bugs for no user-visible gain.

## Layout

```
android/
  settings.gradle          repositories + module list
  build.gradle             AGP version
  gradle.properties        AndroidX, JVM args
  app/
    build.gradle           applicationId, SDK levels, signing
    src/main/AndroidManifest.xml
    src/main/res/values/   strings (launch URL, asset statements), colours, theme
    src/main/res/mipmap-*/ launcher icons — GENERATED, see below
scripts/generate-android-icons.ts
.github/workflows/android-apk.yml
public/.well-known/assetlinks.json
```

Launcher icons are rendered from `functions/_shared/pwaIconSvg.ts` — the same
source as the PWA icons — so the Home Screen icon and the installed app icon
cannot drift apart. Regenerate with:

```bash
node --experimental-strip-types scripts/generate-android-icons.ts
```

## Building

The build runs in CI because it needs a JDK and the Android SDK, which this
repo does not otherwise require. Trigger **Actions → Android APK → Run
workflow**, or publish a GitHub Release (the workflow then attaches the APK to
it automatically).

Artifacts produced:

| File | Use |
|---|---|
| `pushus-<version>.apk` | Direct download / sideload |
| `pushus-<version>.aab` | Play Console upload (release runs, or tick "build_aab") |
| `assetlinks.json` | Ready-to-commit Digital Asset Links for the signing key used |

To build locally you need JDK 17 and the Android SDK (`compileSdk 35`), then:

```bash
node --experimental-strip-types scripts/generate-android-icons.ts
```

```bash
cd android && gradle assembleRelease -PpushusVersionName=1.5.0 -PpushusVersionCode=1
```

## Signing — read before the first public release

An APK must be signed to install at all. The workflow signs with the **debug
key** when no keystore secrets are configured, which is fine for testing but
has two hard consequences:

- Android identifies an app by *package id + signing key*. Shipping a
  debug-signed build and later switching to a real key means users must
  **uninstall and reinstall**, losing the app's local state.
- Play will reject a debug-signed upload.

So create the upload keystore **once**, before the first public link, and keep
it forever:

```bash
keytool -genkeypair -v -keystore pushus-release.jks -alias pushus -keyalg RSA -keysize 4096 -validity 10000
```

Store it as repository secrets (Settings → Secrets and variables → Actions):

| Secret | Value |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | `base64 -w0 pushus-release.jks` |
| `ANDROID_KEYSTORE_PASSWORD` | keystore password |
| `ANDROID_KEY_ALIAS` | `pushus` |
| `ANDROID_KEY_PASSWORD` | key password |

Back up `pushus-release.jks` somewhere you will still have in five years. Losing
it means never being able to update the app under the same identity. `*.jks` and
`*.keystore` are gitignored — never commit it.

## Digital Asset Links (removes the URL bar)

The TWA only runs chrome-less once Android can verify that the site and the app
vouch for each other. Both halves must agree:

1. `android/app/src/main/res/values/strings.xml` → `asset_statements` points at
   `https://www.pushus.app`. Already set.
2. `public/.well-known/assetlinks.json` must list the SHA-256 fingerprint of the
   key that signed the APK. It currently holds a placeholder.

After the first signed build, copy the `assetlinks.json` the workflow emits over
`public/.well-known/assetlinks.json`, commit, and deploy. Verify with:

```bash
curl -s https://www.pushus.app/.well-known/assetlinks.json
```

`public/_routes.json` excludes `/.well-known/*` so Cloudflare Pages serves the
file statically instead of falling through to the SPA.

**If the fingerprint is wrong or missing the app still works** — it just shows a
browser URL bar across the top, which is the single most common "why does my TWA
look wrong" cause. The workflow now warns when the APK it just built is signed
with a key the committed `assetlinks.json` does not list.

### The debug key is not stable — this will bite twice

GitHub runners are ephemeral, and Gradle generates `~/.android/debug.keystore`
on first use. So **every CI run without the release secrets produces a different
signing key and therefore a different fingerprint**, and each one invalidates the
`assetlinks.json` committed for the last build.

`assetlinks.json` currently lists the debug fingerprint of the first build, so
the APK from that run verifies. Any subsequent debug build will not, until its
new fingerprint is committed. Configuring `ANDROID_KEYSTORE_BASE64` ends this
permanently — it is the only way to get a key that survives across builds, and
it is required before any public download link regardless.

## Distributing

- **Direct download** — link the release asset:
  `https://github.com/rhys100/pushus/releases/latest`. Android warns about
  installing from unknown sources; that is expected for sideloading.
- **Play Store** — upload the `.aab`. Play requires a privacy policy URL
  (`/privacy` exists), a 512×512 icon (`android/app/src/main/ic_launcher-playstore.png`,
  generated), and feature graphics. Because the app is a TWA, Play's data-safety
  form should describe what the *web app* collects — see `docs/privacy.md`.

## Gotchas

- **`versionCode` must increase** on every Play upload. The workflow uses
  `github.run_number`, which is monotonic per repository.
- **The user needs a TWA-capable browser** (Chrome 72+, or any browser
  implementing `CustomTabsService`). Without one the wrapper falls back to a
  Custom Tab, which shows a URL bar.
- **`minSdk 21`** — Android 5 and up. Lower than that has no Custom Tabs.
- The wrapper does not bundle the web app. **Offline behaviour comes from the
  service worker** in `public/sw.js`, not from the APK.

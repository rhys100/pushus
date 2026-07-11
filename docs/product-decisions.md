# PushUS product decisions

Locked product decisions from the planning Q&A. These are **business and UX rules**, not schema.

**Legend**

| Tag | Meaning |
|-----|---------|
| **Beta** | Shipped or active in Community beta today |
| **Phase 2** | Planned next product slice after beta core is stable |
| **Future** | Roadmap — not scheduled for immediate build |
| **Non-goal** | Explicitly out of scope for now |

When **Beta** differs from a locked decision, both are recorded.

For exploratory ideas without locked rules, see [product-roadmap.md](./product-roadmap.md).

---

## Product identity

| Decision | Status |
|----------|--------|
| App name: **PushUS** | Beta |
| Suggested repo name: **`pushus`** or **`push-us`** | Beta |
| Tagline (exact): **Bank push-ups. Push your mates. Don't wreck yourself.** | Beta |
| Main logger CTA (exact): **Bank Push-ups** — not “Bank PushUS” or generic “Submit” | Beta |
| Premium **mobile-first** fitness app — not admin-dashboard CRUD | Beta |
| **Today screen is the hero** | Beta |
| **Direct-drag circular logger** — primary input method | Beta |
| **No plus button** for adding reps in MVP | Beta |
| Private groups of mates — not a public fitness network | Beta |
| One codebase: Community (self-hosted) + Cloud (hosted) | Beta / Future |
| Group-first social model in beta; friend graph is future | Beta / Future |

---

## Open-source and licence decisions

| Decision | Status |
|----------|--------|
| Licence: **AGPL-3.0-only** (not AGPL-or-later) | Beta |
| **No CLA** (contributor licence agreement) | Beta |
| **Commercial use allowed** under AGPL (including paid hosting) | Beta |
| **Source Code** link visible in app (`VITE_SOURCE_REPO_URL`) | Beta |
| About page: licence notice, deployment name, fork transparency | Beta |
| Modified fork transparency (`VITE_IS_MODIFIED_FORK`, `VITE_DEPLOYMENT_NAME`) | Beta |
| **`THIRD_PARTY_NOTICES.md`** maintained for dependency attribution | Beta |
| Forks must **not pretend to be official PushUS** | Beta |
| PushUS Cloud charges for hosting and support — **not** for closed-source code | Future (Cloud) |
| Source remains available under AGPL for Cloud users | Future (Cloud) |

---

## Community vs Cloud billing decisions

| Decision | Status |
|----------|--------|
| **PushUS Community:** free, self-hosted | Beta |
| **PushUS Cloud:** paid, officially hosted | Future (Cloud) |
| Billing unit: **per group**, paid by **group owner** | Future (Cloud) |
| **45-day** free trial | Future (Cloud) |
| **A$12/month** per group | Future (Cloud) |
| **A$99/year** per group (~30% cheaper than monthly) | Future (Cloud) |
| **30 members** included (default `max_members`) | Beta / Future |
| **Payment method upfront** for Cloud trial | Future (Cloud) |
| Stripe Checkout and Customer Portal | Future (Cloud) |
| Self-hosters: billing **disabled by default** | Beta |
| `deployment_settings.billing_enabled = false` for Community seed | Beta |
| Frontend `VITE_BILLING_ENABLED` controls UI only — never write gate | Beta |
| Write gate: `can_group_write()` uses DB state only | Beta |
| No per-user billing in v1 | Non-goal |
| No coupons or complex tiers in v1 | Non-goal |
| Incomplete checkout groups: not joinable until subscription resolves | Future (Cloud) |
| Read-only when subscription expired; data preserved | Future (Cloud) |
| Tax/GST in Stripe/accounting — app logic tax-neutral | Future (Cloud) |
| Slice 1B code in repo; **not enabled** for Community beta | Beta |

---

## Privacy principles and non-goals

| Decision | Status |
|----------|--------|
| **Private groups only** — no open/public groups | Beta |
| **No public user discovery** | Beta / Non-goal |
| **No public / global leaderboard** across all PushUS | Beta / Non-goal |
| **No profile photos by default** | Non-goal (early versions) |
| **No DMs** (private messages) | Non-goal (early versions) |
| **No comments** on feed entries | Beta / Non-goal |
| **No phone numbers** collected | Non-goal |
| **No unnecessary personal data** — collect only what the product needs | Beta |
| Auth **email stays in Supabase Auth** — not duplicated onto `profiles` | Beta |
| Profile: display name, emoji/colour, timezone — no email on profile row | Beta |
| Row Level Security on every table | Beta |
| Pending members cannot see group data | Beta |
| No selling personal data; no ad trackers in core app | Beta |
| Friend connections require consent, controls, and RLS review if added | Future |

---

## Auth decisions

| Decision | Status |
|----------|--------|
| **Passwordless email code** — users enter the emailed OTP inside the browser or PWA so the session is created in the correct storage context; code-only emails avoid link scanners consuming the credential | Beta |
| **Google OAuth optional** — configured per deployment; skippable for magic-link-only forks | Beta |
| **No anonymous nickname-only accounts** — real auth required | Beta |
| Optional **profile name initial** — single letter only, not a last name | Beta |
| **Personal mate labels** — per-viewer alias on Members list only; synced to viewer account | Beta |
| **Private beta allowlist** for organisers (`beta_allowed_emails`) | Beta |
| Without allowlist or valid invite path, user sees private-beta screen | Beta |
| **Invite links can let non-allowlisted mates** join or request to join a group | Beta |
| Group creation during private beta requires allowlist (or existing membership) | Beta |
| No in-app allowlist management UI in beta — SQL/dashboard only | Beta |

---

## Group, invite, and referral rules

| Decision | Status |
|----------|--------|
| Roles: **owner**, **admin**, **member** | Beta |
| **Owner/admin approve join requests** (when approval flow applies) | Beta |
| Members can **invite mates** | Beta |
| Default **referral limit: 3 active referred members** per member | Phase 2 (enforcement) |
| Effective limit: `coalesce(member.invite_slots_override, group.default_invite_limit)` | Phase 2 |
| **Rejected** join requests do **not** consume a slot | Phase 2 |
| **Removed or left** referred members **free a slot** | Phase 2 |
| Owner/admin can **adjust or reset** per-member invite limits | Phase 2 |
| Default group **max size: 30** members | Beta |
| **Invite link is primary** share method; **raw invite code is backup** | Beta |
| Rotatable group invite code | Beta |
| Valid invite code may **auto-join as active member** (current beta behaviour) | Beta |
| Join without invite may require admin approval | Beta |
| Optional `group_invites` audit table for generated links | Future |

---

## Roles and permissions

| Decision | Status |
|----------|--------|
| **Owner:** billing (Cloud), delete group, full admin | Beta / Future |
| **Admin:** approve/reject joins, manage members, moderate entries | Beta |
| **Member:** log push-ups, react, view group data when active | Beta |
| **Pending member:** no group data visibility | Beta |
| Write RPCs call `can_group_write()` in addition to RLS | Beta |

---

## Late joiner rules

| Decision | Status |
|----------|--------|
| **Activity feed immediately** after approval / becoming active | Phase 2 |
| **Starter challenge** from join date for late joiners | Phase 2 |
| **Since-you-joined** leaderboard view for late joiners | Phase 2 |
| Official **weekly** scoring starts **next full week** after join | Phase 2 |
| Official **monthly** scoring starts **next full month** after join | Phase 2 |
| Late joiners must not backfill official period wins unfairly | Phase 2 |

---

## Circular logger decisions

| Decision | Status |
|----------|--------|
| **Circular drag logger only** for MVP — no alternate logger UI | Beta |
| **One full circle = 10 push-ups** (visual lap mapping) | Beta |
| Supports arbitrary counts via drag: **7, 13, 26, 42**, etc. | Beta |
| **Big central count** (hero typography) | Beta |
| **Direct drag** on ring — **no plus button** for reps | Beta |
| **Bank Push-ups disabled at 0** reps | Beta |
| Each bank action saves **one set** (current ring count) | Beta |
| Bank immediately; **undo via toast** — no confirm modal for bank | Beta |
| **Edit and delete own entries** from Today entries list | Beta |
| **Audit log** records entry changes (see Entry rules) | Beta |
| Local-state drag — no network calls while dragging | Beta |
| Pointer capture and `touch-action: none` on ring | Beta |
| Optional per-rep feedback while dragging (ios-vibrator-pro-max: notch tick per rep, major stop every 5) | Beta |
| Handle snap animation on each rep during drag | Beta |
| Hint affordance at zero reps (drag handle visible) | Beta |
| Manual **create-entry** flow hidden — edit existing entries only | Beta |

---

## Entry rules and honour system

| Decision | Status |
|----------|--------|
| **Honour system** — no video or photo proof required | Beta |
| **No video/photo proof** in MVP | Beta |
| Users **edit/delete own entries**; admins manage dodgy entries (Phase 2) | Beta / Phase 2 |
| **Backdating admin-controlled** per group (`backdate_policy`) | Beta (policy enum) / Phase 2 (admin UI) |
| Default backdate policy: **today + yesterday** (`today_yesterday`) | Beta |
| Members may **add + edit** their own entries **within the backdate window** (today + yesterday by default); **delete stays same-day** for members; older days are **locked**. Admins bypass. (`update_pushup_entry` uses `is_backdate_allowed`; mig 0041) | Beta |
| **Log a missed past day** (yesterday) from the My log calendar; gated by `backdate_policy`, enforced server-side | Beta |
| Default **max single entry: 100** reps | Phase 2 (enforcement) |
| Oversize entries: **warn, block, or admin review** | Phase 2 |
| Admin can **manage dodgy entries** on behalf of group | Phase 2 |
| **Audit log** for edits, deletes, and admin adjustments | Beta (entry audit) / Phase 2 (full admin audit) |

---

## Activity feed and reaction decisions

| Decision | Status |
|----------|--------|
| Default feed visibility: **full entries** (`full_entries`) | Beta |
| Future visibility modes: **full entries**, **daily totals only**, **leaderboard totals only** | Future |
| **Emoji reactions only** — no comments | Beta |
| **Cannot react to your own entries** | Beta |
| **No DMs** | Non-goal |
| **No comment threads** | Non-goal |
| Locked reaction set: **💪 🔥 😂 👏 😤** | Phase 2 |
| Beta ships subset: **🔥 💪 👏** only | Beta |
| Grouped or denser feed layouts | Future |

---

## Training wizard decisions

| Decision | Status |
|----------|--------|
| Wizard after **first saved set** | Phase 2 |
| Wizard is **skippable** | Phase 2 |
| **Five wizard questions (locked):** | Phase 2 |
| 1. Max clean pushups in one set | Phase 2 |
| 2. Recent training level | Phase 2 |
| 3. Shoulder/elbow/wrist soreness warning acknowledgement | Phase 2 |
| 4. Challenge intensity | Phase 2 |
| 5. Preferred training days | Phase 2 |
| **Multiple submaximal sets preferred** over one huge set | Beta |
| **General fitness guidance — not medical advice** | Beta / Phase 2 |
| **Do not encourage overtraining** in copy or UX | Beta / Phase 2 |
| **Science-based plan formulas (signed off):** | Beta |
| Submaximal set size ≈ 45% of max clean set | Beta |
| Daily volume cap = min(2× max, max + 15) | Beta |
| Weekly microcycle: rest / easy / moderate / challenge days | Beta |
| 4-week mesocycle: W1 70% → W2 85% → W3 100% → W4 deload 55% | Beta |
| Auto-advance baseline +5% after mesocycle if hit rate ≥ 80% on training days | Beta |
| **Reps-in-reserve (RIR) after each bank on training days** — skippable; 0–5+ scale | Beta |
| RIR + hit rate drive max clean set (±1 per block) and plan baseline at mesocycle advance | Beta |
| Require ≥3 RIR samples before effort overrides hit-rate-only progression | Beta |
| **Post-challenge plan calibration:** wizard pre-fills from 30-day PushUS log history; user confirms or overrides | Beta |
| Structured starting peak ≈ **55%** of confirmed recent daily average (not challenge grind volume) | Beta |
| Initial `plan_baseline` capped at **1.35×** reference peak; manual daily average trusted at save | Beta |
| High recent volume (peak day ≥ 2× daily cap, ≥14 sample days) → start mesocycle at **week 2 (85%)** not week 1 | Beta |
| Manual daily average ≥ 50/day → may also start at week 2 when log spike data absent | Beta |
| **History confidence tiers** for wizard: trusted (≥7 days in 30d + recent log), partial, stale (>90 days since last PushUS log) | Beta |
| Stale users: max-clean-first; daily average hidden unless off-app toggle | Beta |
| **Week 1 adaptive tuning:** baseline ±3–5% from logs + RIR during first 7 days (caps +12% / −10% cumulative) | Beta |
| Rest days = 0 daily target, streak-protected | Beta |
| Conservative defaults when wizard not completed | Beta |

### Training plan engine v2 (2026-06-29)

| Decision | Status |
|----------|--------|
| **No fake default plan** when wizard skipped — show setup CTA, not generic targets | Beta |
| Max clean **anchors set size** (upper safe bound); trusted recent volume **anchors set count and daily target** | Beta |
| Partial trust: conservative target + 50% uplift toward trusted target; anchor capped at ~1.25× max-clean reference peak | Beta |
| **Trusted volume resolution (2026-06-29):** 14+ logged days in 30d **or** 7+ days with last log ≤14 days **or** confirmed off-app manual when no logs (unless avg wildly exceeds max-clean cap) | Beta |
| Live PushUS logs **trump** stored `@vt:partial` in `calibration_note` on rebuild — promotion when stats qualify | Beta |
| Wizard preview **waits for history stats** before calibrating; separate checkbox for “train regularly off-app” (not the reveal toggle alone) | Beta |
| Trust mode + honest preview copy shown on wizard step 2 (logs vs partial blend vs conservative) | Beta |
| **Deferred schema:** first-class columns `volume_trust_mode`, `volume_anchor_daily_average`, `volume_anchor_source`, `volume_sample_days` on `user_training_plans` — keep `@vt:…` encoding until migration slice | Future |
| Low recent volume may reduce set size below max-clean formula; recent volume never increases set size above it | Beta |
| W1 active-day ceiling: 1.1× recent average (all active days) | Beta |
| Day-type set ratios: easy 35%, moderate 50%, challenge 60% of max clean; min set 1–2 reps | Beta |
| Default training days: Mon, Tue, Wed, Fri, Sat (Thu + Sun rest) | Beta |
| Training plan timezone = **user profile**; leaderboard uses group timezone | Beta |
| Effort UX: Easy / Good / Hard / Skip → RIR 5 / 3 / 1 / null; ask after final set or challenge only | Beta |
| **No auto max-clean bumps** from progression — baseline-only block changes | Beta |
| Max check-in via explicit **Try max set** mode; capped plan max update (+10% per jump) with user confirm | Beta |
| Leaderboard: others see **% progress only**; self sees exact; no target without wizard | Beta |
| History prefill cannot override user max clean — suggestion only | Beta |
| No forced mesocycle week-2 skip from calibration | Beta |

---

## Daily goal and safety cap decisions

| Decision | Status |
|----------|--------|
| User can bank freely **up to daily goal** | Beta |
| At daily goal: **celebrate** (subtle — no heavy animation library) | Phase 2 |
| Extra reps allowed within **soft overage cap** | Phase 2 |
| Above **warning cap**: **calm confirmation** — not scary medical copy | Phase 2 |
| User can **record override** after calm confirmation above warning cap | Phase 2 |
| **Do not scare** the user with medical-style warnings | Beta / Phase 2 |
| Recommended set size and caps from training plan when active | Phase 2 |

---

## Injury and sub-out decisions

| Decision | Status |
|----------|--------|
| **No medical details** stored | Beta / Phase 2 |
| **Simple group-visible status** only (e.g. injured / sub-out) | Phase 2 |
| **Stops push reminders** | Beta |
| **Pauses training plan** progression | Phase 2 |
| **Does not break streak** — paused, not broken | Phase 2 |
| **Weekly gentle check-in** while paused | Phase 2 / Future |
| **Ramp-back mode** on return from injury | Phase 2 |
| Logging push-ups still allowed while injured | Beta |

---

## Challenge decisions

| Decision | Status |
|----------|--------|
| Default competition rhythms: **weekly** and **monthly** | Phase 2 |
| Admin-created formats later: **one-day, weekend, 7-day, 14-day, 30-day, custom** | Phase 2 |
| MVP challenge types: **total target**, **team total**, **leaderboard** | Phase 2 |
| **Streak** and **improvement** challenge types — **later** (not first challenge slice) | Future |
| Intensity labels: **Fun, Moderate, Hard, Stupid** | Phase 2 |
| **Hard** and **Stupid** challenges warn beginners | Phase 2 |
| **One-off teams** for team challenges — **no permanent teams** in MVP | Phase 2 |
| 1v1 friend challenge ties to mate graph | Future |
| Challenge creation UI and participation flows | Phase 2 |

---

## Streak, XP, and achievement decisions

| Decision | Status |
|----------|--------|
| Leaderboard types: **total push-ups** (weekly in beta) | Beta / Phase 2 |
| **Biggest set** leaderboard | Phase 2 |
| **Goal completion** tracking | Phase 2 |
| **Most improved** | Phase 2 |
| **Streaks** (active + goal) | Phase 2 |
| **XP ledger** | Phase 2 (partial schema in beta) |
| **1 push-up = 1 XP** | Phase 2 |
| **No set-size XP multiplier** — big sets credit via biggest-set leaderboard/badges, not inflated XP | Phase 2 |
| **Achievements** catalog + server-side unlock rules | Phase 2 |
| **Admin banter badges** (custom badges) | Phase 2 |
| **Active streak:** any pushups logged that calendar day (group TZ) | Phase 2 |
| **Goal streak:** daily target met | Phase 2 |
| **Rest days do not break streaks** | Phase 2 |
| **Injury pauses streaks** — does not silently break or fake progress | Phase 2 |
| **Streak freezes:** default **1 per week** | Phase 2 |
| Freezes **do not add fake pushups** — cosmetic protection only | Phase 2 |
| Achievements page read-only in beta — auto-unlock not shipped | Beta |

---

## Push notification decisions

| Decision | Status |
|----------|--------|
| Channel: **Web Push** (no SMS/email in v1) | Beta |
| Remind only if **behind personal daily goal** | Beta |
| **Active hours** window (user-configurable) | Beta |
| **User timezone** for reminder timing | Beta |
| **Group timezone** for competitions and leaderboards | Beta / Phase 2 |
| **Injury/sub-out stops push reminders** | Beta |
| Beta frequency: **hourly**, **every 2 hours**, or **once per local day** (user-configurable) | Beta |
| Default active hours for new users: **7am–7pm** | Beta |
| Android and iOS users should be guided to **install the PushUS PWA** for reliable reminders; Android installed web apps avoid Chrome's automatic notification permission removal, and iOS reminders should use the home-screen app path | Beta |
| Future reminder frequency: **custom intervals** | Future |
| **Banter notifications:** opt-in only | Future |
| **Weekly gentle check-in** while injury-paused | Future |
| Friend nudge notifications | Future (mate graph) |

---

## Friend connection decisions (roadmap only)

| Decision | Status |
|----------|--------|
| **Future roadmap only** — not beta | Future |
| **Friend/mate graph** separate from group membership | Future |
| **Friend requests require consent** | Future |
| Friend profile cards with simple stats | Future |
| Friend leaderboard | Future |
| **1v1 challenges** between friends | Future |
| **Nudges** (“push them”, cheer, stir up) | Future |
| **No public user search** in early versions | Future / Non-goal |
| **No DMs** in early friend features | Non-goal |
| **Privacy and RLS review required** before building | Future |
| Block/remove friend before broad friend feature launch | Future |

See [product-roadmap.md](./product-roadmap.md) for exploratory mate-graph ideas.

---

## Design and UX quality bar

| Decision | Status |
|----------|--------|
| Premium **mobile-first** — not generic admin dashboard | Beta |
| Dark navy base (`#0B1220` range) + high-energy accent (coral-orange) | Beta |
| Design tokens in CSS variables — not scattered raw hex | Beta |
| Touch targets minimum **44px** | Beta |
| Safe-area insets for iOS home indicator | Beta |
| Bottom nav on main tabs; no collision with fixed Bank CTA | Beta |
| Skeletons and optimistic states over full-screen spinners | Beta |
| Original PushUS identity — do not copy The Push-Up Challenge branding | Beta |
| Light theme may ship later; dark-first for Today | Future |
| Lazy-load non-critical routes | Beta |

---

## Explicitly not now

| Item | Status |
|------|--------|
| Friend / mate connection graph | Future |
| Public discovery or global leaderboard | Non-goal |
| Private messaging | Non-goal |
| Profile photos | Non-goal |
| Phone / address book import | Non-goal |
| Per-user billing | Non-goal |
| Stripe production enablement for Community beta | Non-goal |
| Draft training formulas without review sign-off | Non-goal |
| Full Phase 2 gamification in beta | Non-goal |
| Video/photo proof of push-ups | Non-goal |
| Anonymous nickname-only accounts | Non-goal |
| Permanent challenge teams in MVP | Non-goal |

---

## Document maintenance

When Rhys locks a new product rule, add a row here with status tag.

When exploring new ideas without a decision, add to [product-roadmap.md](./product-roadmap.md) instead.

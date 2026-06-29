# PushUS Training Plan Engine v2 — Implementation Plan

> **Status: APPROVED by Rhys (2026-06-29)** — build in slices, not one giant pass.  
> Temporary viewing copy in repo. Source plan: `.cursor/plans/training_engine_v2_fix_59fed18f.plan.md`

## Locked product decisions

| Decision | Status |
|----------|--------|
| No fake default plan when wizard skipped | Locked |
| No forced 5-rep minimum set size | Locked |
| Max clean set **anchors set size** (upper safe bound) | Locked |
| Trusted recent volume **anchors set count and daily target** | Locked (slice 13) |
| Daily average soft hint only | **Superseded** by slice 13 trusted volume model |
| Default 5 active + 2 recovery days | Locked |
| Default week: Mon easy, Tue easy, Wed moderate, **Thu rest**, Fri easy, **Sat challenge**, **Sun rest** | Locked |
| Optional max-clean check-in (user-controlled) | Locked |
| Simple effort: Easy / Good / Hard / Skip | Locked |
| Soreness suppresses progression and max-test suggestions | Locked |
| Training plan uses **profile/user timezone** (group TZ for leaderboard only) | Locked |
| Leaderboard: others see **% only**; self sees exact target; no plan = no target | Locked (beta) |
| Max check-in via explicit **“Try max set”** mode (not tag-after-bank) | Locked |
| Group setting “show exact targets to group” | **Deferred** (post-beta) |

### Effort → stored RIR (revised)

| User choice | Stored `reps_in_reserve` | Progression treatment |
|-------------|---------------------------|------------------------|
| Easy | 5 | Can increase when combined with good hit rate |
| Good | **3** | Normal training signal |
| Hard | **1** | Treat as “hold or reduce” — not failure unless user explicitly maxes |
| Skip | `null` | No sample; never penalise |

Do **not** store 0 RIR unless user is in explicit max-set mode and indicates failure.

### Max clean 1–2 special handling

When `plan_max_clean <= 2`, every set may equal 100% of max — unavoidable at this level.

- Show extra gentle copy: *“Keep these tiny and easy. Rest longer. Stop if form breaks.”*
- For max clean 1–2: label moderate/challenge days as **“Practice day”** in UI (not “Challenge”) until capacity grows
- Do not suggest max-clean check-in at this level

### Cap coherence fix

```typescript
function applyVolumeCapCoherent(
  target: number,
  sets: number,
  setSize: number,
  cap: number,
  maxClean: number,  // required — used for minSetSize when reducing setSize
): { target: number; sets: number; setSize: number }
```

---

## Implementation order (12 slices — do not combine)

| Slice | Scope | Schema? |
|-------|-------|---------|
| **1. Null plan contract** | `hasPlan: false`; Today/Settings/resolveMemberTodayTarget; tests | No |
| **2. Set sizing v2** | `computeSetSizeForDay`, cap coherence, matrix tests, `planResolve.ts` mirror | No |
| **3. Weekly pattern v2** | 3 easy + 1 moderate + 1 challenge; default `[1,2,3,5,6]`; Thu+Sun rest | No |
| **4. Soft calibration** | Hints only; +10% nudge max; no week-2 skip; history cannot override max clean | No |
| **5. Wizard UX** | Max clean min 1, soreness question, skip, plain-English preview, practice-day labels | No |
| **6. Today UX** | No-plan CTA, plan summary, challenge card shell | No |
| **7. Effort feedback** | Easy/Good/Hard/Skip sheet; ask timing; Good=3, Hard=1 mapping | No |
| **8. Progression / idempotency** | Remove auto max-clean; simplified block rules; sync fingerprint; progression log writes | Partial (log table later) |
| **9. Max check-in** | “Try max set” mode; observed vs plan max; pending confirm UI | Uses schema when ready |
| **10. Schema migration** | `0026_training_plan_v2.sql` — apply after slices 1–9 code is ready | Yes |
| **11. Soreness check-ins** | Wire `user_daily_status_checkins`; post-challenge prompts | No new table |
| **12. Leaderboard privacy** | % for others; null for no-plan; self exact target | No |

### Slice A — first Cursor task only

Implement **slices 1–4** plus **remove auto max-clean mutations** (part of slice 8) and **update unit tests**. No schema. No wizard/Today UX overhaul yet beyond null-plan contract.

**Slice A deliverables:**

- [ ] Null plan contract in `useTrainingPlan`, `resolveMemberTodayTarget`, hooks consumers
- [ ] `computeSetSizeForDay` + reference matrix tests (max 1,3,5,10,20,40,60)
- [ ] `applyVolumeCapCoherent(..., maxClean)` 
- [ ] Weekly pattern v2 + default days Mon/Tue/Wed/Fri/Sat
- [ ] Soft calibration (no hard baseline / no week-2 skip)
- [ ] Remove auto max-clean bumps from `advanceMesocycleIfDue`
- [ ] Mirror changes in `supabase/functions/_shared/planResolve.ts`
- [ ] Extend existing tests — do not remove
- [ ] `npm test` passes

**Slice A test command:** `npm test -- tests/unit/planEngine.test.ts tests/unit/volumeCalibration.test.ts tests/unit/resolveMemberTodayTarget.test.ts` then `npm test`

---

## Set sizing reference matrix (must pass tests)

| max clean | easy | moderate | challenge |
|-----------|------|----------|-----------|
| 1 | 1 | 1 | 1 |
| 3 | 1 | 2 | 2 |
| 5 | 2 | 3 | 3 |
| 10 | 4 | 5 | 6 |
| 20 | 7 | 10 | 12 |
| 40 | 14 | 15 | 15 |
| 60 | 15 | 15 | 15 |

Ratios: easy 0.35, moderate 0.50, challenge 0.60. Soft cap 15. No minimum of 5.

---

## Default weekly rhythm (locked)

| Day | Type |
|-----|------|
| Mon | Easy |
| Tue | Easy |
| Wed | Moderate |
| Thu | **Rest** |
| Fri | Easy |
| Sat | Challenge |
| Sun | **Rest** |

Training days: `[1, 2, 3, 5, 6]`. User can customise; warn if too many hard days.

---

## Max check-in UX (locked)

On challenge days when engine suggests check-in:

1. Show card: *“Feeling good? Try a clean max set today. Not today? Just do the planned sets. Stop when form breaks.”*
2. **“Try max set”** enters dedicated logger mode — banks are tagged `is_max_checkin = true`
3. Do **not** ask “was that a max?” after a normal bank
4. Save `observed_max_clean`; do not mutate today’s plan
5. If observed > plan max: prompt to update plan (next week/block, capped jump ~10%)

---

## Resolved open questions

| Question | Answer |
|----------|--------|
| Default rest Thu + Sun? | **Yes** |
| Hide exact targets for others on leaderboard? | **Yes** for beta |
| Max check-in logging? | **Separate “Try max set” mode** |
| Training timezone? | **Profile/user timezone immediately** |

---

## Phase map (rollout)

- **Phase A (Slice A):** Engine safety — slices 1–4 + remove auto max-clean + tests
- **Phase B:** Wizard + Today UX — slices 5–7
- **Phase C:** Progression + max check-in — slices 8–9
- **Phase D:** Schema — slice 10
- **Phase E:** Soreness + leaderboard — slices 11–12
- **Phase F:** Docs + release (CHANGELOG, dev-log, product-decisions per slice)

**Out of scope:** Stripe, unrelated UI polish, group “show exact targets” setting (deferred).

---

## Current engine bugs (why we’re doing this)

| Issue | Impact |
|-------|--------|
| Set-size floor of 5 | Max clean 5 → forced 100% sets |
| Fake default plan | Numeric targets with no wizard |
| Hard volume calibration | Up to 1.35× baseline + week-2 skip |
| Auto max-clean mutations | Silent plan changes |
| RIR after every bank | Too much friction |
| Group TZ for plan | Wrong day boundary for some users |

---

## Schema (slice 10 — do not create until then)

Migration `0026_training_plan_v2.sql` (proposed):

- `user_training_plans`: `observed_max_clean`, `observed_max_clean_at`, `pending_max_clean_update`, soreness + idempotency fields
- `training_plan_progression_log` (new table, own-row RLS)
- `pushup_entries`: `is_max_checkin`, optional `effort_rating`
- Reuse `user_daily_status_checkins`, `reps_in_reserve`

---

## Next action

Slice 13 (trusted volume calibration) — **implemented 2026-06-29**.

---

## Slice 13 — Trusted volume calibration (implemented)

### Amended set-size rule (Rhys fix for Case D)

- Max clean controls the **upper safe set size**
- Trusted volume controls **target / set count**
- Low recent volume **may reduce** suggested set size below the max-clean formula
- Recent volume **never increases** set size above the max-clean formula

Example: max clean 40, avg 10/day → moderate target ~5–8 with set size ~2, **not** 14–15 rep sets.

### Trust modes

| Mode | When | Schedule behaviour |
|------|------|-------------------|
| **none** | No average, stale / no history | Conservative max-clean-only path |
| **partial** | Manual average without 7 logged days; 7–13 days stale log | 50% blend toward trusted target; safety cap = max-clean daily cap |
| **trusted** | 7+ logged days (recent); 14+ days; manual + confirmed off-app training | Full trusted bands; W1 ceiling 1.1× average on all active days |

### Success tests

| Case | Inputs | W1 expectation |
|------|--------|----------------|
| **C** | max 20, avg 65, advanced, intense | Easy 21–28, moderate 35–40, challenge 45–55 |
| **D** | max 40, avg 10 | Set size below max-clean formula; targets ~5–8 on moderate |

### Code

- `src/lib/training/trustedVolume.ts` — trust derivation, bands, effective set size, safety caps
- `src/lib/training/planEngine.ts` — `buildWeeklySchedule(..., volumeContext?)`
- `src/lib/training/volumeCalibration.ts` — `derivePlanCalibration` returns `volumeContext`
- `supabase/functions/_shared/planResolve.ts` — mirror when `recent_daily_average` stored
- `tests/unit/trustedVolume.test.ts` — Case C/D matrix

### Out of scope (unchanged)

No schema, max check-in, leaderboard privacy, or progression overhaul in this slice.

# PushUS UI Sound Spec — for audio production

All sounds below currently exist as Web Audio synthesis in `src/lib/dinkSound.ts`.
This doc names each cue and describes character, timing, and technical intent so
an audio engineer can produce polished replacements. Deliver as **48kHz / 24-bit
WAV, mono**, tight heads (no silence before the transient), tails under the
stated durations. These cues fire rapidly and overlap — no reverb tails longer
than ~150ms anywhere.

Mix reference: RATCHET at −22 LUFS-S is the quietest; DOOOSH at −10 the loudest.
Everything plays on phone speakers — keep critical energy above 200Hz except
where a sub layer is explicitly listed (sub layers are a bonus for headphones).

---

## 1. RATCHET — per-rep drag tick

**Trigger:** every rep crossed while dragging the ring (up to ~15/sec on a fast drag).
**Character:** tiny mechanical ratchet click, like a torque wrench notch. Dry,
percussive, zero tail. The user hears dozens per session — it must never fatigue.
**Current synth:** 35ms square wave, 1150Hz falling ~15%, fast exponential decay.
**Variants:**
- `RATCHET` — base tick (1150Hz zone)
- `RATCHET_5` — every 5th rep: same click, brighter/tighter (1500Hz zone), +3dB
- `RATCHET_10` — every 10th rep: brightest (1900Hz zone), +6dB, a hair of metallic ring (≤80ms)

**Length:** ≤40ms (base), ≤80ms (10s). **Files:** `ratchet.wav`, `ratchet_5.wav`, `ratchet_10.wav`

## 2. RISER TRILL — bank unwind sequence

**Trigger:** one note per rep as the counter spins from N back to 0 after
banking (a 20-rep bank = 20 notes over ~1.8s, S-curve pacing: slow-fast-slow).
**Character:** ascending happiness. A bright, plucky arpeggio note (triangle/
marimba/pluck family). The run rises ~1.5 octaves across the whole unwind —
pitch is applied per-note at runtime, so deliver a **chromatic ladder** (see
below). Each note has a subtle upward chirp — hopeful, game-y, "points being
counted."
**Current synth:** triangle, 440Hz × 2^(progress × 1.5), 50ms, +6% pitch chirp.
**Variants (accents land on remaining-count multiples):**
- `TRILL` — base note, 50ms
- `TRILL_5` — octave doubled, ~90ms, +4dB — a two-voice flourish
- `TRILL_10` — full chord hit (root + octave + 12th), ~140ms, +7dB — milestone peak

**Delivery:** 16-step chromatic ladder per variant from A4 to ~E6
(`trill_00.wav` … `trill_15.wav`, etc.), or a single C5 sample per variant that
survives ±12 semitone repitching. **Length:** ≤150ms each.

## 3. CLICK-CLACK — lock-in arm (mecha stage 1)

**Trigger:** the instant the unwind lands on zero; the dial expands.
**Character:** two mechanical latch snaps, like a rifle bolt or a mecha joint
locking: high metallic *click*, then a meatier lower *clack* 90ms later.
Precise, dry, hardware-feeling.
**Current synth:** two bandpassed noise snaps — 2.4kHz (25ms) then 1.3kHz (35ms), 90ms apart.
**Delivery:** one file containing both hits with the 90ms gap baked in.
**Length:** ≤160ms total. **File:** `clickclack.wav`

## 4. DOOOSH — lock-in slam (mecha stage 3)

**Trigger:** ~340ms after CLICK-CLACK (after a beat of silence — the
anticipation is part of the design; do not fill it).
**Character:** THE payoff. Cinematic impact: sub drop + air whump + mid punch.
Mecha foot hitting the ground. Chest-thump on headphones, still clearly a slam
on a phone speaker (hence the mid-punch layer).
**Current synth:** sine 150→34Hz over 400ms + lowpassed noise burst 900→90Hz
over 350ms + square punch 210→95Hz over 90ms.
**Length:** ≤600ms. **File:** `doosh.wav`. Loudest cue in the app.

## 5. DINK — nose-tap rep confirm

**Trigger:** every nose tap in nose-tap mode (~1/sec cadence).
**Character:** the Quake 3 Arena hitsound vibe — a bright, metallic,
instantly-readable "point scored" blip. Distinct from RATCHET (this is pitched
and musical, not mechanical).
**Current synth:** 140ms triangle at E6 (1318Hz) with a quick downward flick
into the note, + inharmonic sine partial at ×2.76 decaying in 70ms.
**Variants:**
- `DINK` — base
- `DINK_10` — every 10th rep: up at A6 (1760Hz), slightly longer ring — mini fanfare

**Length:** ≤160ms. **Files:** `dink.wav`, `dink_10.wav`

## 6. QUAKE — brick-skin rumble

**Trigger:** layered under DINK on every tap when the "Bricks" skin is active
(so it must sit *under* DINK spectrally, not fight it).
**Character:** short earthquake — ground rumble radiating from the tap. Filtered
noise darkening as it dies + sub swell. No tonal content above ~400Hz.
**Current synth:** noise through lowpass 180→55Hz + sine 52→28Hz, 400ms.
**Length:** ≤450ms. **File:** `quake.wav`

---

## Cue sheet summary

| Name | File(s) | Max length | Rel. level | Fires |
|---|---|---|---|---|
| RATCHET / _5 / _10 | ratchet*.wav | 40–80ms | quietest | up to 15/s |
| RISER TRILL / _5 / _10 | trill_XX*.wav | 150ms | mid | up to ~20/s burst |
| CLICK-CLACK | clickclack.wav | 160ms | mid+ | once per bank |
| DOOOSH | doosh.wav | 600ms | loudest | once per bank |
| DINK / _10 | dink*.wav | 160ms | mid | ~1/s |
| QUAKE | quake.wav | 450ms | low bed | ~1/s |

**The full bank ritual, in order:** RATCHET ticks (drag up) → bank →
RISER TRILL ascending run (with _5/_10 peaks) → CLICK-CLACK → 170ms beat →
DOOOSH → (BANKED stamp on screen).

All cues should share one sonic family (suggested: "arcade hardware" — metallic,
precise, warm sub). Mono is fine; the app plays them through a single
AudioContext with no panning.

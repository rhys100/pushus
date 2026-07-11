/**
 * Synth-generated confirmation "DINK" for nose-tap mode — a short, bright,
 * metallic blip in the spirit of the Quake 3 Arena hitsound. No audio assets;
 * everything is synthesized with the Web Audio API at tap time.
 */

let audioContext: AudioContext | null = null

type AudioContextConstructor = typeof AudioContext

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') {
    return null
  }

  const Ctor: AudioContextConstructor | undefined =
    window.AudioContext ??
    (window as Window & { webkitAudioContext?: AudioContextConstructor })
      .webkitAudioContext

  if (!Ctor) {
    return null
  }

  if (!audioContext) {
    audioContext = new Ctor()
  }

  return audioContext
}

/**
 * Must be called from a user gesture at least once so the context can start
 * on iOS/Android (autoplay policies suspend fresh contexts).
 */
export function primeDinkAudio(): void {
  const ctx = getAudioContext()

  if (ctx && ctx.state === 'suspended') {
    void ctx.resume()
  }
}

/**
 * Play the dink. `emphasis` raises the pitch a bit — used every 10th rep so
 * laps feel rewarded (like the Q3 kill-confirm vs hit tick).
 */
export function playDink(emphasis = false): void {
  const ctx = getAudioContext()

  if (!ctx) {
    return
  }

  if (ctx.state === 'suspended') {
    void ctx.resume()
  }

  const now = ctx.currentTime
  const duration = 0.14
  const base = emphasis ? 1760 : 1318.5

  const out = ctx.createGain()
  out.gain.setValueAtTime(0.0001, now)
  out.gain.exponentialRampToValueAtTime(0.32, now + 0.004)
  out.gain.exponentialRampToValueAtTime(0.0001, now + duration)
  out.connect(ctx.destination)

  // Body: bright triangle with a fast downward pitch flick — the "di" of dink.
  const body = ctx.createOscillator()
  body.type = 'triangle'
  body.frequency.setValueAtTime(base * 1.12, now)
  body.frequency.exponentialRampToValueAtTime(base, now + 0.03)
  const bodyGain = ctx.createGain()
  bodyGain.gain.value = 0.9
  body.connect(bodyGain)
  bodyGain.connect(out)

  // Shimmer: inharmonic sine partial that decays faster — the metallic "nk".
  const shimmer = ctx.createOscillator()
  shimmer.type = 'sine'
  shimmer.frequency.setValueAtTime(base * 2.76, now)
  const shimmerGain = ctx.createGain()
  shimmerGain.gain.setValueAtTime(0.5, now)
  shimmerGain.gain.exponentialRampToValueAtTime(0.001, now + 0.07)
  shimmer.connect(shimmerGain)
  shimmerGain.connect(out)

  body.start(now)
  shimmer.start(now)
  body.stop(now + duration)
  shimmer.stop(now + duration)
}

/**
 * One note of the bank-unwind trill. Pitch tracks the remaining count so the
 * sequence glides downward as the counter spins back to zero. Multiples of 5
 * hit harder (two-note flourish); multiples of 10 hardest (chord + fifth).
 */
export function playUnwindTick(remaining: number, total: number): void {
  const ctx = getAudioContext()

  if (!ctx) {
    return
  }

  if (ctx.state === 'suspended') {
    void ctx.resume()
  }

  const now = ctx.currentTime
  // Ascending as the bank fills: pitch climbs toward the lock-in, so the
  // trill rises in happiness rather than winding down.
  const progress = total > 0 ? Math.max(0, Math.min(1, 1 - remaining / total)) : 0
  const freq = 440 * Math.pow(2, progress * 1.5)
  const isLap = remaining > 0 && remaining % 10 === 0
  const isHalfLap = remaining > 0 && remaining % 5 === 0 && !isLap
  const level = isLap ? 0.34 : isHalfLap ? 0.24 : 0.14
  const duration = isLap ? 0.14 : isHalfLap ? 0.09 : 0.05

  const gain = ctx.createGain()
  gain.gain.setValueAtTime(0.0001, now)
  gain.gain.exponentialRampToValueAtTime(level, now + 0.003)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration)
  gain.connect(ctx.destination)

  const osc = ctx.createOscillator()
  osc.type = 'triangle'
  osc.frequency.setValueAtTime(freq, now)
  // Tiny upward chirp per note keeps the whole run feeling like a rise.
  osc.frequency.exponentialRampToValueAtTime(freq * 1.06, now + duration)
  osc.connect(gain)
  osc.start(now)
  osc.stop(now + duration + 0.01)

  // Half-laps add an octave partial; laps add octave + fifth for a chord hit.
  if (isHalfLap || isLap) {
    const octave = ctx.createOscillator()
    octave.type = 'triangle'
    octave.frequency.setValueAtTime(freq * 2, now)
    const octaveGain = ctx.createGain()
    octaveGain.gain.setValueAtTime(level * 0.6, now)
    octaveGain.gain.exponentialRampToValueAtTime(0.0001, now + duration)
    octave.connect(octaveGain)
    octaveGain.connect(ctx.destination)
    octave.start(now)
    octave.stop(now + duration + 0.01)
  }

  if (isLap) {
    const fifth = ctx.createOscillator()
    fifth.type = 'sine'
    fifth.frequency.setValueAtTime(freq * 3, now)
    const fifthGain = ctx.createGain()
    fifthGain.gain.setValueAtTime(level * 0.4, now)
    fifthGain.gain.exponentialRampToValueAtTime(0.0001, now + duration)
    fifth.connect(fifthGain)
    fifthGain.connect(ctx.destination)
    fifth.start(now)
    fifth.stop(now + duration + 0.01)
  }
}

/**
 * Per-rep tick while dragging the ring — a short ratchet click. Laps (10, 20…)
 * get a brighter accent so milestones read by ear.
 */
export function playRepTick(count: number): void {
  const ctx = getAudioContext()

  if (!ctx) {
    return
  }

  if (ctx.state === 'suspended') {
    void ctx.resume()
  }

  const now = ctx.currentTime
  const isLap = count > 0 && count % 10 === 0
  const isHalfLap = count > 0 && count % 5 === 0 && !isLap
  const freq = isLap ? 1900 : isHalfLap ? 1500 : 1150
  const level = isLap ? 0.22 : isHalfLap ? 0.16 : 0.11

  const gain = ctx.createGain()
  gain.gain.setValueAtTime(level, now)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.035)
  gain.connect(ctx.destination)

  const osc = ctx.createOscillator()
  osc.type = 'square'
  osc.frequency.setValueAtTime(freq, now)
  osc.frequency.exponentialRampToValueAtTime(freq * 0.85, now + 0.03)
  osc.connect(gain)
  osc.start(now)
  osc.stop(now + 0.04)
}

/** One mechanical tick for the lock-in click-clack: bandpassed noise snap. */
function playMechTick(when: number, frequency: number, level: number): void {
  const ctx = getAudioContext()

  if (!ctx) {
    return
  }

  const duration = 0.035
  const noiseLength = Math.floor(ctx.sampleRate * duration)
  const buffer = ctx.createBuffer(1, noiseLength, ctx.sampleRate)
  const samples = buffer.getChannelData(0)

  for (let i = 0; i < noiseLength; i += 1) {
    samples[i] = Math.random() * 2 - 1
  }

  const noise = ctx.createBufferSource()
  noise.buffer = buffer

  const bandpass = ctx.createBiquadFilter()
  bandpass.type = 'bandpass'
  bandpass.frequency.value = frequency
  bandpass.Q.value = 6

  const gain = ctx.createGain()
  gain.gain.setValueAtTime(level, when)
  gain.gain.exponentialRampToValueAtTime(0.0001, when + duration)

  noise.connect(bandpass)
  bandpass.connect(gain)
  gain.connect(ctx.destination)
  noise.start(when)
  noise.stop(when + duration)
}

/** Mecha lock-in part 1: quick "click clack" as the dial expands. */
export function playClickClack(): void {
  const ctx = getAudioContext()

  if (!ctx) {
    return
  }

  if (ctx.state === 'suspended') {
    void ctx.resume()
  }

  const now = ctx.currentTime
  playMechTick(now, 2400, 0.22)
  playMechTick(now + 0.09, 1300, 0.3)
}

/** Mecha lock-in part 3: the "DOOOSH" — sub-bass slam with a noise whump. */
export function playDoosh(): void {
  const ctx = getAudioContext()

  if (!ctx) {
    return
  }

  if (ctx.state === 'suspended') {
    void ctx.resume()
  }

  const now = ctx.currentTime
  const duration = 0.55

  const out = ctx.createGain()
  out.gain.setValueAtTime(0.0001, now)
  out.gain.exponentialRampToValueAtTime(0.55, now + 0.012)
  out.gain.exponentialRampToValueAtTime(0.0001, now + duration)
  out.connect(ctx.destination)

  // Sub slam: fast pitch drop into the chest register.
  const sub = ctx.createOscillator()
  sub.type = 'sine'
  sub.frequency.setValueAtTime(150, now)
  sub.frequency.exponentialRampToValueAtTime(34, now + 0.4)
  const subGain = ctx.createGain()
  subGain.gain.value = 0.9
  sub.connect(subGain)
  subGain.connect(out)

  // Whump: lowpassed noise burst that darkens as it decays.
  const noiseLength = Math.floor(ctx.sampleRate * 0.35)
  const buffer = ctx.createBuffer(1, noiseLength, ctx.sampleRate)
  const samples = buffer.getChannelData(0)

  for (let i = 0; i < noiseLength; i += 1) {
    samples[i] = Math.random() * 2 - 1
  }

  const noise = ctx.createBufferSource()
  noise.buffer = buffer
  const lowpass = ctx.createBiquadFilter()
  lowpass.type = 'lowpass'
  lowpass.frequency.setValueAtTime(900, now)
  lowpass.frequency.exponentialRampToValueAtTime(90, now + 0.35)
  const noiseGain = ctx.createGain()
  noiseGain.gain.value = 0.5
  noise.connect(lowpass)
  lowpass.connect(noiseGain)
  noiseGain.connect(out)

  // Punch: short mid hit so the slam reads on phone speakers with no sub.
  const punch = ctx.createOscillator()
  punch.type = 'square'
  punch.frequency.setValueAtTime(210, now)
  punch.frequency.exponentialRampToValueAtTime(95, now + 0.09)
  const punchGain = ctx.createGain()
  punchGain.gain.setValueAtTime(0.18, now)
  punchGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.1)
  punch.connect(punchGain)
  punchGain.connect(out)

  sub.start(now)
  noise.start(now)
  punch.start(now)
  sub.stop(now + duration)
  noise.stop(now + 0.35)
  punch.stop(now + 0.1)
}

/**
 * Short synth rumble for the brick-quake nose-tap skin — filtered noise with
 * a sub-bass drop underneath, like a tiny earthquake.
 */
export function playQuakeRumble(): void {
  const ctx = getAudioContext()

  if (!ctx) {
    return
  }

  if (ctx.state === 'suspended') {
    void ctx.resume()
  }

  const now = ctx.currentTime
  const duration = 0.4

  const out = ctx.createGain()
  out.gain.setValueAtTime(0.0001, now)
  out.gain.exponentialRampToValueAtTime(0.4, now + 0.015)
  out.gain.exponentialRampToValueAtTime(0.0001, now + duration)
  out.connect(ctx.destination)

  const noiseLength = Math.floor(ctx.sampleRate * duration)
  const buffer = ctx.createBuffer(1, noiseLength, ctx.sampleRate)
  const samples = buffer.getChannelData(0)

  for (let i = 0; i < noiseLength; i += 1) {
    samples[i] = Math.random() * 2 - 1
  }

  const noise = ctx.createBufferSource()
  noise.buffer = buffer

  const lowpass = ctx.createBiquadFilter()
  lowpass.type = 'lowpass'
  lowpass.frequency.setValueAtTime(180, now)
  lowpass.frequency.exponentialRampToValueAtTime(55, now + duration)
  noise.connect(lowpass)
  lowpass.connect(out)

  const sub = ctx.createOscillator()
  sub.type = 'sine'
  sub.frequency.setValueAtTime(52, now)
  sub.frequency.exponentialRampToValueAtTime(28, now + duration)
  const subGain = ctx.createGain()
  subGain.gain.value = 0.8
  sub.connect(subGain)
  subGain.connect(out)

  noise.start(now)
  sub.start(now)
  noise.stop(now + duration)
  sub.stop(now + duration)
}

export type MusicScene =
  | 'none'
  | 'christmas-bg'
  | 'ice-hockey'
  | 'santa-dash'
  | 'gift-tetris'
  | 'gift-slash'
  | 'candy-match'
  | 'victory';

interface StepTrack {
  bpm: number;
  /** MIDI note per 8th-note step (0 = rest). */
  melody: readonly number[];
  /** MIDI bass note per 8th-note step (0 = rest). */
  bass: readonly number[];
  /** Soft sleigh-bell shimmer pattern (1 = chime, 0 = silent). */
  sleigh?: readonly number[];
  leadWave: OscillatorType;
  leadGain: number;
  bassGain: number;
}

// MIDI helpers: C3=48, F3=53, G3=55, A3=57, C4=60, D4=62, E4=64, F4=65, G4=67, A4=69, B4=71,
// C5=72, C#5=73, D5=74, D#5=75, E5=76, F5=77, F#5=78, G5=79, A5=81, Bb5=82, B5=83, C6=84
const TRACKS: Record<Exclude<MusicScene, 'none'>, StepTrack> = {
  // Warm Christmas Music-Box Medley ("We Wish You a Merry Christmas" + "Deck the Halls")
  'christmas-bg': {
    bpm: 118,
    melody: [
      67, 0, 72, 0, 72, 74, 72, 71, 69, 0, 69, 0,
      69, 0, 74, 0, 74, 76, 74, 72, 71, 0, 67, 0,
      67, 0, 76, 0, 76, 77, 76, 74, 72, 0, 69, 0,
      67, 67, 69, 0, 74, 0, 71, 0, 72, 0, 0, 0,
      // Deck the Halls phrase
      79, 0, 77, 76, 74, 0, 72, 0, 74, 0, 76, 0, 72, 0, 0, 0,
      74, 76, 77, 74, 76, 0, 74, 72, 71, 0, 74, 0, 72, 0, 0, 0,
    ],
    bass: [
      48, 0, 55, 0, 48, 0, 53, 0, 53, 0, 57, 0,
      50, 0, 57, 0, 50, 0, 55, 0, 55, 0, 59, 0,
      52, 0, 59, 0, 52, 0, 57, 0, 57, 0, 53, 0,
      55, 0, 53, 0, 50, 0, 55, 0, 48, 0, 55, 0,
      48, 0, 55, 0, 50, 0, 55, 0, 52, 0, 55, 0, 48, 0, 55, 0,
      50, 0, 55, 0, 48, 0, 52, 0, 55, 0, 50, 0, 48, 0, 0, 0,
    ],
    sleigh: [1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0],
    leadWave: 'triangle',
    leadGain: 0.042,
    bassGain: 0.032,
  },

  // Starlight Hockey: High-Energy Festive Stadium Organ & Sleigh Duel ("Carol of the Bells" arcade drive)
  'ice-hockey': {
    bpm: 152,
    melody: [
      79, 0, 78, 79, 76, 0, 79, 0, 78, 79, 76, 0,
      79, 0, 78, 79, 76, 0, 79, 0, 78, 79, 76, 0,
      83, 0, 81, 83, 79, 0, 83, 0, 81, 83, 79, 0,
      84, 83, 81, 79, 78, 76, 74, 76, 78, 0, 79, 0,
    ],
    bass: [
      52, 64, 52, 64, 52, 64, 50, 62, 50, 62, 50, 62,
      48, 60, 48, 60, 48, 60, 47, 59, 47, 59, 47, 59,
      52, 64, 55, 67, 52, 64, 50, 62, 54, 66, 50, 62,
      48, 60, 50, 62, 52, 64, 54, 66, 47, 59, 52, 0,
    ],
    sleigh: [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0],
    leadWave: 'triangle',
    leadGain: 0.048,
    bassGain: 0.038,
  },

  // Santa Dash: High-Energy "Jingle Bells" Arcade Sprint
  'santa-dash': {
    bpm: 158,
    melody: [
      76, 0, 76, 0, 76, 0, 0, 0,
      76, 0, 76, 0, 76, 0, 0, 0,
      76, 0, 79, 0, 72, 0, 74, 0,
      76, 0, 0, 0, 0, 0, 0, 0,
      77, 0, 77, 0, 77, 0, 77, 0,
      77, 0, 76, 0, 76, 0, 76, 76,
      76, 0, 74, 0, 74, 0, 76, 0,
      74, 0, 0, 0, 79, 0, 0, 0,
    ],
    bass: [
      48, 60, 55, 60, 48, 60, 55, 60,
      48, 60, 55, 60, 48, 60, 55, 60,
      48, 60, 55, 60, 53, 60, 55, 60,
      48, 60, 55, 60, 48, 60, 55, 60,
      53, 65, 60, 65, 53, 65, 60, 65,
      48, 60, 55, 60, 48, 60, 52, 60,
      50, 62, 57, 62, 50, 62, 54, 62,
      55, 67, 50, 62, 55, 0, 43, 0,
    ],
    sleigh: [1, 0, 1, 0, 1, 0, 1, 1],
    leadWave: 'triangle',
    leadGain: 0.048,
    bassGain: 0.036,
  },

  // Block Stack: "Dance of the Sugar Plum Fairy" Festive Puzzle Groove
  'gift-tetris': {
    bpm: 138,
    melody: [
      0, 0, 79, 76, 79, 0, 78, 0,
      75, 0, 76, 0, 74, 74, 74, 0,
      73, 73, 73, 0, 72, 72, 72, 0,
      71, 76, 72, 79, 78, 0, 0, 0,
      0, 0, 81, 78, 81, 0, 79, 0,
      76, 0, 78, 0, 76, 79, 76, 0,
      74, 78, 74, 0, 72, 76, 72, 0,
      71, 74, 79, 78, 76, 0, 0, 0,
    ],
    bass: [
      52, 0, 59, 0, 52, 0, 59, 0,
      51, 0, 59, 0, 52, 0, 59, 0,
      49, 0, 57, 0, 48, 0, 57, 0,
      47, 0, 52, 0, 47, 0, 59, 0,
      52, 0, 60, 0, 52, 0, 59, 0,
      52, 0, 57, 0, 52, 0, 59, 0,
      50, 0, 57, 0, 48, 0, 54, 0,
      47, 0, 55, 0, 52, 0, 0, 0,
    ],
    sleigh: [1, 0, 0, 0, 1, 0, 0, 0],
    leadWave: 'sine',
    leadGain: 0.052,
    bassGain: 0.034,
  },

  // Berry Slash: Crisp Winter-Bell Ninja Action Rhythm
  'gift-slash': {
    bpm: 152,
    melody: [
      81, 76, 74, 72, 74, 76, 79, 76,
      81, 83, 84, 83, 79, 76, 74, 76,
      81, 76, 84, 81, 79, 76, 74, 72,
      74, 76, 79, 81, 83, 79, 81, 0,
    ],
    bass: [
      45, 45, 52, 0, 45, 45, 52, 0,
      48, 48, 55, 0, 50, 50, 52, 0,
      45, 45, 52, 0, 53, 53, 55, 0,
      50, 50, 52, 0, 45, 0, 45, 0,
    ],
    sleigh: [1, 0, 1, 1, 0, 1, 1, 0],
    leadWave: 'triangle',
    leadGain: 0.046,
    bassGain: 0.038,
  },

  // Candy Match: Bubbly Candy-Shop Celesta ("Deck the Halls" Remix)
  'candy-match': {
    bpm: 128,
    melody: [
      79, 0, 77, 76, 74, 0, 72, 0,
      74, 0, 76, 0, 72, 76, 79, 0,
      74, 76, 77, 74, 76, 0, 74, 72,
      71, 0, 74, 0, 72, 79, 84, 0,
      74, 0, 76, 77, 74, 0, 76, 77,
      79, 76, 81, 79, 78, 0, 79, 0,
      84, 0, 81, 79, 77, 0, 76, 0,
      74, 76, 77, 74, 72, 0, 0, 0,
    ],
    bass: [
      48, 0, 55, 0, 50, 0, 55, 0,
      52, 0, 55, 0, 48, 0, 55, 0,
      50, 0, 55, 0, 48, 0, 52, 0,
      55, 0, 50, 0, 48, 0, 55, 0,
      50, 0, 55, 0, 50, 0, 55, 0,
      52, 0, 57, 0, 50, 0, 55, 0,
      48, 0, 53, 0, 52, 0, 48, 0,
      50, 0, 55, 0, 48, 0, 0, 0,
    ],
    sleigh: [1, 0, 0, 1, 1, 0, 0, 1],
    leadWave: 'sine',
    leadGain: 0.05,
    bassGain: 0.034,
  },

  // Victory Stage: Triumphant "Joy to the World" Champion Chorus
  victory: {
    bpm: 126,
    melody: [
      84, 0, 83, 81, 79, 0, 0, 77,
      76, 0, 74, 0, 72, 0, 0, 79,
      81, 0, 0, 81, 83, 0, 0, 83,
      84, 0, 0, 84, 84, 83, 81, 79,
      79, 77, 76, 84, 84, 83, 81, 79,
      79, 77, 76, 76, 76, 76, 76, 77,
      79, 0, 0, 77, 76, 74, 74, 76,
      77, 0, 0, 76, 74, 72, 84, 0,
    ],
    bass: [
      48, 0, 55, 0, 48, 0, 53, 0,
      48, 0, 55, 0, 48, 0, 55, 0,
      53, 0, 57, 0, 55, 0, 59, 0,
      48, 0, 55, 0, 48, 0, 52, 0,
      53, 0, 48, 0, 53, 0, 48, 0,
      53, 0, 48, 0, 55, 0, 55, 0,
      48, 0, 55, 0, 50, 0, 55, 0,
      53, 0, 55, 0, 48, 0, 48, 0,
    ],
    sleigh: [1, 0, 1, 0, 1, 0, 1, 0],
    leadWave: 'triangle',
    leadGain: 0.048,
    bassGain: 0.036,
  },
};

const MUTE_STORAGE_KEY = 'xmas-arcade-muted';

function loadInitialMute(): boolean {
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      return window.sessionStorage.getItem(MUTE_STORAGE_KEY) === '1';
    }
  } catch {
    // Ignore restricted storage
  }
  return false;
}

let audioCtx: AudioContext | null = null;
let musicBus: GainNode | null = null;
let noiseBuffer: AudioBuffer | null = null;
let muted = loadInitialMute();
let currentScene: MusicScene = 'none';
let stepIndex = 0;
let nextStepTime = 0;
let schedulerId: number | null = null;
let listenersBound = false;

function midiToFreq(midi: number): number {
  return 440 * 2 ** ((midi - 69) / 12);
}

function bindLifecycleListeners(): void {
  if (listenersBound || typeof window === 'undefined') return;
  listenersBound = true;

  const unlockOnGesture = () => {
    if (muted || currentScene === 'none') return;
    const ctx = ensureAudioContext();
    if (ctx && schedulerId === null) {
      startScheduler();
    }
  };

  window.addEventListener('pointerdown', unlockOnGesture, { passive: true });
  window.addEventListener('keydown', unlockOnGesture, { passive: true });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      stopScheduler();
      if (audioCtx && audioCtx.state === 'running') {
        void audioCtx.suspend().catch(() => {});
      }
    } else if (!muted && currentScene !== 'none') {
      const ctx = ensureAudioContext();
      if (ctx) {
        startScheduler();
      }
    }
  });
}

function ensureAudioContext(): AudioContext | null {
  if (muted || typeof window === 'undefined') return null;
  try {
    if (!audioCtx) {
      const Ctor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      audioCtx = new Ctor();
      audioCtx.addEventListener('statechange', () => {
        if (audioCtx?.state === 'running' && !muted && currentScene !== 'none' && schedulerId === null) {
          nextStepTime = audioCtx.currentTime + 0.04;
          startScheduler();
        }
      });
    }
    if (!musicBus && audioCtx) {
      musicBus = audioCtx.createGain();
      musicBus.gain.setValueAtTime(muted ? 0 : 0.9, audioCtx.currentTime);
      musicBus.connect(audioCtx.destination);
    }
    if (audioCtx.state === 'suspended') {
      void audioCtx.resume().catch(() => {});
    }
    return audioCtx;
  } catch {
    return null;
  }
}

function getNoiseBuffer(ctx: AudioContext): AudioBuffer {
  if (noiseBuffer && noiseBuffer.sampleRate === ctx.sampleRate) {
    return noiseBuffer;
  }
  const length = Math.max(1, Math.floor(ctx.sampleRate * 0.06));
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const channel = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) {
    channel[i] = (Math.random() * 2 - 1) * (1 - i / length);
  }
  noiseBuffer = buffer;
  return buffer;
}

function scheduleCelestaNote(
  ctx: AudioContext,
  dest: AudioNode,
  freq: number,
  when: number,
  duration: number,
  wave: OscillatorType,
  peakGain: number
): void {
  const osc = ctx.createOscillator();
  const overtone = ctx.createOscillator();
  const env = ctx.createGain();
  const overtoneGain = ctx.createGain();

  osc.type = wave;
  osc.frequency.setValueAtTime(freq, when);

  overtone.type = 'sine';
  overtone.frequency.setValueAtTime(freq * 2, when);
  overtoneGain.gain.setValueAtTime(0.22, when);

  env.gain.setValueAtTime(0.0001, when);
  env.gain.linearRampToValueAtTime(peakGain, when + 0.012);
  env.gain.exponentialRampToValueAtTime(0.0008, when + duration);

  osc.connect(env);
  overtone.connect(overtoneGain);
  overtoneGain.connect(env);
  env.connect(dest);

  osc.start(when);
  overtone.start(when);
  osc.stop(when + duration + 0.02);
  overtone.stop(when + duration + 0.02);
}

function scheduleBassNote(
  ctx: AudioContext,
  dest: AudioNode,
  freq: number,
  when: number,
  duration: number,
  peakGain: number
): void {
  const osc = ctx.createOscillator();
  const env = ctx.createGain();

  osc.type = 'triangle';
  osc.frequency.setValueAtTime(freq, when);

  env.gain.setValueAtTime(0.0001, when);
  env.gain.linearRampToValueAtTime(peakGain, when + 0.015);
  env.gain.exponentialRampToValueAtTime(0.0008, when + duration);

  osc.connect(env);
  env.connect(dest);
  osc.start(when);
  osc.stop(when + duration + 0.02);
}

function scheduleSleighShimmer(ctx: AudioContext, dest: AudioNode, when: number): void {
  const src = ctx.createBufferSource();
  src.buffer = getNoiseBuffer(ctx);

  const filter = ctx.createBiquadFilter();
  filter.type = 'highpass';
  filter.frequency.setValueAtTime(5600, when);

  const env = ctx.createGain();
  env.gain.setValueAtTime(0.011, when);
  env.gain.exponentialRampToValueAtTime(0.0005, when + 0.05);

  src.connect(filter);
  filter.connect(env);
  env.connect(dest);
  src.start(when);
  src.stop(when + 0.055);
}

let lastObservedAudioTime = -1;
let stationaryAudioTicks = 0;

function scheduleNextTick(delayMs: number): void {
  if (typeof window === 'undefined' || muted || currentScene === 'none') return;
  if (schedulerId !== null) {
    window.clearTimeout(schedulerId);
  }
  schedulerId = window.setTimeout(() => {
    schedulerId = null;
    tickScheduler();
  }, delayMs);
}

function tickScheduler(): void {
  if (muted || currentScene === 'none' || !audioCtx || !musicBus) return;
  if (typeof document !== 'undefined' && document.hidden) return;
  if (audioCtx.state !== 'running') {
    // Wait for statechange / user gesture rather than polling while suspended
    return;
  }

  const nowAudio = audioCtx.currentTime;
  if (nowAudio === lastObservedAudioTime) {
    stationaryAudioTicks += 1;
  } else {
    lastObservedAudioTime = nowAudio;
    stationaryAudioTicks = 0;
  }

  const track = TRACKS[currentScene];
  const stepDur = 60 / track.bpm / 2; // 8th-note step in seconds
  const horizon = nowAudio + 0.55;

  if (nextStepTime < nowAudio) {
    nextStepTime = nowAudio + 0.03;
  }

  let scheduledCount = 0;
  while (nextStepTime < horizon && scheduledCount < 10) {
    const mNote = track.melody[stepIndex % track.melody.length];
    const bNote = track.bass[stepIndex % track.bass.length];
    const sHit = track.sleigh ? track.sleigh[stepIndex % track.sleigh.length] : 0;

    if (mNote > 0) {
      let holdSteps = 1;
      while (
        holdSteps < 3 &&
        track.melody[(stepIndex + holdSteps) % track.melody.length] === 0
      ) {
        holdSteps += 1;
      }
      scheduleCelestaNote(
        audioCtx,
        musicBus,
        midiToFreq(mNote),
        nextStepTime,
        stepDur * holdSteps * 0.92,
        track.leadWave,
        track.leadGain
      );
    }

    if (bNote > 0) {
      scheduleBassNote(
        audioCtx,
        musicBus,
        midiToFreq(bNote),
        nextStepTime,
        stepDur * 1.5,
        track.bassGain
      );
    }

    if (sHit > 0) {
      scheduleSleighShimmer(audioCtx, musicBus, nextStepTime);
    }

    nextStepTime += stepDur;
    stepIndex += 1;
    scheduledCount += 1;
  }

  // Standard 220ms lookahead cadence when hardware audio clock is moving; gentle backoff if stalled
  scheduleNextTick(stationaryAudioTicks >= 2 ? 2000 : 220);
}

function startScheduler(): void {
  if (typeof window === 'undefined' || muted || currentScene === 'none') return;
  if (schedulerId !== null) return;
  if (!audioCtx || audioCtx.state !== 'running') return;
  lastObservedAudioTime = -1;
  stationaryAudioTicks = 0;
  if (nextStepTime < audioCtx.currentTime) {
    nextStepTime = audioCtx.currentTime + 0.05;
  }
  tickScheduler();
}

function stopScheduler(): void {
  if (schedulerId !== null && typeof window !== 'undefined') {
    window.clearTimeout(schedulerId);
    schedulerId = null;
  }
}

export function isSoundMuted(): boolean {
  return muted;
}

export function getMusicScene(): MusicScene {
  return currentScene;
}

export function setMusicScene(scene: MusicScene): void {
  bindLifecycleListeners();
  if (currentScene === scene) {
    if (!muted && scene !== 'none' && schedulerId === null) {
      const ctx = ensureAudioContext();
      if (ctx && ctx.state === 'running') startScheduler();
    }
    return;
  }

  currentScene = scene;
  stepIndex = 0;
  stopScheduler();

  if (scene === 'none' || muted) {
    return;
  }

  const ctx = ensureAudioContext();
  if (ctx) {
    nextStepTime = ctx.currentTime + 0.06;
    if (ctx.state === 'running') {
      startScheduler();
    }
  }
}

export function toggleSoundMuted(): boolean {
  muted = !muted;
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      window.sessionStorage.setItem(MUTE_STORAGE_KEY, muted ? '1' : '0');
    }
  } catch {
    // Ignore storage errors
  }

  if (muted) {
    stopScheduler();
    if (audioCtx && musicBus) {
      const now = audioCtx.currentTime;
      musicBus.gain.cancelScheduledValues(now);
      musicBus.gain.setValueAtTime(0, now);
    }
  } else {
    const ctx = ensureAudioContext();
    if (ctx && musicBus) {
      const now = ctx.currentTime;
      musicBus.gain.cancelScheduledValues(now);
      musicBus.gain.setValueAtTime(0.9, now);
    }
    if (currentScene !== 'none') {
      startScheduler();
      playArcadeTone('tap');
    }
  }

  return muted;
}

export function triggerHaptic(pattern: number | number[] = 18): void {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(pattern);
    }
  } catch {
    // Ignore unsupported devices
  }
}

export function playArcadeTone(kind: 'pickup' | 'star' | 'hit' | 'tap' | 'win' | 'fanfare'): void {
  const ctx = ensureAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const playNote = (
    freq: number,
    startOffset: number,
    duration: number,
    type: OscillatorType = 'triangle',
    volume = 0.095
  ) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now + startOffset);
    gain.gain.setValueAtTime(volume, now + startOffset);
    gain.gain.exponentialRampToValueAtTime(0.001, now + startOffset + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now + startOffset);
    osc.stop(now + startOffset + duration);
  };

  switch (kind) {
    case 'pickup':
      playNote(587.33, 0, 0.09);
      playNote(880, 0.06, 0.11);
      break;
    case 'star':
      playNote(523.25, 0, 0.08);
      playNote(659.25, 0.06, 0.08);
      playNote(783.99, 0.12, 0.08);
      playNote(1046.5, 0.18, 0.18);
      break;
    case 'hit':
      playNote(190, 0, 0.14, 'sawtooth', 0.08);
      break;
    case 'tap':
      playNote(660, 0, 0.05, 'triangle', 0.075);
      break;
    case 'win':
      playNote(523.25, 0, 0.11);
      playNote(659.25, 0.1, 0.11);
      playNote(783.99, 0.2, 0.11);
      playNote(1046.5, 0.3, 0.28);
      break;
    case 'fanfare':
      playNote(523.25, 0, 0.11, 'triangle', 0.11);
      playNote(659.25, 0.09, 0.11, 'triangle', 0.11);
      playNote(783.99, 0.18, 0.13, 'triangle', 0.12);
      playNote(1046.5, 0.28, 0.48, 'triangle', 0.12);
      playNote(1318.5, 0.34, 0.44, 'sine', 0.08);
      playNote(1567.98, 0.4, 0.52, 'sine', 0.08);
      break;
  }
}

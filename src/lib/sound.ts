let audioCtx: AudioContext | null = null;
let muted = false;

export function isSoundMuted(): boolean {
  return muted;
}

export function toggleSoundMuted(): boolean {
  muted = !muted;
  return muted;
}

function getCtx(): AudioContext | null {
  if (muted || typeof window === 'undefined') return null;
  if (!audioCtx) {
    const Ctor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    audioCtx = new Ctor();
  }
  if (audioCtx.state === 'suspended') {
    void audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

export function triggerHaptic(ms = 18): void {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(ms);
    }
  } catch {
    // Ignore unsupported devices
  }
}

export function playArcadeTone(kind: 'pickup' | 'star' | 'hit' | 'tap' | 'win' | 'fanfare'): void {
  const ctx = getCtx();
  if (!ctx) return;

  const now = ctx.currentTime;
  const playNote = (
    freq: number,
    startOffset: number,
    duration: number,
    type: OscillatorType = 'triangle',
    volume = 0.09
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
      playNote(190, 0, 0.14, 'sawtooth');
      break;
    case 'tap':
      playNote(660, 0, 0.05);
      break;
    case 'win':
      playNote(523.25, 0, 0.11);
      playNote(659.25, 0.1, 0.11);
      playNote(783.99, 0.2, 0.11);
      playNote(1046.5, 0.3, 0.28);
      break;
    case 'fanfare':
      playNote(523.25, 0, 0.1, 'triangle', 0.1);
      playNote(659.25, 0.08, 0.1, 'triangle', 0.1);
      playNote(783.99, 0.16, 0.12, 'triangle', 0.11);
      playNote(1046.5, 0.25, 0.42, 'triangle', 0.11);
      playNote(1318.5, 0.31, 0.38, 'sine', 0.07);
      playNote(1567.98, 0.37, 0.45, 'sine', 0.07);
      break;
  }
}

/** Soft UI tones for P2P order alerts (Web Audio — no asset files). */

let ctx: AudioContext | null = null;
let unlocked = false;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    if (!ctx) {
      const AC =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    return ctx;
  } catch {
    return null;
  }
}

/** Call once from a user gesture so browsers allow later sounds. */
export function unlockP2pSounds() {
  const c = getCtx();
  if (!c) return;
  if (c.state === "suspended") void c.resume();
  unlocked = true;
}

function tone(
  freqs: number[],
  opts?: { duration?: number; gap?: number; type?: OscillatorType; volume?: number },
) {
  const c = getCtx();
  if (!c) return;
  if (c.state === "suspended") void c.resume();
  const duration = opts?.duration ?? 0.12;
  const gap = opts?.gap ?? 0.08;
  const type = opts?.type ?? "sine";
  const volume = opts?.volume ?? 0.08;
  const t0 = c.currentTime + 0.01;

  freqs.forEach((freq, i) => {
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, t0);
    const start = t0 + i * (duration + gap);
    gain.gain.exponentialRampToValueAtTime(volume, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(gain);
    gain.connect(c.destination);
    osc.start(start);
    osc.stop(start + duration + 0.02);
  });
}

export type P2pSoundKind = "order" | "paid" | "message" | "alert";

export function playP2pSound(kind: P2pSoundKind) {
  if (typeof window === "undefined") return;
  try {
    switch (kind) {
      case "order":
        // Two rising notes — new trade
        tone([660, 880], { duration: 0.14, gap: 0.06, type: "triangle", volume: 0.1 });
        break;
      case "paid":
        tone([520, 690, 880], { duration: 0.1, gap: 0.05, type: "sine", volume: 0.09 });
        break;
      case "message":
        tone([740], { duration: 0.09, type: "sine", volume: 0.07 });
        break;
      case "alert":
      default:
        tone([440, 440], { duration: 0.12, gap: 0.1, type: "square", volume: 0.06 });
        break;
    }
  } catch {
    /* ignore autoplay / AudioContext errors */
  }
}

export function ensureP2pSoundUnlockListeners() {
  if (typeof window === "undefined" || unlocked) return;
  const once = () => {
    unlockP2pSounds();
    window.removeEventListener("pointerdown", once);
    window.removeEventListener("keydown", once);
  };
  window.addEventListener("pointerdown", once, { once: true });
  window.addEventListener("keydown", once, { once: true });
}

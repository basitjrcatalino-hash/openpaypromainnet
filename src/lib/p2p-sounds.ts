/** Soft UI tones for wallet + P2P alerts (Web Audio — no asset files). Phantom-style chimes. */

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
export function unlockUiSounds() {
  const c = getCtx();
  if (!c) return;
  if (c.state === "suspended") void c.resume();
  unlocked = true;
}

/** @deprecated Prefer unlockUiSounds */
export const unlockP2pSounds = unlockUiSounds;

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

export type UiSoundKind =
  | "success"
  | "receive"
  | "send"
  | "swap"
  | "notify"
  | "order"
  | "paid"
  | "message"
  | "alert";

export type P2pSoundKind = Extract<UiSoundKind, "order" | "paid" | "message" | "alert">;

function soundsEnabled(): boolean {
  try {
    const raw = localStorage.getItem("openpay_sound_effects");
    if (raw === "0" || raw === "false") return false;
  } catch {
    /* ignore */
  }
  return true;
}

export function setSoundEffectsEnabled(on: boolean) {
  try {
    localStorage.setItem("openpay_sound_effects", on ? "1" : "0");
  } catch {
    /* ignore */
  }
}

export function getSoundEffectsEnabled(): boolean {
  return soundsEnabled();
}

export function playUiSound(kind: UiSoundKind) {
  if (typeof window === "undefined") return;
  if (!soundsEnabled()) return;
  try {
    switch (kind) {
      case "success":
      case "paid":
        // Rising triad — transaction done (Phantom-like confirm)
        tone([523.25, 659.25, 783.99], { duration: 0.11, gap: 0.05, type: "sine", volume: 0.1 });
        break;
      case "receive":
        tone([587.33, 880], { duration: 0.12, gap: 0.06, type: "sine", volume: 0.09 });
        break;
      case "send":
        tone([698.46, 523.25], { duration: 0.11, gap: 0.06, type: "triangle", volume: 0.08 });
        break;
      case "swap":
        tone([440, 554.37, 659.25], { duration: 0.09, gap: 0.045, type: "triangle", volume: 0.085 });
        break;
      case "notify":
      case "order":
        tone([660, 880], { duration: 0.14, gap: 0.06, type: "triangle", volume: 0.1 });
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

export function playP2pSound(kind: P2pSoundKind) {
  playUiSound(kind);
}

/** Shortcut for completed wallet actions. */
export function playSuccessSound() {
  playUiSound("success");
}

export function soundForTxType(type: string): UiSoundKind {
  const t = type.toLowerCase();
  if (t === "receive" || t === "buy" || t === "reward" || t === "deposit" || t === "topup") {
    return "receive";
  }
  if (t === "swap") return "swap";
  if (t === "send" || t === "sell" || t === "withdraw") return "send";
  if (t === "mint") return "success";
  return "notify";
}

export function ensureUiSoundUnlockListeners() {
  if (typeof window === "undefined" || unlocked) return;
  const once = () => {
    unlockUiSounds();
    window.removeEventListener("pointerdown", once);
    window.removeEventListener("keydown", once);
  };
  window.addEventListener("pointerdown", once, { once: true });
  window.addEventListener("keydown", once, { once: true });
}

/** @deprecated Prefer ensureUiSoundUnlockListeners */
export const ensureP2pSoundUnlockListeners = ensureUiSoundUnlockListeners;

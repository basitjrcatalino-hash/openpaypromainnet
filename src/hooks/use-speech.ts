import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

/** Strip markdown / symbols so TTS does not read formatting aloud. */
export function speechText(markdown: string) {
  return markdown
    .replace(/```[\s\S]*?```/g, " code block ")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/[*_>#|]/g, "")
    .replace(/\n{2,}/g, ". ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Browser SpeechSynthesis has practical utterance size limits — chunk long copy. */
function chunkForSpeech(text: string, maxLen = 220): string[] {
  const cleaned = text.trim();
  if (!cleaned) return [];
  if (cleaned.length <= maxLen) return [cleaned];

  const parts: string[] = [];
  let remaining = cleaned;
  while (remaining.length > maxLen) {
    let cut = remaining.lastIndexOf(". ", maxLen);
    if (cut < maxLen * 0.4) cut = remaining.lastIndexOf(" ", maxLen);
    if (cut < maxLen * 0.4) cut = maxLen;
    parts.push(remaining.slice(0, cut + 1).trim());
    remaining = remaining.slice(cut + 1).trim();
  }
  if (remaining) parts.push(remaining);
  return parts.filter(Boolean);
}

function pickLocalVoice(): SpeechSynthesisVoice | null {
  if (typeof window === "undefined" || !window.speechSynthesis) return null;
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return null;
  const prefer =
    voices.find((v) => /en(-|_)US/i.test(v.lang) && /Google|Microsoft|Samantha|Natural/i.test(v.name)) ||
    voices.find((v) => /^en/i.test(v.lang) && v.localService) ||
    voices.find((v) => /^en/i.test(v.lang)) ||
    voices[0];
  return prefer ?? null;
}

function ensureVoicesLoaded(): Promise<SpeechSynthesisVoice[]> {
  return new Promise((resolve) => {
    if (typeof window === "undefined" || !window.speechSynthesis) {
      resolve([]);
      return;
    }
    const syn = window.speechSynthesis;
    const existing = syn.getVoices();
    if (existing.length) {
      resolve(existing);
      return;
    }
    const onVoices = () => {
      syn.removeEventListener("voiceschanged", onVoices);
      resolve(syn.getVoices());
    };
    syn.addEventListener("voiceschanged", onVoices);
    // Some engines need a kick
    void syn.getVoices();
    window.setTimeout(() => {
      syn.removeEventListener("voiceschanged", onVoices);
      resolve(syn.getVoices());
    }, 500);
  });
}

/**
 * Local browser text-to-speech (Web Speech API).
 * Used across Wiki, Blog, Website, and OpenPay AI — no Lovable TTS credits required.
 */
export function useSpeech() {
  const cancelledRef = useRef(false);
  const activeIdRef = useRef<string | null>(null);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  function stop() {
    cancelledRef.current = true;
    activeIdRef.current = null;
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setSpeakingId(null);
    setLoadingId(null);
  }

  useEffect(() => {
    // Warm voices list on mount (Chrome loads async).
    void ensureVoicesLoaded();
    return () => {
      cancelledRef.current = true;
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  async function speakLocal(id: string, value: string) {
    if (typeof window === "undefined" || !window.speechSynthesis) {
      throw new Error("Text-to-speech is not supported in this browser");
    }

    await ensureVoicesLoaded();
    const voice = pickLocalVoice();
    const chunks = chunkForSpeech(value);
    if (!chunks.length) return;

    cancelledRef.current = false;
    activeIdRef.current = id;

    for (let i = 0; i < chunks.length; i++) {
      if (cancelledRef.current || activeIdRef.current !== id) return;

      await new Promise<void>((resolve, reject) => {
        const utterance = new SpeechSynthesisUtterance(chunks[i]);
        utterance.rate = 1;
        utterance.pitch = 1;
        utterance.volume = 1;
        if (voice) utterance.voice = voice;
        if (voice?.lang) utterance.lang = voice.lang;
        else utterance.lang = "en-US";

        // Chrome can freeze utterances mid-queue; nudge resume while this chunk plays.
        const keepAlive = window.setInterval(() => {
          if (cancelledRef.current || activeIdRef.current !== id) {
            window.clearInterval(keepAlive);
            return;
          }
          if (window.speechSynthesis.paused) window.speechSynthesis.resume();
        }, 8_000);
        const clear = () => window.clearInterval(keepAlive);

        utterance.onend = () => {
          clear();
          resolve();
        };
        utterance.onerror = (ev) => {
          clear();
          const err = (ev as SpeechSynthesisErrorEvent).error;
          if (err === "interrupted" || err === "canceled" || cancelledRef.current) {
            resolve();
            return;
          }
          reject(new Error(err || "Speech failed"));
        };

        window.speechSynthesis.speak(utterance);
      });
    }
  }

  async function speak(id: string, text: string) {
    if (speakingId === id || loadingId === id) {
      stop();
      return;
    }
    stop();
    const value = speechText(text);
    if (!value) return;

    setLoadingId(id);
    try {
      // Brief loading tick so UI can show preparing state, then speak locally.
      await Promise.resolve();
      setLoadingId(null);
      setSpeakingId(id);
      await speakLocal(id, value);
      if (activeIdRef.current === id && !cancelledRef.current) {
        setSpeakingId(null);
        activeIdRef.current = null;
      }
    } catch (e) {
      setLoadingId(null);
      setSpeakingId(null);
      activeIdRef.current = null;
      toast.error(e instanceof Error ? e.message : "Could not play audio");
    }
  }

  return { speak, stop, speakingId, loadingId };
}

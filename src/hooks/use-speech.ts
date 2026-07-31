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

/**
 * Same text-to-speech pipeline as OpenPay AI (`POST /api/tts`).
 * Pass any stable id (message id, guide slug) to track play / stop state.
 */
export function useSpeech() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  function stop() {
    audioRef.current?.pause();
    audioRef.current = null;
    setSpeakingId(null);
    setLoadingId(null);
  }

  useEffect(() => () => audioRef.current?.pause(), []);

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
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: value }),
      });
      if (!res.ok) throw new Error((await res.text()) || "Text-to-speech failed");
      const url = URL.createObjectURL(await res.blob());
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => {
        URL.revokeObjectURL(url);
        setSpeakingId(null);
      };
      await audio.play();
      setLoadingId(null);
      setSpeakingId(id);
    } catch (e) {
      setLoadingId(null);
      setSpeakingId(null);
      toast.error(e instanceof Error ? e.message : "Could not play audio");
    }
  }

  return { speak, stop, speakingId, loadingId };
}

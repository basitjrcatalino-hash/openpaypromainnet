import { useEffect, useRef } from "react";
import type { Html5QrcodeCameraScanConfig } from "html5-qrcode/esm/html5-qrcode";

export type Html5QrcodeLike = {
  isScanning: boolean;
  start: (
    camera: MediaTrackConstraints | string,
    config: Html5QrcodeCameraScanConfig | undefined,
    onSuccess: (decoded: string) => void,
    onFailure?: (err: string) => void,
  ) => Promise<null>;
  stop: () => Promise<void>;
  clear: () => void;
  scanFile: (file: File, showImage?: boolean) => Promise<string>;
  getRunningTrackCameraCapabilities: () => { torch?: unknown };
  applyVideoConstraints: (c: MediaTrackConstraints) => Promise<void>;
};

/** Adaptive qrbox so we never request a box larger than the video. */
export function buildQrScanConfig(): Html5QrcodeCameraScanConfig {
  return {
    fps: 10,
    qrbox: (viewW: number, viewH: number) => {
      const edge = Math.max(120, Math.floor(Math.min(viewW, viewH) * 0.7));
      return { width: edge, height: edge };
    },
  };
}

export async function stopQrInstance(instance: Html5QrcodeLike | null | undefined) {
  if (!instance) return;
  try {
    if (instance.isScanning) await instance.stop();
  } catch {
    // ignore — already stopped / mid-transition
  }
  try {
    instance.clear();
  } catch {
    // ignore clear races (common under React Strict Mode)
  }
}

type UseQrCameraArgs = {
  elementId: string;
  active: boolean;
  onResult: (text: string) => void;
  onError?: (message: string) => void;
  onReady?: (instance: Html5QrcodeLike) => void;
};

/** Shared Html5Qrcode lifecycle for Send dialog and /scan. */
export function useQrCamera({ elementId, active, onResult, onError, onReady }: UseQrCameraArgs) {
  const scannerRef = useRef<Html5QrcodeLike | null>(null);
  const handledRef = useRef(false);
  const onResultRef = useRef(onResult);
  const onErrorRef = useRef(onError);
  const onReadyRef = useRef(onReady);
  onResultRef.current = onResult;
  onErrorRef.current = onError;
  onReadyRef.current = onReady;

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    let instance: Html5QrcodeLike | null = null;
    handledRef.current = false;

    (async () => {
      let el: HTMLElement | null = null;
      for (let i = 0; i < 40; i++) {
        el = document.getElementById(elementId);
        if (el && (el.clientWidth > 0 || i > 4)) break;
        await new Promise((r) => setTimeout(r, 50));
        if (cancelled) return;
      }
      if (cancelled) return;

      el = document.getElementById(elementId);
      if (!el) {
        onErrorRef.current?.("Scanner element missing");
        return;
      }

      el.innerHTML = "";

      try {
        const { Html5Qrcode } = await import("html5-qrcode");
        if (cancelled) return;

        instance = new Html5Qrcode(elementId, { verbose: false }) as unknown as Html5QrcodeLike;
        scannerRef.current = instance;

        await instance.start(
          { facingMode: "environment" },
          buildQrScanConfig(),
          (decoded: string) => {
            if (cancelled || handledRef.current) return;
            handledRef.current = true;
            const text = decoded.trim();
            if (!text) {
              handledRef.current = false;
              return;
            }
            onResultRef.current(text);
          },
          () => undefined,
        );

        if (cancelled) {
          await stopQrInstance(instance);
          instance = null;
          return;
        }
        onReadyRef.current?.(instance);
      } catch (e) {
        if (!cancelled) {
          const msg = (e as Error).message || "Camera permission denied";
          if (/already.*scanner|paused|transition/i.test(msg)) return;
          onErrorRef.current?.(msg);
        }
      }
    })();

    return () => {
      cancelled = true;
      const inst = instance ?? scannerRef.current;
      scannerRef.current = null;
      instance = null;
      void stopQrInstance(inst);
    };
  }, [active, elementId]);

  return scannerRef;
}

export async function scanQrFromFile(file: File): Promise<string> {
  const { Html5Qrcode } = await import("html5-qrcode");
  const tmpId = "openpay-qr-file-reader";
  let holder = document.getElementById(tmpId);
  if (!holder) {
    holder = document.createElement("div");
    holder.id = tmpId;
    holder.style.display = "none";
    document.body.appendChild(holder);
  }
  holder.innerHTML = "";
  const reader = new Html5Qrcode(tmpId, { verbose: false }) as unknown as Html5QrcodeLike;
  try {
    const decoded = await reader.scanFile(file, true);
    return decoded.trim();
  } finally {
    await stopQrInstance(reader);
  }
}

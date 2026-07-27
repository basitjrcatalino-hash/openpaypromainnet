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

/** Full-frame scan — no library shaded box (we draw our own viewfinder). */
export function buildQrScanConfig(): Html5QrcodeCameraScanConfig {
  return {
    fps: 10,
    disableFlip: false,
  };
}

/** Make html5-qrcode's video fill its container instead of letterboxing. */
export function styleQrVideo(elementId: string) {
  const root = document.getElementById(elementId);
  if (!root) return;
  root.style.position = "relative";
  root.style.overflow = "hidden";

  const video = root.querySelector("video");
  if (video) {
    video.style.position = "absolute";
    video.style.inset = "0";
    video.style.width = "100%";
    video.style.height = "100%";
    video.style.maxWidth = "none";
    video.style.objectFit = "cover";
    video.style.objectPosition = "center";
  }

  // Hide library border shaders when present (we use a custom frame).
  const shaded = root.querySelector("#qr-shaded-region") as HTMLElement | null;
  if (shaded) shaded.style.display = "none";
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

async function listCameraConfigs(): Promise<Array<MediaTrackConstraints | string>> {
  const configs: Array<MediaTrackConstraints | string> = [
    { facingMode: { ideal: "environment" } },
    { facingMode: "environment" },
    { facingMode: "user" },
  ];

  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const cams = devices.filter((d) => d.kind === "videoinput" && d.deviceId);
    const back = cams.find((d) => /back|rear|environment/i.test(d.label));
    if (back) configs.unshift({ deviceId: { exact: back.deviceId } });
    else if (cams[0]) configs.push({ deviceId: { exact: cams[0].deviceId } });
  } catch {
    // ignore
  }

  // Cap attempts — permission denial fails the same way on every device.
  return configs.slice(0, 4);
}

async function startWithFallback(
  elementId: string,
  onSuccess: (decoded: string) => void,
): Promise<Html5QrcodeLike> {
  const { Html5Qrcode } = await import("html5-qrcode");
  const configs = await listCameraConfigs();
  let lastError: unknown;

  for (const camera of configs) {
    const root = document.getElementById(elementId);
    if (root) root.innerHTML = "";

    const instance = new Html5Qrcode(elementId, {
      verbose: false,
    }) as unknown as Html5QrcodeLike;

    try {
      await instance.start(camera, buildQrScanConfig(), onSuccess, () => undefined);
      return instance;
    } catch (err) {
      lastError = err;
      await stopQrInstance(instance);
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(typeof lastError === "string" ? lastError : "Camera permission denied");
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
      // Wait until the mount node has a real layout size (avoids 0×0 video).
      let el: HTMLElement | null = null;
      for (let i = 0; i < 60; i++) {
        el = document.getElementById(elementId);
        if (el && el.clientWidth > 0 && el.clientHeight > 0) break;
        await new Promise((r) => setTimeout(r, 50));
        if (cancelled) return;
      }
      if (cancelled) return;

      el = document.getElementById(elementId);
      if (!el || el.clientWidth <= 0 || el.clientHeight <= 0) {
        onErrorRef.current?.("Scanner element missing or not sized");
        return;
      }

      el.innerHTML = "";

      if (!navigator.mediaDevices?.getUserMedia) {
        onErrorRef.current?.("Camera not supported in this browser");
        return;
      }

      const onDecoded = (decoded: string) => {
        if (cancelled || handledRef.current) return;
        handledRef.current = true;
        const text = decoded.trim();
        if (!text) {
          handledRef.current = false;
          return;
        }
        onResultRef.current(text);
      };

      try {
        instance = await startWithFallback(elementId, onDecoded);

        if (cancelled) {
          await stopQrInstance(instance);
          instance = null;
          return;
        }

        scannerRef.current = instance;
        styleQrVideo(elementId);
        requestAnimationFrame(() => styleQrVideo(elementId));
        onReadyRef.current?.(instance);
      } catch (e) {
        if (cancelled) return;
        const msg = (e as Error).message || "Camera permission denied";
        // Strict Mode can interrupt mid-start; retry once after stop settles.
        if (/already.*scanner|paused|transition|NotReadable|AbortError/i.test(msg)) {
          await new Promise((r) => setTimeout(r, 300));
          if (cancelled) return;
          try {
            instance = await startWithFallback(elementId, onDecoded);
            if (cancelled) {
              await stopQrInstance(instance);
              return;
            }
            scannerRef.current = instance;
            styleQrVideo(elementId);
            onReadyRef.current?.(instance);
            return;
          } catch (retryErr) {
            onErrorRef.current?.(
              (retryErr as Error).message || "Camera permission denied",
            );
            return;
          }
        }
        onErrorRef.current?.(msg);
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

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import type { Html5QrcodeCameraScanConfig } from "html5-qrcode/esm/html5-qrcode";
import jsQR from "jsqr";

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

type BarcodeDetectorLike = {
  detect: (source: ImageBitmapSource) => Promise<Array<{ rawValue?: string }>>;
};

function getBarcodeDetector(): (new (opts?: { formats: string[] }) => BarcodeDetectorLike) | null {
  if (typeof window === "undefined") return null;
  const BD = (window as unknown as { BarcodeDetector?: new (opts?: { formats: string[] }) => BarcodeDetectorLike })
    .BarcodeDetector;
  return BD ?? null;
}

/** Full-frame scan — no library shaded box (we draw our own viewfinder). */
export function buildQrScanConfig(): Html5QrcodeCameraScanConfig {
  return {
    fps: 16,
    disableFlip: false,
    // Scan the full video frame — a small qrbox misses addresses on phones.
  };
}

/** Make html5-qrcode's video fill its container instead of letterboxing. */
export function styleQrVideo(elementId: string) {
  const root = document.getElementById(elementId);
  if (!root) return;
  root.style.position = "relative";
  root.style.overflow = "hidden";
  root.style.width = "100%";
  root.style.height = "100%";

  const video = root.querySelector("video");
  if (video) {
    video.setAttribute("playsinline", "true");
    video.setAttribute("webkit-playsinline", "true");
    video.muted = true;
    video.style.position = "absolute";
    video.style.inset = "0";
    video.style.width = "100%";
    video.style.height = "100%";
    video.style.maxWidth = "none";
    video.style.objectFit = "cover";
    video.style.objectPosition = "center";
  }

  const shaded = root.querySelector("#qr-shaded-region") as HTMLElement | null;
  if (shaded) shaded.style.display = "none";

  for (const el of root.querySelectorAll("img, canvas")) {
    (el as HTMLElement).style.display = "none";
  }
}

export async function stopQrInstance(instance: Html5QrcodeLike | null | undefined) {
  if (!instance) return;
  try {
    if (instance.isScanning) await instance.stop();
  } catch {
    /* ignore */
  }
  try {
    instance.clear();
  } catch {
    /* ignore */
  }
}

function stopMediaStream(stream: MediaStream | null | undefined) {
  if (!stream) return;
  for (const track of stream.getTracks()) {
    try {
      track.stop();
    } catch {
      /* ignore */
    }
  }
}

async function listCameraConfigs(): Promise<MediaTrackConstraints[]> {
  const configs: MediaTrackConstraints[] = [
    {
      facingMode: { ideal: "environment" },
      width: { ideal: 1920 },
      height: { ideal: 1080 },
    } as MediaTrackConstraints,
    { facingMode: "environment" },
    { facingMode: { ideal: "user" } },
    {},
  ];

  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const cams = devices.filter((d) => d.kind === "videoinput" && d.deviceId);
    const back = cams.find((d) => /back|rear|environment/i.test(d.label));
    if (back) configs.unshift({ deviceId: { exact: back.deviceId } });
    else if (cams[0]) configs.push({ deviceId: { exact: cams[0].deviceId } });
  } catch {
    /* ignore */
  }

  return configs.slice(0, 5);
}

/** Decode QR from a video frame via canvas + jsQR (handles screen moiré better than some BarcodeDetectors). */
function decodeQrFromVideo(video: HTMLVideoElement, canvas: HTMLCanvasElement): string | null {
  const attempts = [
    decodeQrRegion(video, canvas, 1),
    decodeQrRegion(video, canvas, 0.62),
    decodeQrRegion(video, canvas, 0.42),
  ];
  for (const text of attempts) {
    if (text) return text;
  }
  return null;
}

/** Sample full frame or a centered crop (viewfinder) — dense wallet QRs need the center pass. */
function decodeQrRegion(
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement,
  cropRatio: number,
): string | null {
  const image = sampleVideoFrame(video, canvas, cropRatio);
  if (!image) return null;
  const code = jsQR(image.data, image.width, image.height, {
    inversionAttempts: "attemptBoth",
  });
  const text = code?.data?.trim();
  return text || null;
}

function sampleVideoFrame(
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement,
  cropRatio = 1,
): ImageData | null {
  const w = video.videoWidth;
  const h = video.videoHeight;
  if (!w || !h) return null;

  const ratio = Math.min(1, Math.max(0.25, cropRatio));
  const srcW = Math.floor(w * ratio);
  const srcH = Math.floor(h * ratio);
  const sx = Math.floor((w - srcW) / 2);
  const sy = Math.floor((h - srcH) / 2);

  // Cap work size for mobile CPU while keeping enough detail for dense address QRs.
  const maxSide = ratio < 1 ? 720 : 1080;
  const scale = Math.min(1, maxSide / Math.max(srcW, srcH));
  const cw = Math.max(1, Math.floor(srcW * scale));
  const ch = Math.max(1, Math.floor(srcH * scale));
  if (canvas.width !== cw) canvas.width = cw;
  if (canvas.height !== ch) canvas.height = ch;

  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(video, sx, sy, srcW, srcH, 0, 0, cw, ch);
  return ctx.getImageData(0, 0, cw, ch);
}

/** Return the canvas after drawing the current video frame (for BarcodeDetector). */
function canvasFromVideo(video: HTMLVideoElement, canvas: HTMLCanvasElement): HTMLCanvasElement {
  sampleVideoFrame(video, canvas, 1);
  return canvas;
}

function canvasFromVideoCrop(
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement,
  cropRatio: number,
): HTMLCanvasElement {
  sampleVideoFrame(video, canvas, cropRatio);
  return canvas;
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
      const camArg: MediaTrackConstraints | string =
        Object.keys(camera).length === 0 ? { facingMode: "environment" } : camera;
      await instance.start(camArg, buildQrScanConfig(), onSuccess, () => undefined);
      styleQrVideo(elementId);
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

/** True when the app runs inside an iframe (preview/embed) that can block camera. */
export function isEmbeddedFrame(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

export function isInsecureContext(): boolean {
  if (typeof window === "undefined") return false;
  return !window.isSecureContext;
}

function friendlyCameraError(err: unknown): string {
  const name = err && typeof err === "object" && "name" in err ? String((err as { name: string }).name) : "";
  const msg = err instanceof Error ? err.message : String(err ?? "");
  if (isInsecureContext()) {
    return "Camera needs a secure (https) page. Open OpenPay Pro over https and try again.";
  }
  if (name === "NotAllowedError" || /permission|denied|NotAllowed/i.test(msg)) {
    return isEmbeddedFrame()
      ? "Camera is blocked inside this embedded preview. Open in a new tab, or scan a saved photo below."
      : "Camera access blocked. Allow camera permission in your browser settings, then tap Try again.";
  }
  if (name === "NotFoundError" || /not found|no camera/i.test(msg)) {
    return "No camera found on this device. Use Photos to scan a saved QR image.";
  }
  if (name === "NotReadableError" || /NotReadable|in use|AbortError/i.test(msg)) {
    return "Camera is in use by another app. Close it and try again.";
  }
  if (/secure|https|SecureContext/i.test(msg)) {
    return "Camera needs HTTPS (or localhost).";
  }
  return msg || "Camera permission denied";
}


type UseQrCameraArgs = {
  elementId: string;
  active: boolean;
  onResult: (text: string) => void;
  onError?: (message: string) => void;
  onReady?: (instance: Html5QrcodeLike) => void;
};

/** Shared Html5Qrcode lifecycle for Send dialog and /scan fallback. */
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
      for (let i = 0; i < 80; i++) {
        el = document.getElementById(elementId);
        if (el && el.clientWidth > 0 && el.clientHeight > 0) break;
        await new Promise((r) => setTimeout(r, 50));
        if (cancelled) return;
      }
      if (cancelled) return;

      el = document.getElementById(elementId);
      if (!el || el.clientWidth <= 0 || el.clientHeight <= 0) {
        // One more attempt with longer wait for late-layout cases
        await new Promise((r) => setTimeout(r, 500));
        if (cancelled) return;
        el = document.getElementById(elementId);
        if (!el || el.clientWidth <= 0 || el.clientHeight <= 0) {
          onErrorRef.current?.("Scanner view not ready. Tap Try again.");
          return;
        }
      }

      el.innerHTML = "";

      if (!navigator.mediaDevices?.getUserMedia) {
        onErrorRef.current?.("Camera not supported in this browser");
        return;
      }

      const onDecoded = (decoded: string) => {
        if (cancelled || handledRef.current) return;
        const text = decoded.trim();
        if (!text) return;
        handledRef.current = true;
        onResultRef.current(text);
      };

      try {
        // Do NOT warm-start+stop the camera — releasing then re-acquiring breaks
        // detection on many mobile browsers (especially Safari / in-app WebViews).
        if (cancelled) return;

        instance = await startWithFallback(elementId, onDecoded);

        if (cancelled) {
          await stopQrInstance(instance);
          instance = null;
          return;
        }

        scannerRef.current = instance;
        styleQrVideo(elementId);
        requestAnimationFrame(() => styleQrVideo(elementId));
        setTimeout(() => styleQrVideo(elementId), 200);
        onReadyRef.current?.(instance);
      } catch (e) {
        if (cancelled) return;
        const msg = friendlyCameraError(e);
        if (/already.*scanner|paused|transition|NotReadable|AbortError/i.test(msg)) {
          await new Promise((r) => setTimeout(r, 400));
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
            onErrorRef.current?.(friendlyCameraError(retryErr));
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

export type PhantomQrScannerControls = {
  starting: boolean;
  error: string | null;
  torchOn: boolean;
  torchSupported: boolean;
  mode: "native" | "fallback";
  toggleTorch: () => Promise<void>;
  restart: () => void;
  unlock: () => void;
};

/**
 * Phantom-style full-bleed camera scanner.
 * Prefers native BarcodeDetector + getUserMedia; falls back to html5-qrcode.
 */
export function usePhantomQrScanner({
  videoRef,
  fallbackElId,
  active,
  paused = false,
  onResult,
}: {
  videoRef: RefObject<HTMLVideoElement | null>;
  fallbackElId: string;
  active: boolean;
  /** Keep camera warm but stop decoding (e.g. My QR overlay). */
  paused?: boolean;
  onResult: (text: string) => void;
}): PhantomQrScannerControls {
  const [starting, setStarting] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [torchOn, setTorchOn] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);
  const [session, setSession] = useState(0);
  const [useFallback, setUseFallback] = useState(false);

  const streamRef = useRef<MediaStream | null>(null);
  const trackRef = useRef<MediaStreamTrack | null>(null);
  const handledRef = useRef(false);
  const nativeReadyRef = useRef(false);
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;

  const emit = useCallback((text: string) => {
    if (pausedRef.current) return;
    const t = text.trim();
    if (!t || handledRef.current) return;
    handledRef.current = true;
    onResultRef.current(t);
  }, []);

  const unlock = useCallback(() => {
    handledRef.current = false;
  }, []);

  const restart = useCallback(() => {
    handledRef.current = false;
    nativeReadyRef.current = false;
    setError(null);
    setStarting(true);
    setTorchOn(false);
    setTorchSupported(false);
    setSession((s) => s + 1);
  }, []);

  // Native path
  useEffect(() => {
    if (!active || useFallback) return;
    let cancelled = false;
    let raf = 0;
    handledRef.current = false;
    nativeReadyRef.current = false;

    const BD = getBarcodeDetector();
    if (!BD || !navigator.mediaDevices?.getUserMedia) {
      setUseFallback(true);
      return;
    }

    // Verify BarcodeDetector actually works (some browsers declare it but throw)
    try {
      const testDetector = new BD({ formats: ["qr_code"] });
      if (!testDetector || typeof testDetector.detect !== "function") {
        setUseFallback(true);
        return;
      }
    } catch {
      setUseFallback(true);
      return;
    }

    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          setUseFallback(true);
          return;
        }

        // Wait a couple frames so the <video> node is mounted & laid out.
        for (let i = 0; i < 20; i++) {
          if (videoRef.current) break;
          await new Promise((r) => requestAnimationFrame(() => r(undefined)));
          if (cancelled) return;
        }

        const configs = await listCameraConfigs();
        let stream: MediaStream | null = null;
        let lastErr: unknown;

        for (const cam of configs) {
          try {
            stream = await navigator.mediaDevices.getUserMedia({
              video: Object.keys(cam).length ? cam : true,
              audio: false,
            });
            break;
          } catch (e) {
            lastErr = e;
          }
        }

        if (!stream) throw lastErr ?? new Error("Camera permission denied");
        if (cancelled) {
          stopMediaStream(stream);
          return;
        }

        streamRef.current = stream;
        const track = stream.getVideoTracks()[0] ?? null;
        trackRef.current = track;

        try {
          const caps = track?.getCapabilities?.() as MediaTrackCapabilities & { torch?: boolean };
          setTorchSupported(Boolean(caps && "torch" in caps && caps.torch));
        } catch {
          setTorchSupported(false);
        }

        const video = videoRef.current;
        if (!video) {
          setUseFallback(true);
          stopMediaStream(stream);
          return;
        }

        video.srcObject = stream;
        video.setAttribute("playsinline", "true");
        video.setAttribute("webkit-playsinline", "true");
        video.muted = true;
        await video.play();

        if (cancelled) return;

        nativeReadyRef.current = true;
        setStarting(false);
        setError(null);

        const detector = new BD({ formats: ["qr_code"] });
        const canvas = document.createElement("canvas");
        let busy = false;
        let frame = 0;

        const tick = async () => {
          if (cancelled || handledRef.current) return;
          raf = requestAnimationFrame(() => {
            void tick();
          });
          if (pausedRef.current || busy || video.readyState < 2) return;
          busy = true;
          frame += 1;
          try {
            let value: string | undefined;

            // jsQR first on most frames — better for phone-screen receive QRs
            if (frame % 2 === 0) {
              value = decodeQrFromVideo(video, canvas) ?? undefined;
            }

            if (!value) {
              try {
                const codes = await detector.detect(canvasFromVideoCrop(video, canvas, 0.62));
                value = codes.find((c) => c.rawValue?.trim())?.rawValue?.trim();
              } catch {
                /* frame miss */
              }
            }

            if (!value && frame % 3 === 0) {
              try {
                const codes = await detector.detect(canvasFromVideo(video, canvas));
                value = codes.find((c) => c.rawValue?.trim())?.rawValue?.trim();
              } catch {
                /* ignore */
              }
            }

            if (!value && frame % 7 === 0) {
              try {
                const codes = await detector.detect(video);
                value = codes.find((c) => c.rawValue?.trim())?.rawValue?.trim();
              } catch {
                /* ignore */
              }
            }

            if (value) emit(value);
          } catch {
            /* frame miss */
          } finally {
            busy = false;
          }
        };
        raf = requestAnimationFrame(() => {
          void tick();
        });
      } catch (e) {
        if (cancelled) return;
        const name = e && typeof e === "object" && "name" in e ? String((e as { name: string }).name) : "";
        if (name === "NotAllowedError" || name === "SecurityError" || isInsecureContext()) {
          setError(friendlyCameraError(e));
          setStarting(false);
          return;
        }
        setUseFallback(true);
        setError(null);
        setStarting(true);
        console.warn("[scan] native camera failed, using fallback", e);
      }
    })();

    const timeout = setTimeout(() => {
      if (!cancelled && !nativeReadyRef.current) {
        setUseFallback(true);
        setStarting(true);
        setError(null);
      }
    }, 10000);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
      cancelAnimationFrame(raf);
      const video = videoRef.current;
      if (video) {
        video.srcObject = null;
      }
      stopMediaStream(streamRef.current);
      streamRef.current = null;
      trackRef.current = null;
    };
  }, [active, session, useFallback, videoRef, emit]);

  // html5-qrcode fallback path
  const fallbackScanner = useQrCamera({
    elementId: fallbackElId,
    active: active && useFallback,
    onResult: (text) => {
      if (pausedRef.current) return;
      emit(text);
    },
    onError: (message) => {
      setError(message);
      setStarting(false);
    },
    onReady: (instance) => {
      setError(null);
      setStarting(false);
      try {
        const caps = instance.getRunningTrackCameraCapabilities?.();
        setTorchSupported(Boolean(caps && "torch" in (caps as object)));
      } catch {
        setTorchSupported(false);
      }
    },
  });

  const toggleTorch = useCallback(async () => {
    const next = !torchOn;
    const track = trackRef.current;
    if (track) {
      try {
        await track.applyConstraints({
          advanced: [{ torch: next } as MediaTrackConstraintSet],
        });
        setTorchOn(next);
        return;
      } catch {
        /* try html5 path */
      }
    }
    const inst = fallbackScanner.current;
    if (inst?.applyVideoConstraints) {
      try {
        await inst.applyVideoConstraints({
          advanced: [{ torch: next } as MediaTrackConstraintSet],
        } as MediaTrackConstraints);
        setTorchOn(next);
        return;
      } catch {
        /* ignore */
      }
    }
    setError((e) => e ?? null);
  }, [torchOn, fallbackScanner]);

  return {
    starting,
    error,
    torchOn,
    torchSupported,
    mode: useFallback ? "fallback" : "native",
    toggleTorch,
    restart: () => {
      setUseFallback(false);
      restart();
    },
    unlock,
  };
}

export async function scanQrFromFile(file: File): Promise<string> {
  const BD = getBarcodeDetector();
  if (BD && typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file);
      try {
        const detector = new BD({ formats: ["qr_code"] });
        const codes = await detector.detect(bitmap);
        const value = codes.find((c) => c.rawValue?.trim())?.rawValue?.trim();
        if (value) return value;
      } finally {
        bitmap.close();
      }
    } catch {
      /* fall through */
    }
  }

  // jsQR path — reliable for screenshots / gallery photos
  try {
    const bitmap = await createImageBitmap(file);
    try {
      const canvas = document.createElement("canvas");
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (ctx) {
        ctx.drawImage(bitmap, 0, 0);
        const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(image.data, image.width, image.height, {
          inversionAttempts: "attemptBoth",
        });
        const value = code?.data?.trim();
        if (value) return value;
      }
    } finally {
      bitmap.close();
    }
  } catch {
    /* fall through */
  }

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

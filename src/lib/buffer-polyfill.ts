/**
 * Client-only Buffer polyfill for Phantom / Solana / wallet SDKs.
 *
 * Never static-import the npm `buffer` package from SSR entry points — CJS
 * `require` breaks Vite SSR. This module:
 *  1) Tries to load feross/buffer (several export shapes Vite may emit)
 *  2) Falls back to a Uint8Array-based Buffer that clears the __root stub
 *
 * Call only from browser useEffect / other client-only paths.
 */

type BufferLike = {
  from: (...args: unknown[]) => unknown;
  isBuffer?: (v: unknown) => boolean;
  alloc?: (...args: unknown[]) => unknown;
  allocUnsafe?: (...args: unknown[]) => unknown;
  concat?: (...args: unknown[]) => unknown;
  allocUnsafeSlow?: (...args: unknown[]) => unknown;
  byteLength?: (...args: unknown[]) => number;
  compare?: (...args: unknown[]) => number;
  prototype?: object;
  /** Set by the inline __root stub — means "upgrade me". */
  __openpayStub?: boolean | number;
  /** Lightweight early Buffer from __root — upgrade to Uint8Array fallback. */
  __openpayEarly?: boolean | number;
};

function hasBufferApi(v: unknown): v is BufferLike {
  if (!v || (typeof v !== "function" && typeof v !== "object")) return false;
  const b = v as BufferLike;
  return typeof b.from === "function";
}

function isRealBuffer(Buf: BufferLike | undefined | null): boolean {
  if (!Buf || typeof Buf.from !== "function") return false;
  if (Buf.__openpayStub || Buf.__openpayEarly) return false;
  return typeof Buf.allocUnsafe === "function" || typeof Buf.alloc === "function";
}

function pickBuffer(...candidates: unknown[]): BufferLike | null {
  for (const c of candidates) {
    if (!c) continue;
    if (hasBufferApi(c) && (typeof c.alloc === "function" || typeof c.allocUnsafe === "function")) {
      return c;
    }
    const nested = (c as { Buffer?: unknown }).Buffer;
    if (
      hasBufferApi(nested) &&
      (typeof nested.alloc === "function" ||
        typeof nested.allocUnsafe === "function" ||
        typeof nested.from === "function")
    ) {
      return nested;
    }
  }
  return null;
}

function installGlobals(Buf: BufferLike): void {
  const g = globalThis as typeof globalThis & {
    Buffer?: BufferLike;
    global?: typeof globalThis;
    process?: { env?: Record<string, string | undefined> };
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (g as any).Buffer = Buf;
  if (typeof window !== "undefined") {
    (window as unknown as { Buffer: BufferLike }).Buffer = Buf;
  }
  if (!g.global) g.global = g;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (!(g as any).process) (g as any).process = { env: {} };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  else if (!(g as any).process.env) (g as any).process.env = {};
}

function bytesFrom(value: unknown, encoding?: unknown): Uint8Array {
  if (typeof value === "string") {
    const enc = typeof encoding === "string" ? encoding.toLowerCase() : "utf8";
    if (enc === "base64" || enc === "base64url") {
      let s = enc === "base64url" ? value.replace(/-/g, "+").replace(/_/g, "/") : value;
      while (s.length % 4) s += "=";
      const bin = atob(s);
      const out = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
      return out;
    }
    if (enc === "hex") {
      const hex = value.length % 2 ? `0${value}` : value;
      const out = new Uint8Array(hex.length / 2);
      for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
      return out;
    }
    return new TextEncoder().encode(value);
  }
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (ArrayBuffer.isView(value)) {
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  }
  if (Array.isArray(value)) return Uint8Array.from(value as number[]);
  if (typeof value === "number") return new Uint8Array(value);
  return new Uint8Array(0);
}

function toHex(u8: Uint8Array): string {
  let s = "";
  for (let i = 0; i < u8.length; i++) s += u8[i]!.toString(16).padStart(2, "0");
  return s;
}

function toBase64(u8: Uint8Array): string {
  let s = "";
  for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]!);
  return btoa(s);
}

/**
 * Standalone browser Buffer — used when Vite's CJS `buffer` binding is empty
 * (`import("buffer")` → `{ default: undefined }` / `{ default: {} }`).
 */
function createFallbackBuffer(): BufferLike {
  class BrowserBuffer extends Uint8Array {
    static from(value: unknown, encodingOrOffset?: unknown, length?: unknown): BrowserBuffer {
      if (typeof value === "string") {
        return new BrowserBuffer(bytesFrom(value, encodingOrOffset));
      }
      if (typeof value === "number") {
        return BrowserBuffer.alloc(value);
      }
      if (value instanceof ArrayBuffer) {
        if (typeof encodingOrOffset === "number") {
          const offset = encodingOrOffset;
          const len = typeof length === "number" ? length : value.byteLength - offset;
          return new BrowserBuffer(value, offset, len);
        }
        return new BrowserBuffer(value);
      }
      return new BrowserBuffer(bytesFrom(value, encodingOrOffset));
    }

    static alloc(size: number, fill?: number | string, encoding?: string): BrowserBuffer {
      const buf = new BrowserBuffer(Math.max(0, size | 0));
      if (fill === undefined || fill === 0) return buf;
      if (typeof fill === "string") {
        const fillBytes = bytesFrom(fill, encoding || "utf8");
        if (fillBytes.length === 0) return buf;
        for (let i = 0; i < buf.length; i++) buf[i] = fillBytes[i % fillBytes.length]!;
        return buf;
      }
      buf.fill(fill as number);
      return buf;
    }

    static allocUnsafe(size: number): BrowserBuffer {
      return BrowserBuffer.alloc(size);
    }

    static allocUnsafeSlow(size: number): BrowserBuffer {
      return BrowserBuffer.alloc(size);
    }

    static concat(list: ArrayLike<Uint8Array>, totalLength?: number): BrowserBuffer {
      const items = Array.from(list || []);
      let n = totalLength;
      if (n === undefined) {
        n = 0;
        for (const item of items) n += item?.length || 0;
      }
      const out = BrowserBuffer.alloc(n);
      let offset = 0;
      for (const item of items) {
        if (!item?.length) continue;
        out.set(item, offset);
        offset += item.length;
        if (offset >= n) break;
      }
      return out;
    }

    static isBuffer(obj: unknown): boolean {
      return obj instanceof BrowserBuffer || (obj as { __isOpenPayBuffer?: boolean })?.__isOpenPayBuffer === true;
    }

    static byteLength(
      string: string | ArrayBufferView | ArrayBuffer,
      encoding?: string,
    ): number {
      if (typeof string !== "string") {
        if (string instanceof ArrayBuffer) return string.byteLength;
        if (ArrayBuffer.isView(string)) return string.byteLength;
        return 0;
      }
      return bytesFrom(string, encoding || "utf8").length;
    }

    static compare(a: Uint8Array, b: Uint8Array): number {
      const len = Math.min(a.length, b.length);
      for (let i = 0; i < len; i++) {
        if (a[i] !== b[i]) return a[i]! < b[i]! ? -1 : 1;
      }
      if (a.length === b.length) return 0;
      return a.length < b.length ? -1 : 1;
    }

    // Marker for isBuffer across realms / minifiers
    readonly __isOpenPayBuffer = true;

    override toString(encoding?: string): string {
      const enc = (encoding || "utf8").toLowerCase();
      if (enc === "hex") return toHex(this);
      if (enc === "base64") return toBase64(this);
      if (enc === "base64url") {
        return toBase64(this).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
      }
      return new TextDecoder().decode(this);
    }

    equals(other: Uint8Array): boolean {
      return BrowserBuffer.compare(this, other) === 0;
    }

    copy(
      target: Uint8Array,
      targetStart = 0,
      sourceStart = 0,
      sourceEnd = this.length,
    ): number {
      const start = Math.max(0, sourceStart | 0);
      const end = Math.min(this.length, sourceEnd | 0);
      const dest = Math.max(0, targetStart | 0);
      let written = 0;
      for (let i = start; i < end && dest + written < target.length; i++, written++) {
        target[dest + written] = this[i]!;
      }
      return written;
    }
  }

  // Match feross/buffer surface area used by wallet SDKs
  const Buf = BrowserBuffer as unknown as BufferLike;
  delete Buf.__openpayStub;
  return Buf;
}

async function tryLoadNpmBuffer(): Promise<BufferLike | null> {
  const loaders: Array<() => Promise<unknown>> = [
    () => import("buffer"),
    () => import("buffer/"),
  ];

  let lastKeys = "none";
  for (const load of loaders) {
    try {
      const mod = (await load()) as Record<string, unknown>;
      lastKeys = Object.keys(mod).join(", ") || "none";
      const Buf = pickBuffer(
        mod,
        mod.Buffer,
        mod.default,
        (mod.default as { Buffer?: unknown } | undefined)?.Buffer,
        (mod.default as { default?: unknown } | undefined)?.default,
        (mod.default as { default?: { Buffer?: unknown } } | undefined)?.default?.Buffer,
      );
      if (Buf && typeof Buf.from === "function") {
        try {
          delete Buf.__openpayStub;
        } catch {
          /* ignore */
        }
        return Buf;
      }
    } catch {
      /* try next */
    }
  }
  if (typeof console !== "undefined") {
    console.warn(`[buffer] npm package unusable (last exports: ${lastKeys}); using fallback Buffer`);
  }
  return null;
}

/**
 * Install a working `Buffer` on globalThis/window before Phantom/Solana load.
 * Always upgrades the __root stub — either to feross/buffer or our fallback.
 */
export async function ensureBuffer(): Promise<void> {
  if (typeof window === "undefined") return;

  const existing = (globalThis as { Buffer?: BufferLike }).Buffer;
  if (isRealBuffer(existing)) {
    installGlobals(existing!);
    return;
  }

  const fromNpm = await tryLoadNpmBuffer();
  const Buf = fromNpm || createFallbackBuffer();
  installGlobals(Buf);

  const installed = (globalThis as { Buffer?: BufferLike }).Buffer;
  if (typeof installed?.from !== "function") {
    throw new Error("Buffer.from is unavailable after polyfill install");
  }
  if (installed.__openpayStub) {
    // Last resort: replace stub in place
    installGlobals(createFallbackBuffer());
  }
}

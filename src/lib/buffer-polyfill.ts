/**
 * Client-only Buffer polyfill for Phantom / Solana / wallet SDKs.
 *
 * Prefer the Vite `buffer` shim (`src/shims/buffer.ts`) which re-exports feross/buffer.
 * This module installs globals for code that expects `globalThis.Buffer`.
 * Dynamic-import the shim so SSR never evaluates feross/buffer at module load.
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
  __openpayStub?: boolean | number;
  __openpayEarly?: boolean | number;
};

function isUsable(Buf: unknown): Buf is BufferLike {
  if (!Buf || (typeof Buf !== "function" && typeof Buf !== "object")) return false;
  const b = Buf as BufferLike;
  if (typeof b.from !== "function") return false;
  if (b.__openpayStub || b.__openpayEarly) return false;
  return typeof b.alloc === "function" || typeof b.allocUnsafe === "function";
}

/**
 * Install a working `Buffer` on globalThis/window before Phantom/Solana load.
 * Always upgrades the __root early stub.
 */
export async function ensureBuffer(): Promise<void> {
  if (typeof window === "undefined") return;

  const shim = await import("@/shims/buffer");
  shim.installBufferGlobal();

  const existing = (globalThis as { Buffer?: BufferLike }).Buffer;
  if (isUsable(existing)) {
    try {
      const probe = existing.from("openpay") as { toString?: (enc?: string) => string };
      if (typeof probe?.toString === "function" && probe.toString("utf8") === "openpay") {
        return;
      }
    } catch {
      /* fall through and reinstall */
    }
  }

  shim.installBufferGlobal();

  const installed = (globalThis as { Buffer?: BufferLike }).Buffer;
  if (!isUsable(installed) && isUsable(shim.Buffer)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).Buffer = shim.Buffer;
    (window as unknown as { Buffer: BufferLike }).Buffer = shim.Buffer as unknown as BufferLike;
  }

  const finalBuf = (globalThis as { Buffer?: BufferLike }).Buffer;
  if (!isUsable(finalBuf)) {
    throw new Error("Buffer.from is not available in this browser");
  }
}

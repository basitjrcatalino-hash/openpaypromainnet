/**
 * Stable browser Buffer for Vite / Phantom / Solana.
 *
 * Wallet SDKs use `import { Buffer } from "buffer"` — a globalThis polyfill alone
 * is not enough if the package interop yields `undefined`. This shim always
 * exports a working Buffer constructor (feross/buffer).
 *
 * Import the real package via the `feross-buffer` alias (see vite.config.ts) so
 * we never recurse through this shim.
 */
import { Buffer as FerossBuffer } from "feross-buffer";

type AnyBuffer = typeof FerossBuffer;

function hasApi(v: unknown): v is AnyBuffer {
  return (
    typeof v === "function" &&
    typeof (v as AnyBuffer).from === "function" &&
    typeof (v as AnyBuffer).alloc === "function"
  );
}

function pick(...candidates: unknown[]): AnyBuffer | null {
  for (const c of candidates) {
    if (hasApi(c)) return c;
    if (c && typeof c === "object") {
      const nested = (c as { Buffer?: unknown }).Buffer;
      if (hasApi(nested)) return nested;
    }
  }
  return null;
}

const Resolved =
  pick(FerossBuffer, (FerossBuffer as unknown as { default?: unknown })?.default) ?? FerossBuffer;

export const Buffer = Resolved;
export default { Buffer: Resolved };

/** Install on globalThis / window for libraries that expect a global. */
export function installBufferGlobal(): void {
  const g = globalThis as typeof globalThis & {
    Buffer?: AnyBuffer;
    global?: typeof globalThis;
    process?: { env?: Record<string, string | undefined> };
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (g as any).Buffer = Resolved;
  if (typeof window !== "undefined") {
    (window as unknown as { Buffer: AnyBuffer }).Buffer = Resolved;
  }
  if (!g.global) g.global = g;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (!(g as any).process) (g as any).process = { env: {} };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  else if (!(g as any).process.env) (g as any).process.env = {};
}

/**
 * Client-only Buffer polyfill for Phantom / @solana/web3.js.
 * Only call from browser useEffect / dynamic imports — never static-import this
 * module on the SSR graph (CJS `buffer` crashes Vite SSR with require is not defined).
 */

type BufferLike = {
  from: (...args: unknown[]) => unknown;
  isBuffer?: (v: unknown) => boolean;
  alloc?: (...args: unknown[]) => unknown;
  concat?: (...args: unknown[]) => unknown;
};

function resolveBufferExport(mod: Record<string, unknown>): BufferLike | null {
  const direct = mod.Buffer as BufferLike | undefined;
  if (typeof direct?.from === "function") return direct;

  const def = mod.default as BufferLike | { Buffer?: BufferLike } | undefined;
  if (def && typeof (def as BufferLike).from === "function") {
    return def as BufferLike;
  }
  if (def && typeof (def as { Buffer?: BufferLike }).Buffer?.from === "function") {
    return (def as { Buffer: BufferLike }).Buffer;
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

/**
 * Install a working `Buffer` on globalThis/window before Phantom/Solana load.
 * Throws if the polyfill cannot provide `Buffer.from`.
 */
export async function ensureBuffer(): Promise<void> {
  if (typeof window === "undefined") return;

  const existing = (globalThis as { Buffer?: BufferLike }).Buffer;
  if (typeof existing?.from === "function") {
    installGlobals(existing);
    return;
  }

  // Vite client resolve of CJS `buffer` — handle named + default export shapes.
  const mod = (await import("buffer")) as Record<string, unknown>;
  const Buf = resolveBufferExport(mod);
  if (!Buf) {
    throw new Error(
      `Buffer polyfill failed (exports: ${Object.keys(mod).join(", ") || "none"})`,
    );
  }

  installGlobals(Buf);

  if (typeof (globalThis as { Buffer?: BufferLike }).Buffer?.from !== "function") {
    throw new Error("Buffer.from is unavailable after polyfill install");
  }
}

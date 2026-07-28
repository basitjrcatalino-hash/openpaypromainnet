/**
 * Client-only Buffer polyfill for Phantom / @solana/web3.js.
 * Only call from browser useEffect / dynamic imports — never static-import this
 * module on the SSR graph (CJS `buffer` crashes Vite SSR with require is not defined).
 *
 * IMPORTANT: __root.tsx installs a minimal Buffer stub before paint. That stub
 * has `.from` but is incomplete for Phantom. We must always try to replace it
 * with the real `buffer` package — do not early-return just because `.from` exists.
 */

type BufferLike = {
  from: (...args: unknown[]) => unknown;
  isBuffer?: (v: unknown) => boolean;
  alloc?: (...args: unknown[]) => unknown;
  allocUnsafe?: (...args: unknown[]) => unknown;
  concat?: (...args: unknown[]) => unknown;
  prototype?: object;
  /** Set by the inline __root stub — means "upgrade me". */
  __openpayStub?: boolean | number;
};

function resolveBufferExport(mod: Record<string, unknown>): BufferLike | null {
  const direct = mod.Buffer as BufferLike | undefined;
  if (typeof direct?.from === "function" && typeof direct.alloc === "function") {
    return direct;
  }

  const def = mod.default as BufferLike | { Buffer?: BufferLike } | undefined;
  if (def && typeof (def as BufferLike).from === "function") {
    const asBuf = def as BufferLike;
    if (typeof asBuf.alloc === "function" || typeof asBuf.allocUnsafe === "function") {
      return asBuf;
    }
  }
  if (def && typeof (def as { Buffer?: BufferLike }).Buffer?.from === "function") {
    const nested = (def as { Buffer: BufferLike }).Buffer;
    if (typeof nested.alloc === "function" || typeof nested.from === "function") {
      return nested;
    }
  }

  // Some bundlers expose the constructor as the module itself.
  if (typeof (mod as unknown as BufferLike).from === "function") {
    return mod as unknown as BufferLike;
  }

  if (typeof direct?.from === "function") return direct;
  return null;
}

function isRealBuffer(Buf: BufferLike | undefined | null): boolean {
  if (!Buf || typeof Buf.from !== "function") return false;
  if (Buf.__openpayStub) return false;
  // Real feross/buffer exposes allocUnsafe + a proper prototype.
  return typeof Buf.allocUnsafe === "function" || typeof Buf.alloc === "function";
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
 * Always upgrades the __root stub to the real `buffer` package when possible.
 */
export async function ensureBuffer(): Promise<void> {
  if (typeof window === "undefined") return;

  const existing = (globalThis as { Buffer?: BufferLike }).Buffer;
  if (isRealBuffer(existing)) {
    installGlobals(existing!);
    return;
  }

  try {
    // Vite client resolve of CJS `buffer` — handle named + default export shapes.
    const mod = (await import("buffer")) as Record<string, unknown>;
    const Buf = resolveBufferExport(mod);
    if (!Buf || typeof Buf.from !== "function") {
      throw new Error(
        `Buffer polyfill failed (exports: ${Object.keys(mod).join(", ") || "none"})`,
      );
    }

    // Clear stub marker if somehow present on a real export.
    try {
      delete (Buf as BufferLike).__openpayStub;
    } catch {
      /* ignore */
    }

    installGlobals(Buf);
  } catch (err) {
    // Keep stub if present so auth UI can still degrade gracefully.
    if (typeof existing?.from === "function") {
      console.warn("[buffer] real package failed; keeping stub", err);
      installGlobals(existing);
      return;
    }
    throw err instanceof Error ? err : new Error(String(err));
  }

  const installed = (globalThis as { Buffer?: BufferLike }).Buffer;
  if (typeof installed?.from !== "function") {
    throw new Error("Buffer.from is unavailable after polyfill install");
  }
  if (!isRealBuffer(installed)) {
    console.warn(
      "[buffer] installed Buffer still looks like a stub — Phantom may fail. Retry after hard refresh.",
    );
  }
}

/**
 * Client-only Buffer polyfill for Phantom / @solana/web3.js.
 * Must NEVER be statically imported on the SSR graph — the `buffer` package is CJS
 * and crashes Vite SSR with: ReferenceError: require is not defined.
 */
export async function ensureBuffer(): Promise<void> {
  if (typeof window === "undefined") return;

  const g = globalThis as typeof globalThis & {
    Buffer?: { from: (...args: unknown[]) => unknown };
    global?: typeof globalThis;
    process?: { env?: Record<string, string | undefined> };
  };

  if (typeof g.Buffer?.from === "function") {
    if (!g.global) g.global = g;
    if (!g.process) g.process = { env: {} };
    else if (!g.process.env) g.process.env = {};
    return;
  }

  // @vite-ignore: keep CJS `buffer` out of the SSR dependency scanner
  const mod = await import(/* @vite-ignore */ "buffer");
  g.Buffer = mod.Buffer as typeof g.Buffer;
  if (!g.global) g.global = g;
  if (!g.process) g.process = { env: {} };
  else if (!g.process.env) g.process.env = {};
}

/**
 * Client-only Buffer polyfill for Phantom / @solana/web3.js.
 * Only call from browser useEffect / dynamic imports — never static-import this
 * module on the SSR graph (CJS `buffer` crashes Vite SSR with require is not defined).
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

  // Resolved by Vite for the client chunk (do NOT use @vite-ignore — that breaks
  // browser resolution and leaves Phantom stuck on "loading").
  const mod = await import("buffer");
  g.Buffer = mod.Buffer as typeof g.Buffer;
  if (!g.global) g.global = g;
  if (!g.process) g.process = { env: {} };
  else if (!g.process.env) g.process.env = {};
}

/**
 * Phantom / @solana/web3.js expect Node's Buffer in the browser.
 * Without this, production throws: Cannot read properties of undefined (reading 'from')
 * i.e. Buffer.from(...) when Buffer is undefined.
 */
import { Buffer } from "buffer";

const g = globalThis as typeof globalThis & {
  Buffer?: typeof Buffer;
  global?: typeof globalThis;
  process?: { env?: Record<string, string | undefined> };
};

if (!g.Buffer) g.Buffer = Buffer;
if (!g.global) g.global = g;
if (!g.process) g.process = { env: {} };
else if (!g.process.env) g.process.env = {};

export { Buffer };

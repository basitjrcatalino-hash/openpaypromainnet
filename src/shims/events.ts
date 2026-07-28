/**
 * ESM-safe shim for Node's `events` package.
 *
 * Vite/Rolldown CJS interop often wraps `module.exports = EventEmitter` as
 * `{ default: EventEmitter }` only. Web3Auth then does
 * `import { EventEmitter } from "events"` → undefined →
 * "Class extends value undefined is not a constructor or null".
 *
 * Alias `events` → this file in vite.config.ts. The real CJS file is imported
 * via `events-package` (also aliased) to avoid a circular resolve.
 */
import * as eventsNs from "events-package";

type EE = new (...args: unknown[]) => {
  on: (...args: unknown[]) => unknown;
  emit: (...args: unknown[]) => unknown;
};

function resolveEventEmitter(mod: unknown): EE | undefined {
  if (!mod) return undefined;
  if (typeof mod === "function") {
    const fn = mod as EE & { EventEmitter?: EE; prototype?: { on?: unknown } };
    if (typeof fn.prototype?.on === "function") return fn;
    if (typeof fn.EventEmitter === "function") return fn.EventEmitter;
  }
  if (typeof mod === "object") {
    const obj = mod as {
      EventEmitter?: unknown;
      default?: unknown;
    };
    if (typeof obj.EventEmitter === "function") {
      return obj.EventEmitter as EE;
    }
    if (obj.default !== undefined && obj.default !== mod) {
      return resolveEventEmitter(obj.default);
    }
  }
  return undefined;
}

const EventEmitter = resolveEventEmitter(eventsNs);

if (typeof EventEmitter !== "function") {
  throw new Error(
    `[events shim] EventEmitter missing (keys: ${Object.keys(eventsNs as object).join(", ") || "none"})`,
  );
}

const EE = EventEmitter as EE & {
  EventEmitter?: EE;
  once?: (...args: unknown[]) => unknown;
  defaultMaxListeners?: number;
};

if (typeof EE.EventEmitter !== "function") {
  EE.EventEmitter = EE;
}

export { EE as EventEmitter };
export default EE;
export const once = EE.once;

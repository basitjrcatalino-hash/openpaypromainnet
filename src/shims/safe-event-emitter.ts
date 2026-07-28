/**
 * Drop-in SafeEventEmitter for @web3auth/auth — always extends our pure ESM EventEmitter.
 * Avoids Vite CJS interop leaving `events.EventEmitter` undefined.
 */
import { EventEmitter } from "@/shims/events";

function safeApply(handler: (...args: unknown[]) => void, context: unknown, args: unknown[]) {
  try {
    Reflect.apply(handler, context, args);
  } catch (err) {
    setTimeout(() => {
      throw err;
    });
  }
}

function arrayClone<T>(arr: T[]): T[] {
  return arr.slice();
}

export class SafeEventEmitter extends EventEmitter {
  override emit(type: string | symbol, ...args: unknown[]) {
    let doError = type === "error";
    const events = (this as unknown as { _events?: Record<string | symbol, unknown> })._events;
    if (events !== undefined) {
      doError = Boolean(doError && events.error === undefined);
    } else if (!doError) {
      return false;
    }

    if (doError) {
      let er: unknown;
      if (args.length > 0) [er] = args;
      if (er instanceof Error) throw er;
      const err = new Error(
        `Unhandled error.${er ? ` (${(er as Error).message || String(er)})` : ""}`,
      ) as Error & { context?: unknown };
      err.context = er;
      throw err;
    }

    const handler = events?.[type];
    if (handler === undefined) return false;
    if (typeof handler === "function") {
      safeApply(handler as (...a: unknown[]) => void, this, args);
    } else {
      const listeners = arrayClone(handler as Array<(...a: unknown[]) => void>);
      for (const fn of listeners) safeApply(fn, this, args);
    }
    return true;
  }
}

export { SafeEventEmitter as default };

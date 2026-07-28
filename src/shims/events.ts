/**
 * Pure-ESM Node-compatible EventEmitter — no CJS `events` package.
 *
 * Web3Auth SafeEventEmitter does `import { EventEmitter } from "events"` then
 * `class SafeEventEmitter extends EventEmitter`. Vite/Rolldown CJS interop often
 * leaves the named export undefined → "Class extends value undefined…".
 *
 * Docs context: https://docs.metamask.io/embedded-wallets/authentication
 */

type Listener = (...args: unknown[]) => void;

export class EventEmitter {
  static defaultMaxListeners = 10;
  static EventEmitter = EventEmitter;

  private _events: Record<string | symbol, Listener | Listener[] | undefined> = Object.create(null);
  private _eventsCount = 0;
  private _maxListeners: number | undefined;

  setMaxListeners(n: number) {
    this._maxListeners = n;
    return this;
  }

  getMaxListeners() {
    return this._maxListeners ?? EventEmitter.defaultMaxListeners;
  }

  emit(type: string | symbol, ...args: unknown[]) {
    const handler = this._events[type];
    if (!handler) {
      if (type === "error") {
        const err = args[0];
        if (err instanceof Error) throw err;
        throw new Error(`Unhandled error.${err ? ` (${String(err)})` : ""}`);
      }
      return false;
    }
    if (typeof handler === "function") {
      Reflect.apply(handler, this, args);
    } else {
      for (const fn of handler.slice()) Reflect.apply(fn, this, args);
    }
    return true;
  }

  on(type: string | symbol, listener: Listener) {
    return this.addListener(type, listener);
  }

  addListener(type: string | symbol, listener: Listener) {
    if (typeof listener !== "function") {
      throw new TypeError('The "listener" argument must be of type Function');
    }
    const existing = this._events[type];
    if (!existing) {
      this._events[type] = listener;
      this._eventsCount += 1;
    } else if (typeof existing === "function") {
      this._events[type] = [existing, listener];
    } else {
      existing.push(listener);
    }
    return this;
  }

  once(type: string | symbol, listener: Listener) {
    const wrapped: Listener = (...args) => {
      this.off(type, wrapped);
      Reflect.apply(listener, this, args);
    };
    (wrapped as Listener & { listener?: Listener }).listener = listener;
    this.on(type, wrapped);
    return this;
  }

  off(type: string | symbol, listener: Listener) {
    return this.removeListener(type, listener);
  }

  removeListener(type: string | symbol, listener: Listener) {
    const existing = this._events[type];
    if (!existing) return this;
    if (typeof existing === "function") {
      if (
        existing === listener ||
        (existing as Listener & { listener?: Listener }).listener === listener
      ) {
        delete this._events[type];
        this._eventsCount -= 1;
      }
      return this;
    }
    const next = existing.filter(
      (fn) =>
        fn !== listener && (fn as Listener & { listener?: Listener }).listener !== listener,
    );
    if (next.length === 0) {
      delete this._events[type];
      this._eventsCount -= 1;
    } else if (next.length === 1) {
      this._events[type] = next[0];
    } else {
      this._events[type] = next;
    }
    return this;
  }

  removeAllListeners(type?: string | symbol) {
    if (type === undefined) {
      this._events = Object.create(null);
      this._eventsCount = 0;
      return this;
    }
    if (this._events[type]) {
      delete this._events[type];
      this._eventsCount = Math.max(0, this._eventsCount - 1);
    }
    return this;
  }

  listeners(type: string | symbol): Listener[] {
    const existing = this._events[type];
    if (!existing) return [];
    if (typeof existing === "function") return [existing];
    return existing.slice();
  }

  rawListeners(type: string | symbol): Listener[] {
    return this.listeners(type);
  }

  listenerCount(type: string | symbol) {
    return this.listeners(type).length;
  }

  prependListener(type: string | symbol, listener: Listener) {
    if (typeof listener !== "function") {
      throw new TypeError('The "listener" argument must be of type Function');
    }
    const existing = this._events[type];
    if (!existing) {
      this._events[type] = listener;
      this._eventsCount += 1;
    } else if (typeof existing === "function") {
      this._events[type] = [listener, existing];
    } else {
      existing.unshift(listener);
    }
    return this;
  }

  prependOnceListener(type: string | symbol, listener: Listener) {
    const wrapped: Listener = (...args) => {
      this.off(type, wrapped);
      Reflect.apply(listener, this, args);
    };
    (wrapped as Listener & { listener?: Listener }).listener = listener;
    this.prependListener(type, wrapped);
    return this;
  }

  eventNames(): Array<string | symbol> {
    return Reflect.ownKeys(this._events);
  }
}

EventEmitter.EventEmitter = EventEmitter;

export default EventEmitter;

export function once(
  emitter: EventEmitter,
  name: string | symbol,
): Promise<unknown[]> {
  return new Promise((resolve, reject) => {
    const onEvent = (...args: unknown[]) => {
      cleanup();
      resolve(args);
    };
    const onError = (err: unknown) => {
      cleanup();
      reject(err);
    };
    const cleanup = () => {
      emitter.off(name, onEvent);
      if (name !== "error") emitter.off("error", onError);
    };
    emitter.once(name, onEvent);
    if (name !== "error") emitter.once("error", onError);
  });
}

// Install on globalThis for any code that expects Node globals.
if (typeof globalThis !== "undefined") {
  const g = globalThis as typeof globalThis & { EventEmitter?: typeof EventEmitter };
  if (typeof g.EventEmitter !== "function") {
    g.EventEmitter = EventEmitter;
  }
}

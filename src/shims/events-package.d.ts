/**
 * Ambient module for the raw Node `events` CJS entry (vite alias target).
 */
declare module "events-package" {
  const EventEmitter: new (...args: unknown[]) => {
    on: (...args: unknown[]) => unknown;
    emit: (...args: unknown[]) => unknown;
  };
  export = EventEmitter;
}

/**
 * ESM-safe shim for `loglevel`.
 *
 * CJS loglevel is `module.exports = logger` (logger.levels is a property).
 * Packages like `@toruslabs/http-helpers` do `import { levels } from "loglevel"`,
 * which fails under Vite unless we re-export named bindings.
 */
import loglevelPkg from "loglevel-package";

type LogRoot = {
  levels: Record<string, number>;
  getLogger: (...args: unknown[]) => unknown;
  getLoggers?: (...args: unknown[]) => unknown;
  setLevel: (...args: unknown[]) => unknown;
  getLevel?: (...args: unknown[]) => unknown;
  enableAll?: (...args: unknown[]) => unknown;
  disableAll?: (...args: unknown[]) => unknown;
  noConflict?: (...args: unknown[]) => unknown;
  methodFactory?: unknown;
  default?: LogRoot;
  [key: string]: unknown;
};

function resolveLog(mod: unknown): LogRoot {
  if (!mod) throw new Error("[loglevel shim] package export missing");
  if (typeof mod === "function") {
    const fn = mod as unknown as LogRoot & { levels?: Record<string, number> };
    if (fn.levels && typeof fn.getLogger === "function") return fn;
  }
  if (typeof mod === "object") {
    const m = mod as LogRoot;
    if (m.levels && typeof m.getLogger === "function") return m;
    if (m.default) return resolveLog(m.default);
  }
  throw new Error("[loglevel shim] logger.levels missing");
}

const log = resolveLog(loglevelPkg);

export const levels = log.levels;
export const getLogger = log.getLogger.bind(log);
export const getLoggers = log.getLoggers?.bind(log);
export const setLevel = log.setLevel.bind(log);
export const getLevel = log.getLevel?.bind(log);
export const enableAll = log.enableAll?.bind(log);
export const disableAll = log.disableAll?.bind(log);
export const noConflict = log.noConflict?.bind(log);
export const methodFactory = log.methodFactory;

export default log;

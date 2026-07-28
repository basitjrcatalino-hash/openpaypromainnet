declare module "loglevel-package" {
  const log: {
    levels: Record<string, number>;
    getLogger: (...args: unknown[]) => unknown;
    setLevel: (...args: unknown[]) => unknown;
    default?: unknown;
    [key: string]: unknown;
  };
  export default log;
}

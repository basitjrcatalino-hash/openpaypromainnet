/**
 * Pure-ESM `json-stable-stringify` (no CJS).
 * Web3Auth / Torus import `import stringify from 'json-stable-stringify'`,
 * and Vite serves CJS without a `default` export when the graph is not prebundled.
 * Docs: https://docs.metamask.io/embedded-wallets/authentication
 */

type Cmp = (a: { key: string; value: unknown }, b: { key: string; value: unknown }) => number;

type Options = {
  space?: string | number;
  cycles?: boolean;
  replacer?: (key: string, value: unknown) => unknown;
  cmp?: Cmp;
  collapseEmpty?: boolean;
};

function cmpDefault(a: { key: string }, b: { key: string }) {
  return a.key < b.key ? -1 : a.key > b.key ? 1 : 0;
}

function stableStringify(obj: unknown, opts?: Options | Cmp): string {
  const options: Options = typeof opts === "function" ? { cmp: opts } : opts || {};
  const space =
    typeof options.space === "number"
      ? " ".repeat(options.space)
      : typeof options.space === "string"
        ? options.space
        : "";
  const cycles = Boolean(options.cycles);
  const cmp = options.cmp || cmpDefault;
  const seen = new WeakSet<object>();

  function stringify(node: unknown, level: number): string {
    if (node && typeof node === "object") {
      if (seen.has(node as object)) {
        if (cycles) return JSON.stringify("__cycle__");
        throw new TypeError("Converting circular structure to JSON");
      }
    }

    if (typeof node === "function") return undefined as unknown as string;
    if (node === undefined) return undefined as unknown as string;
    if (typeof node === "number") {
      return Number.isFinite(node) ? String(node) : "null";
    }
    if (typeof node !== "object" || node === null) {
      return JSON.stringify(node);
    }

    if (typeof (node as { toJSON?: () => unknown }).toJSON === "function") {
      return stringify((node as { toJSON: () => unknown }).toJSON(), level);
    }

    seen.add(node as object);

    const indent = space ? `\n${space.repeat(level)}` : "";
    const indentNext = space ? `\n${space.repeat(level + 1)}` : "";
    const colon = space ? ": " : ":";

    if (Array.isArray(node)) {
      if (node.length === 0) {
        seen.delete(node);
        return "[]";
      }
      const out: string[] = [];
      for (let i = 0; i < node.length; i++) {
        const v = stringify(node[i], level + 1);
        out.push(v === undefined ? "null" : v);
      }
      seen.delete(node);
      return `[${indentNext}${out.join(`,${indentNext}`)}${indent}]`;
    }

    const keys = Object.keys(node as object).sort((a, b) =>
      cmp(
        { key: a, value: (node as Record<string, unknown>)[a] },
        { key: b, value: (node as Record<string, unknown>)[b] },
      ),
    );
    if (keys.length === 0) {
      seen.delete(node as object);
      return "{}";
    }
    const parts: string[] = [];
    for (const key of keys) {
      const value = stringify((node as Record<string, unknown>)[key], level + 1);
      if (value === undefined) continue;
      parts.push(`${JSON.stringify(key)}${colon}${value}`);
    }
    seen.delete(node as object);
    if (parts.length === 0) return "{}";
    return `{${indentNext}${parts.join(`,${indentNext}`)}${indent}}`;
  }

  const result = stringify(obj, 0);
  return result === undefined ? undefined as unknown as string : result;
}

export default stableStringify;

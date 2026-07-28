/**
 * Self-contained `deepmerge` (no CJS) for Vite ESM.
 * @toruslabs/http-helpers does `import merge from 'deepmerge'`.
 * Raw `deepmerge/dist/cjs.js` fails: "does not provide an export named 'default'".
 */

type Options = {
  arrayMerge?: (target: unknown[], source: unknown[], options?: Options) => unknown[];
  isMergeableObject?: (value: unknown) => boolean;
  customMerge?: (key: string) => ((a: unknown, b: unknown) => unknown) | undefined;
  clone?: boolean;
};

function isNonNullObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function isSpecial(value: unknown): boolean {
  const tag = Object.prototype.toString.call(value);
  return tag === "[object RegExp]" || tag === "[object Date]";
}

function defaultIsMergeableObject(value: unknown): boolean {
  return isNonNullObject(value) && !isSpecial(value);
}

function emptyTarget(val: unknown): unknown[] | Record<string, unknown> {
  return Array.isArray(val) ? [] : {};
}

function cloneUnlessOtherwiseSpecified(value: unknown, options: Options): unknown {
  if (options.clone !== false && options.isMergeableObject?.(value)) {
    return deepmerge(emptyTarget(value), value, options);
  }
  return value;
}

function defaultArrayMerge(target: unknown[], source: unknown[], options?: Options): unknown[] {
  return target.concat(source).map((item) => cloneUnlessOtherwiseSpecified(item, options || {}));
}

function getMergeFunction(key: string, options: Options) {
  if (!options.customMerge) return deepmerge;
  const custom = options.customMerge(key);
  return typeof custom === "function" ? custom : deepmerge;
}

function getEnumerableOwnPropertySymbols(target: object): PropertyKey[] {
  return Object.getOwnPropertySymbols
    ? Object.getOwnPropertySymbols(target).filter((sym) =>
        Object.propertyIsEnumerable.call(target, sym),
      )
    : [];
}

function getKeys(target: object): PropertyKey[] {
  return [...Object.keys(target), ...getEnumerableOwnPropertySymbols(target)];
}

function propertyIsUnsafe(target: object, key: PropertyKey): boolean {
  try {
    return (
      key in target &&
      !(Object.hasOwnProperty.call(target, key) && Object.propertyIsEnumerable.call(target, key))
    );
  } catch {
    return true;
  }
}

function mergeObject(target: Record<string | symbol, unknown>, source: object, options: Options) {
  const destination: Record<string | symbol, unknown> = {};
  if (options.isMergeableObject?.(target)) {
    for (const key of getKeys(target)) {
      destination[key] = cloneUnlessOtherwiseSpecified(target[key], options);
    }
  }
  for (const key of getKeys(source)) {
    if (propertyIsUnsafe(target, key)) continue;
    const sourceVal = (source as Record<string | symbol, unknown>)[key];
    if (
      key in target &&
      options.isMergeableObject?.(sourceVal) &&
      options.isMergeableObject?.(target[key])
    ) {
      destination[key] = getMergeFunction(String(key), options)(target[key], sourceVal, options);
    } else {
      destination[key] = cloneUnlessOtherwiseSpecified(sourceVal, options);
    }
  }
  return destination;
}

function deepmerge(target: unknown, source: unknown, options?: Options): unknown {
  const opts: Options = { ...options };
  opts.arrayMerge = opts.arrayMerge || defaultArrayMerge;
  opts.isMergeableObject = opts.isMergeableObject || defaultIsMergeableObject;
  opts.clone ??= true;

  const sourceIsArray = Array.isArray(source);
  const targetIsArray = Array.isArray(target);
  if (sourceIsArray !== targetIsArray) {
    return cloneUnlessOtherwiseSpecified(source, opts);
  }
  if (sourceIsArray) {
    return opts.arrayMerge!(target as unknown[], source as unknown[], opts);
  }
  return mergeObject(
    target as Record<string | symbol, unknown>,
    source as object,
    opts,
  );
}

deepmerge.all = function deepmergeAll(array: unknown[], options?: Options) {
  if (!Array.isArray(array)) {
    throw new Error("first argument should be an array");
  }
  return array.reduce((prev, next) => deepmerge(prev, next, options), {});
};

export default deepmerge;
export const all = deepmerge.all;

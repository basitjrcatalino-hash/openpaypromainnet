import { beforeEach, describe, expect, it } from "vitest";
import { clearSignedOut, markSignedOut, wasSignedOut, withTimeout } from "./auth-session";

const store = new Map<string, string>();
beforeEach(() => {
  store.clear();
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  };
});

describe("sign-out memory", () => {
  it("after signing out, automatic sign-in is blocked until the next sign-in", () => {
    expect(wasSignedOut()).toBe(false);
    markSignedOut();
    expect(wasSignedOut()).toBe(true);
    clearSignedOut();
    expect(wasSignedOut()).toBe(false);
  });
});

describe("withTimeout", () => {
  it("rejects a sign-in that never answers instead of spinning forever", async () => {
    await expect(withTimeout(new Promise(() => {}), 20, "timed out")).rejects.toThrow("timed out");
  });
  it("passes through a sign-in that answers in time", async () => {
    await expect(withTimeout(Promise.resolve("ok"), 1000, "timed out")).resolves.toBe("ok");
  });
});

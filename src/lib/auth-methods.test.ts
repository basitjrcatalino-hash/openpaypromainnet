import { describe, expect, test } from "bun:test";
import { AUTH_METHOD_KEYS, fetchAuthMethodFlags } from "./auth-methods";

function client(data: unknown, error: unknown = null) {
  return { from: () => ({ select: async () => ({ data, error }) }) };
}

describe("admin sign-in visibility", () => {
  test("all existing sign-in methods are available in the catalog", () => {
    expect(AUTH_METHOD_KEYS).toEqual(["openpay", "phantom", "solana", "walletconnect", "metamask", "pi", "telegram", "email", "privy"]);
  });
  test("every individual disabled method stays disabled", async () => {
    for (const method of AUTH_METHOD_KEYS) {
      const flags = await fetchAuthMethodFlags(client([{ method_key: method, enabled: false, maintenance_message: "Maintenance" }]));
      expect(flags[method]).toEqual({ enabled: false, message: "Maintenance" });
    }
  });
  test("every individual enabled method is available", async () => {
    const flags = await fetchAuthMethodFlags(client(AUTH_METHOD_KEYS.map(method_key => ({ method_key, enabled: true, maintenance_message: null }))));
    expect(AUTH_METHOD_KEYS.every(key => flags[key].enabled)).toBe(true);
  });
  test("failed settings read cannot restore disabled methods", async () => {
    await expect(fetchAuthMethodFlags(client(null, { message: "Connection unavailable" }))).rejects.toThrow("Connection unavailable");
  });
});
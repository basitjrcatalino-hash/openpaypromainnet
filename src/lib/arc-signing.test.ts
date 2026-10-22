import { test } from "node:test";
import assert from "node:assert/strict";
import type { EIP1193Provider } from "viem";
import { ensureArcMainnet, signArcAuthMessage } from "./arc-signing";

const address = "0x946b7a0f7f8e883ef56d92c9ce8c5c48458b79e2";
function fixture(initial: string, options: { refuse?: boolean; unknown?: boolean; reject?: boolean; changedAccount?: boolean } = {}) {
  let chain = initial;
  let added = false;
  const calls: Array<{ method: string; params?: unknown }> = [];
  const provider = { request: async ({ method, params }: { method: string; params?: unknown }) => {
    calls.push({ method, params });
    if (method === "eth_chainId") return chain;
    if (method === "wallet_switchEthereumChain") {
      if (options.reject) throw { code: 4001 };
      if (options.unknown && !added) throw { code: 4902 };
      if (!options.refuse) chain = "0x13b2";
      return null;
    }
    if (method === "wallet_addEthereumChain") { added = true; return null; }
    if (method === "eth_accounts") return [options.changedAccount ? "0x0000000000000000000000000000000000000001" : address];
    if (method === "personal_sign") {
      assert.equal(Number(chain), 5042);
      return `0x${"11".repeat(65)}`;
    }
    throw new Error(`Unexpected request: ${method}`);
  } } as EIP1193Provider;
  return { provider, calls };
}

test("sign-in switches Arc testnet to Mainnet 5042 before requesting a signature", async () => {
  const f = fixture("0x4cef52");
  await signArcAuthMessage(f.provider, address, "Sign in\nChain ID: 5042\nNonce: unique");
  assert.deepEqual(f.calls.map(c => c.method), ["eth_chainId", "wallet_switchEthereumChain", "eth_chainId", "eth_accounts", "personal_sign"]);
  assert.deepEqual(f.calls[1].params, [{ chainId: "0x13b2" }]);
});
test("unknown Arc network is added with Mainnet RPC and explorer only", async () => {
  const f = fixture("0x1", { unknown: true });
  await ensureArcMainnet(f.provider);
  assert.deepEqual(f.calls.find(c => c.method === "wallet_addEthereumChain")?.params, [{ chainId: "0x13b2", chainName: "Arc Mainnet", nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 }, rpcUrls: ["https://rpc.mainnet.arc.io"], blockExplorerUrls: ["https://explorer.arc.io"] }]);
});
test("wallet remaining on testnet cannot sign", async () => {
  const f = fixture("0x4cef52", { refuse: true });
  await assert.rejects(signArcAuthMessage(f.provider, address, "Chain ID: 5042"), /Arc Mainnet/);
  assert.equal(f.calls.some(c => c.method === "personal_sign"), false);
});
test("rejected network switch cannot fall back to another network", async () => {
  const f = fixture("0x1", { reject: true });
  await assert.rejects(signArcAuthMessage(f.provider, address, "Chain ID: 5042"));
  assert.equal(f.calls.some(c => c.method === "personal_sign"), false);
});
test("testnet challenge is rejected even on Mainnet", async () => {
  const f = fixture("0x13b2");
  await assert.rejects(signArcAuthMessage(f.provider, address, "Chain ID: 5042002"), /Mainnet challenge/);
  assert.equal(f.calls.length, 0);
});
test("changing wallet accounts blocks sign-in", async () => {
  const f = fixture("0x13b2", { changedAccount: true });
  await assert.rejects(signArcAuthMessage(f.provider, address, "Chain ID: 5042"), /account changed/);
  assert.equal(f.calls.some(c => c.method === "personal_sign"), false);
});
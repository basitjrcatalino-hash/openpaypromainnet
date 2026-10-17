import { z } from "zod";
import { ARC_CHAIN_ID, ARC_USDC_ADDRESS } from "./arc-network";
import { arcAddressSchema, arcPartnerBalance, arcPartnerNetworkSchema, arcTransferUnits, verifyArcPreparedTransfer } from "./openpay-arc";

const BASE = "https://upziebimwzsbmomxnwzm.supabase.co/functions/v1/partner-api";
export async function openPayArcRequest(path: string, body?: unknown, publicRead = false): Promise<unknown> {
  const key = process.env.OPENPAY_ARC_API_KEY;
  if (!publicRead && !key) throw new Error("OpenPay Arc connection is not configured.");
  const headers: Record<string, string> = { Accept: "application/json" };
  if (!publicRead && key) headers["X-OpenPay-Key"] = key;
  if (body) headers["Content-Type"] = "application/json";
  const response = await fetch(`${BASE}${path}`, { method: body ? "POST" : "GET", headers, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(20000) });
  if (!response.ok) {
    console.warn("OpenPay Arc request failed", response.status, path.split("?")[0]);
    throw new Error(response.status === 401 || response.status === 403 ? "OpenPay Arc connection was refused. Contact support." : "OpenPay Arc could not complete this request. Please try again.");
  }
  const result = await response.json();
  if (result?.error) throw new Error("OpenPay Arc could not complete this request.");
  return result;
}
export async function openPayArcNetwork() {
  const result = z.object({ networks: z.array(arcPartnerNetworkSchema) }).parse(await openPayArcRequest("/v1/networks", undefined, true));
  const mainnet = result.networks.find(network => network.chain_id === ARC_CHAIN_ID && !network.testnet);
  if (!mainnet || mainnet.usdc.toLowerCase() !== ARC_USDC_ADDRESS.toLowerCase() || mainnet.usdc_decimals !== 6) throw new Error("OpenPay Arc Mainnet is unavailable.");
  return mainnet;
}
export async function openPayArcSnapshot(address: string) {
  const network = await openPayArcNetwork();
  const query = new URLSearchParams({ chain_id: String(ARC_CHAIN_ID), address });
  const balance = z.object({ chain_id: z.literal(5042), address: arcAddressSchema, token_address: arcAddressSchema, balance: z.string(), decimals: z.literal(6) }).parse(await openPayArcRequest(`/v1/balance?${query}`));
  if (balance.address.toLowerCase() !== address.toLowerCase() || balance.token_address.toLowerCase() !== network.usdc.toLowerCase()) throw new Error("Unexpected wallet balance response.");
  let savings: { principal: string; interest: string; lockEndsAt: string } | null = null;
  let savingsUnavailable = false;
  if (network.savings) {
    try {
      const position = z.object({ chain_id: z.literal(5042), address: arcAddressSchema, principal: z.string().regex(/^\d+$/), interest: z.string().regex(/^\d+$/), lock_ends_at: z.string().regex(/^\d+$/) }).parse(await openPayArcRequest(`/v1/position?${query}`));
      if (position.address.toLowerCase() !== address.toLowerCase()) throw new Error("Unexpected position owner.");
      savings = { principal: arcPartnerBalance(position.principal, 6), interest: arcPartnerBalance(position.interest, 6), lockEndsAt: position.lock_ends_at };
    } catch { savingsUnavailable = true; }
  }
  return { network, balance: arcPartnerBalance(balance.balance, balance.decimals), savings, savingsUnavailable };
}
export async function prepareOpenPayArcTransfer(amount: string, recipient: string) {
  await openPayArcNetwork();
  const result = await openPayArcRequest("/v1/prepare", { chain_id: ARC_CHAIN_ID, operation: "transfer", to: recipient, amount: arcTransferUnits(amount) });
  return verifyArcPreparedTransfer(result, amount, recipient);
}
import { defineChain, isAddress, parseUnits } from "viem";

export const ARC_CHAIN_ID = 5042;
export const ARC_USDC_ADDRESS = "0x3600000000000000000000000000000000000000";
export const arcMainnet = defineChain({
  id: ARC_CHAIN_ID,
  name: "Arc Mainnet",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.mainnet.arc.io"] } },
  blockExplorers: { default: { name: "Arc Explorer", url: "https://explorer.arc.io" } },
});

export function validateArcPayment(amount: string, recipient?: string) {
  if (!/^\d+(\.\d{1,6})?$/.test(amount) || parseUnits(amount, 6) <= 0n) {
    throw new Error("Enter a positive USDC amount with up to six decimal places.");
  }
  if (recipient !== undefined && !isAddress(recipient)) throw new Error("Enter a valid EVM wallet address.");
  return amount;
}
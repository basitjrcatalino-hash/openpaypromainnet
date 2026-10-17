import { decodeFunctionData, erc20Abi, formatUnits, getAddress, parseUnits } from "viem";
import { z } from "zod";
import { ARC_CHAIN_ID, ARC_USDC_ADDRESS, validateArcPayment } from "./arc-network";

export const arcAddressSchema = z.string().regex(/^0x[\da-fA-F]{40}$/);
export const arcPartnerTransferSchema = z.object({ address: arcAddressSchema, recipient: arcAddressSchema, amount: z.string().max(80) });
export const arcPartnerNetworkSchema = z.object({ chain_id: z.number(), testnet: z.boolean(), usdc: arcAddressSchema, usdc_decimals: z.number(), checkout: arcAddressSchema.nullable(), savings: arcAddressSchema.nullable(), ousd: arcAddressSchema.nullable(), swap: arcAddressSchema.nullable(), subscriptions: arcAddressSchema.nullable() });
export const arcPreparedSchema = z.object({ operation: z.literal("transfer"), transaction: z.object({ to: arcAddressSchema, data: z.string().regex(/^0x[\da-fA-F]+$/), value: z.literal("0x0"), chainId: z.literal(5042) }), requires_wallet_signature: z.literal(true) });
export type ArcPreparedTransfer = z.infer<typeof arcPreparedSchema>;

export function arcTransferUnits(amount: string) {
  validateArcPayment(amount);
  return parseUnits(amount, 6).toString();
}
export function arcPartnerBalance(balance: string, decimals: number) {
  if (!/^\d+$/.test(balance) || decimals !== 6) throw new Error("Unexpected OpenPay Arc balance format.");
  return formatUnits(BigInt(balance), decimals);
}
export function verifyArcPreparedTransfer(input: unknown, amount: string, recipient: string): ArcPreparedTransfer {
  const prepared = arcPreparedSchema.parse(input);
  if (prepared.transaction.chainId !== ARC_CHAIN_ID || getAddress(prepared.transaction.to) !== getAddress(ARC_USDC_ADDRESS)) throw new Error("Unexpected transfer network or contract.");
  const decoded = decodeFunctionData({ abi: erc20Abi, data: prepared.transaction.data as `0x${string}` });
  if (decoded.functionName !== "transfer" || getAddress(decoded.args[0]) !== getAddress(recipient) || decoded.args[1].toString() !== arcTransferUnits(amount)) throw new Error("Prepared transfer does not match your recipient and amount.");
  return prepared;
}
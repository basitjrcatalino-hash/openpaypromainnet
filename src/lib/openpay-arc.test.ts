import { describe, expect, it } from "vitest";
import { encodeFunctionData, erc20Abi } from "viem";
import { arcPartnerBalance, arcTransferUnits, verifyArcPreparedTransfer } from "./openpay-arc";
const recipient = "0x13c4e6e84ac8f0443682ec9b42816eeaa2fc13b9";
const transfer = { operation: "transfer", transaction: { to: "0x3600000000000000000000000000000000000000", data: encodeFunctionData({ abi: erc20Abi, functionName: "transfer", args: [recipient, 10000n] }), value: "0x0", chainId: 5042 }, requires_wallet_signature: true };
describe("OpenPay Arc partner payments", () => {
  it("converts USDC to the API's six-decimal base units", () => expect(arcTransferUnits("0.01")).toBe("10000"));
  it("reads the verified API token balance in USDC", () => expect(arcPartnerBalance("1532625", 6)).toBe("1.532625"));
  it("requires mainnet rather than falling back to testnet", () => expect(() => verifyArcPreparedTransfer({ ...transfer, transaction: { ...transfer.transaction, chainId: 5042002 } }, "0.01", recipient)).toThrow());
  it("rejects changed amounts", () => expect(() => verifyArcPreparedTransfer(transfer, "1", recipient)).toThrow());
  it("rejects changed recipients", () => expect(() => verifyArcPreparedTransfer(transfer, "0.01", "0x0000000000000000000000000000000000000001")).toThrow());
  it("rejects other contracts", () => expect(() => verifyArcPreparedTransfer({ ...transfer, transaction: { ...transfer.transaction, to: recipient } }, "0.01", recipient)).toThrow());
  it("accepts exactly the approved unsigned transfer", () => expect(verifyArcPreparedTransfer(transfer, "0.01", recipient).requires_wallet_signature).toBe(true));
});
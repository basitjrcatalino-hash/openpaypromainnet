import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { arcMainnet, ARC_USDC_ADDRESS, validateArcPayment } from "./arc-network";

describe("Arc real funds and balance preservation", () => {
  test("real funds use Arc mainnet, not testnet", () => {
    assert.equal(arcMainnet.id, 5042);
    assert.equal(arcMainnet.rpcUrls.default.http[0], "https://rpc.mainnet.arc.io");
    assert.equal(arcMainnet.nativeCurrency.decimals, 18);
    assert.equal(ARC_USDC_ADDRESS, "0x3600000000000000000000000000000000000000");
  });
  test("USDC amounts must be positive and have at most six decimals", () => {
    assert.equal(validateArcPayment("25.000001"), "25.000001");
    for (const amount of ["0", "-1", "1.0000001", "NaN"]) assert.throws(() => validateArcPayment(amount));
  });
  test("recipient must be an EVM address, not a Pi address", () => {
    assert.throws(() => validateArcPayment("1", "GPIWALLET"));
    assert.equal(validateArcPayment("1", "0x0000000000000000000000000000000000000001"), "1");
  });
});
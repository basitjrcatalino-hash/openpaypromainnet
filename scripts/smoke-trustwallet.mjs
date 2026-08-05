/**
 * Smoke-test Trust Wallet HMAC + tickers (loads .env manually).
 */
import fs from "fs";
import { createHmac, randomUUID } from "crypto";

function loadEnv() {
  const raw = fs.readFileSync(".env", "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    if (!process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

loadEnv();

const accessId = process.env.TW_ACCESS_ID;
const secret = process.env.TW_HMAC_SECRET;
if (!accessId || !secret) {
  console.error("missing credentials");
  process.exit(1);
}

const method = "POST";
const path = "/v2/market/tickers";
const query = "";
const date = new Date().toUTCString();
const nonce = randomUUID();
const plaintext = [method, path, query, accessId, nonce, date].join(";");
const signature = createHmac("sha256", secret).update(plaintext).digest("base64");

const res = await fetch(`https://tws.trustwallet.com${path}`, {
  method,
  headers: {
    "X-TW-CREDENTIAL": accessId,
    "X-TW-NONCE": nonce,
    "X-TW-DATE": date,
    Authorization: `HMAC-SHA256 Signature=${signature}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ currency: "USD", assets: ["c60", "c0", "c501"] }),
});

const text = await res.text();
console.log("status", res.status);
console.log(text.slice(0, 500));

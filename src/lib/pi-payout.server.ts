/**
 * Server-only Pi blockchain (Stellar-compatible) OUSD payout helpers.
 * Docs: https://github.com/pi-apps/pi-platform-docs/blob/master/tokens.md
 */
import {
  Account,
  Asset,
  Keypair,
  Memo,
  Operation,
  TransactionBuilder,
} from "@stellar/stellar-base";

export const TOKEN_CODE = "OUSD";
export const DEFAULT_ISSUER = "GCMWN3DUKHBAGVVWL244J375UMWAS3UTNCWVQDBKWLQHGCPZQURK7U3L";
export const DEFAULT_HORIZON = "https://api.mainnet.minepi.com";
export const DEFAULT_PASSPHRASE = "Pi Network";

export const TRUSTLINE_MSG =
  "Add OpenUSD (OUSD) in Pi Wallet first: Tokens → enable OUSD issued by OpenPay, then try again.";
export const NO_LIQUIDITY_MSG =
  "OpenPay has no Pi-chain OUSD liquidity yet. Please try again later.";
export const MAINTENANCE_MSG =
  "Pi Wallet payout is under maintenance. Please try again shortly.";

export type PiPayoutConfig = {
  senderSecret: string;
  issuer: string;
  horizon: string;
  passphrase: string;
};

export function readPiPayoutConfig(): PiPayoutConfig | null {
  const senderSecret = (process.env["PI_OUSD_SENDER_SECRET"] || "").trim();
  if (!senderSecret.startsWith("S")) return null;
  return {
    senderSecret,
    issuer: (process.env["PI_OUSD_ISSUER_PUBLIC_KEY"] || DEFAULT_ISSUER).trim(),
    horizon: (process.env["PI_HORIZON_URL"] || DEFAULT_HORIZON).trim().replace(/\/$/, ""),
    passphrase: (process.env["PI_NETWORK_PASSPHRASE"] || DEFAULT_PASSPHRASE).trim(),
  };
}

type HorizonBalance = {
  balance?: string;
  asset_type?: string;
  asset_code?: string;
  asset_issuer?: string;
};
type HorizonAccount = { id: string; sequence: string; balances?: HorizonBalance[] };

export class PiPayoutError extends Error {}

async function horizonGet<T>(horizon: string, path: string): Promise<T> {
  const res = await fetch(`${horizon}${path}`, { headers: { accept: "application/json" } });
  const text = await res.text();
  let json: unknown = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* non-json */
  }
  if (!res.ok) throw new PiPayoutError(horizonErrorMessage(json, res.status));
  return json as T;
}

/** Map a Horizon error payload to a user-facing message. */
export function horizonErrorMessage(payload: unknown, status?: number): string {
  const anyErr = payload as
    | {
        detail?: string;
        title?: string;
        extras?: { result_codes?: { transaction?: string; operations?: string[] } };
      }
    | null;
  const codes = anyErr?.extras?.result_codes;
  const ops = Array.isArray(codes?.operations) ? codes!.operations!.join(" ") : "";
  const blob = `${anyErr?.title || ""} ${anyErr?.detail || ""} ${codes?.transaction || ""} ${ops} ${status || ""}`.toLowerCase();

  if (/op_no_trust|trustline|not_authorized|op_not_authorized/.test(blob)) return TRUSTLINE_MSG;
  if (/op_no_destination|404|resource missing|not found/.test(blob))
    return "That Pi Wallet is not activated on this network. Open it in Pi Wallet, then try again.";
  if (/op_underfunded|insufficient/.test(blob)) return MAINTENANCE_MSG;
  if (/op_line_full/.test(blob))
    return "The recipient's OUSD trustline is full. They need to raise the limit in Pi Wallet.";
  return MAINTENANCE_MSG;
}

function balanceOf(acc: HorizonAccount, code: string, issuer: string): number {
  return Number(
    (acc.balances || []).find((b) => b.asset_code === code && b.asset_issuer === issuer)?.balance ||
      0,
  );
}

function nativeBalance(acc: HorizonAccount): number {
  return Number((acc.balances || []).find((b) => b.asset_type === "native")?.balance || 0);
}

/**
 * Verify the destination is activated, has an OUSD trustline, and that the
 * payout wallet holds enough OUSD + native PI for fees. Throws PiPayoutError.
 */
export async function preflightPiPayout(cfg: PiPayoutConfig, dest: string, amount: number) {
  let sender: Keypair;
  try {
    sender = Keypair.fromSecret(cfg.senderSecret);
  } catch {
    throw new PiPayoutError(MAINTENANCE_MSG);
  }
  if (dest === sender.publicKey())
    throw new PiPayoutError("Cannot send OUSD to the OpenPay payout wallet.");

  const destAccount = await horizonGet<HorizonAccount>(cfg.horizon, `/accounts/${dest}`);
  const hasTrust = (destAccount.balances || []).some(
    (b) => b.asset_code === TOKEN_CODE && b.asset_issuer === cfg.issuer,
  );
  if (!hasTrust) throw new PiPayoutError(TRUSTLINE_MSG);

  const source = await horizonGet<HorizonAccount>(cfg.horizon, `/accounts/${sender.publicKey()}`);
  if (balanceOf(source, TOKEN_CODE, cfg.issuer) < amount)
    throw new PiPayoutError(NO_LIQUIDITY_MSG);
  if (nativeBalance(source) < 0.01) throw new PiPayoutError(MAINTENANCE_MSG);

  return { sender, source };
}

/** Build, sign and submit the OUSD payment on the Pi network. Returns the tx hash. */
export async function submitPiPayout(
  cfg: PiPayoutConfig,
  dest: string,
  amount: number,
  memo: string,
): Promise<string> {
  const sender = Keypair.fromSecret(cfg.senderSecret);
  const source = await horizonGet<HorizonAccount>(cfg.horizon, `/accounts/${sender.publicKey()}`);

  let baseFee = 100000;
  try {
    const ledgers = await horizonGet<{ _embedded?: { records?: Array<{ base_fee_in_stroops?: number }> } }>(
      cfg.horizon,
      "/ledgers?order=desc&limit=1",
    );
    const fee = ledgers?._embedded?.records?.[0]?.base_fee_in_stroops;
    if (Number.isFinite(fee) && Number(fee) > 0) baseFee = Number(fee);
  } catch {
    /* fall back to default fee */
  }

  const asset = new Asset(TOKEN_CODE, cfg.issuer);
  let builder = new TransactionBuilder(new Account(source.id, source.sequence), {
    fee: String(baseFee),
    networkPassphrase: cfg.passphrase,
  }).addOperation(
    Operation.payment({ destination: dest, asset, amount: amount.toFixed(2) }),
  );
  if (memo) builder = builder.addMemo(Memo.text(memo.slice(0, 28)));

  const tx = builder.setTimeout(90).build();
  tx.sign(sender);

  const res = await fetch(`${cfg.horizon}/transactions`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
    body: new URLSearchParams({ tx: tx.toXDR() }).toString(),
  });
  const text = await res.text();
  let json: Record<string, unknown> | null = null;
  try {
    json = JSON.parse(text) as Record<string, unknown>;
  } catch {
    /* non-json */
  }
  if (!res.ok) throw new PiPayoutError(horizonErrorMessage(json, res.status));
  const hash = String(json?.["hash"] || json?.["id"] || "");
  if (!hash) throw new PiPayoutError(MAINTENANCE_MSG);
  return hash;
}

/**
 * Expand ledger majors to cover all MAJOR_TOKENS (buy / hold / trade settlement).
 * Writes: SQL migration + ledger-majors patch fragments.
 */
import fs from "fs";

const majorSrc = fs.readFileSync("src/lib/major-tokens.ts", "utf8");
const ledgerSrc = fs.readFileSync("src/lib/ledger-majors.ts", "utf8");

const typeStart = majorSrc.indexOf("export type MajorTokenId");
const typeEnd = majorSrc.indexOf("export type MajorTokenDef");
const typeBlock = majorSrc.slice(typeStart, typeEnd);
const allIds = [...typeBlock.matchAll(/\| "([a-z0-9]+)"/g)].map((m) => m[1]);

const existing = new Set(
  [...ledgerSrc.matchAll(/^\s{2}([a-z0-9]+):\s*(?:BTC_SWAP_ID|[A-Z0-9_]+_SWAP_ID|"__)/gm)].map(
    (m) => m[1],
  ),
);
// More reliable: keys in LEDGER_MAJOR_SWAP_IDS object
const swapBlock = ledgerSrc.slice(
  ledgerSrc.indexOf("export const LEDGER_MAJOR_SWAP_IDS"),
  ledgerSrc.indexOf("export type LedgerMajorId"),
);
const existingIds = [...swapBlock.matchAll(/^\s{2}([a-z0-9]+):/gm)].map((m) => m[1]);
const have = new Set(existingIds);
const missing = allIds.filter((id) => !have.has(id));

console.log("all majors", allIds.length);
console.log("ledger now", have.size);
console.log("to add", missing.length);
console.log(missing.join(", "));

const constDecls = missing
  .map((id) => `export const ${id.toUpperCase()}_SWAP_ID = "__${id}__";`)
  .join("\n");

// Insert before LEDGER_MAJOR_SWAP_IDS closing - we'll rebuild swap object entries
const swapEntries = missing.map((id) => `  ${id}: ${id.toUpperCase()}_SWAP_ID,`).join("\n");

const balanceEntries = missing.map((id) => `  ${id}: "${id}_balance",`).join("\n");

const assetCodes = missing.map((id) => `  | "${id.toUpperCase()}"`).join("\n");

const assetCodeList = missing.map((id) => `  "${id.toUpperCase()}",`).join("\n");

const fallbackUsd = missing
  .map(
    (id) => `  ${id}: 0,`,
  )
  .join("\n");

const swapIdMap = missing
  .map((id) => `  [${id.toUpperCase()}_SWAP_ID]: "${id}",\n  ${id}: "${id}",`)
  .join("\n");

const sqlCols = missing
  .map(
    (id) =>
      `  ADD COLUMN IF NOT EXISTS ${id}_balance NUMERIC(38, 12) NOT NULL DEFAULT 0`,
  )
  .join(",\n");

const sqlComments = missing
  .map(
    (id) =>
      `COMMENT ON COLUMN public.wallets.${id}_balance IS 'OpenPay Pro ledger ${id.toUpperCase()} — Spot/Perp listed major';`,
  )
  .join("\n");

const sqlCase = missing
  .map((id) => `    when '${id.toUpperCase()}' then '${id}_balance'`)
  .join("\n");

const sqlAssets = missing.map((id) => `'${id.toUpperCase()}'`).join(",");

const migration = `-- Expand OpenPay Pro wallet ledger balances for all Spot/Perp listed majors.
-- Enables buy / hold / spot settlement for every Tokens catalog major.

ALTER TABLE public.wallets
${sqlCols};

${sqlComments}

create or replace function public.p2p_balance_column(_asset text)
returns text
language sql
immutable
set search_path = public
as $$
  select case upper(_asset)
    when 'OUSD' then 'ousd_balance'
    when 'USDC' then 'usdc_balance'
    when 'USDT' then 'usdt_balance'
    when 'ETH'  then 'eth_balance'
    when 'BTC'  then 'btc_balance'
    when 'SOL'  then 'sol_balance'
    when 'PI'   then 'pi_balance'
    when 'PYUSD' then 'pyusd_balance'
    when 'EURC' then 'eurc_balance'
    when 'USDG' then 'usdg_balance'
    when 'USD1' then 'usd1_balance'
    when 'CASH' then 'cash_balance'
    when 'HYPE' then 'hype_balance'
    when 'ZEC' then 'zec_balance'
    when 'TSLAX' then 'tslax_balance'
    when 'NFLXX' then 'nflxx_balance'
    when 'GOOGLX' then 'googlx_balance'
    when 'BNB' then 'bnb_balance'
    when 'UNI' then 'uni_balance'
    when 'OKB' then 'okb_balance'
    when 'GT' then 'gt_balance'
    when 'BGB' then 'bgb_balance'
    when 'CAKE' then 'cake_balance'
    when 'JUP' then 'jup_balance'
    when 'RON' then 'ron_balance'
    when 'XRP' then 'xrp_balance'
    when 'TRX' then 'trx_balance'
    when 'DOGE' then 'doge_balance'
    when 'ADA' then 'ada_balance'
    when 'LINK' then 'link_balance'
    when 'XLM' then 'xlm_balance'
    when 'BCH' then 'bch_balance'
    when 'GRAM' then 'gram_balance'
    when 'AVAX' then 'avax_balance'
    when 'SUI' then 'sui_balance'
    when 'XAUT' then 'xaut_balance'
    when 'ONDO' then 'ondo_balance'
    when 'NEAR' then 'near_balance'
    when 'USDY' then 'usdy_balance'
    when 'PAXG' then 'paxg_balance'
    when 'WLFI' then 'wlfi_balance'
    when 'ASTER' then 'aster_balance'
    when 'RLUSD' then 'rlusd_balance'
    when 'AAVE' then 'aave_balance'
    when 'DOT' then 'dot_balance'
    when 'PUMP' then 'pump_balance'
${sqlCase}
    else null end
$$;

-- Soften Spot/Perp market CHECKs already widened; ensure funding tables accept symbols.
create or replace function public.is_trade_market_symbol(m text)
returns boolean
language sql
immutable
as $$
  select upper(coalesce(m, '')) ~ '^[A-Z0-9]{1,16}$';
$$;
`;

fs.writeFileSync(
  "supabase/migrations/20260805140000_all_listed_major_ledger_balances.sql",
  migration,
);

fs.writeFileSync(
  "scripts/_ledger-expand.json",
  JSON.stringify(
    {
      missing,
      constDecls,
      swapEntries,
      balanceEntries,
      assetCodes,
      assetCodeList,
      fallbackUsd,
      swapIdMap,
    },
    null,
    2,
  ),
);

console.log("wrote migration + scripts/_ledger-expand.json");

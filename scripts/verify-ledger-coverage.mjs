import { listedTradeMarkets } from "../src/lib/trade-markets.ts";
import { MAJOR_TOKENS, isMajorTokenId } from "../src/lib/major-tokens.ts";
import { isLedgerMajorId, LEDGER_BALANCE_COLUMN } from "../src/lib/ledger-majors.ts";

const markets = listedTradeMarkets();
const missingMajor = markets.filter((m) => !m.majorId);
const missingLedger = markets.filter((m) => m.majorId && !isLedgerMajorId(m.majorId));
const noCol = Object.keys(MAJOR_TOKENS).filter((id) => !LEDGER_BALANCE_COLUMN[id]);

console.log("markets", markets.length);
console.log("spot", markets.filter((m) => m.spot_enabled).length);
console.log("perp", markets.filter((m) => m.perpetual_enabled).length);
console.log("without majorId", missingMajor.length, missingMajor.map((m) => m.symbol).join(","));
console.log("majorId not ledger", missingLedger.length);
console.log("majors without col", noCol.length);
console.log("xmr col", LEDGER_BALANCE_COLUMN.xmr);
console.log("catalog", Object.keys(MAJOR_TOKENS).length, "ledger ok", Object.keys(MAJOR_TOKENS).every(isLedgerMajorId));
